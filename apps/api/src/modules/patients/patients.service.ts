import type { PatientInput, UpdatePatientInput } from '@clinicai/shared';
import { NotFoundError } from '../../common/errors.js';
import {
  maskPatientFields,
  requirePermission,
  scopeFilter,
  shouldMask,
  type Principal,
} from '../../common/permissions.js';
import { organisationInScope } from '../../common/organisation-scope.js';
import { withOrganisationScope } from '../../db/principal-scope.js';
import type { TenantDb } from '../../db/tenant-client.js';
import { record, recordRead } from '../audit/audit.service.js';
import * as repository from './patients.repository.js';

/**
 * Patients: the business rules, the permission checks and the audit trail.
 *
 * ─── EVERYTHING HERE IS PATIENT HEALTH DATA ─────────────────────────────────────
 *
 * Which has three consequences that are easy to state and easy to forget:
 *
 *  1. NOTHING IS LOGGED. Not a name, not a number, not a note, not even in an error
 *     message. `NotFoundError` names an id. The logger is not called at all in this file,
 *     because the only values worth logging here are the ones that must not be.
 *  2. EVERY READ IS AUDITED, not only every write. Looking at a patient record is the
 *     sensitive act in a clinic, which is rule 5, and `recordRead` exists for it.
 *  3. AUDIT ROWS CARRY IDS AND COUNTS, never field values. `audit.service` refuses a
 *     metadata key that looks like patient data, so a mistake here fails loudly rather
 *     than writing the thing it was trying to protect.
 *
 * ─── THE THREE SCOPES THE MATRIX HANDS BACK, AND WHAT EACH ONE COSTS ────────────
 *
 *   all      CLINIC_OWNER, CLINIC_MANAGER, STAFF: every patient in the clinic.
 *   own      DOCTOR: only patients they have an appointment with. Enforced as a filter on
 *            the query, never by fetching and discarding, because the discarded rows would
 *            still have been read and a count would still have leaked.
 *   masked   SUPER_ADMIN, INTERNAL_ADMIN: the row without the identifying fields, unless a
 *            support session is open for this clinic.
 *
 * `requirePermission` RETURNS the scope rather than just allowing the call, and every
 * function below uses what it returns. A caller that treated it as a boolean would hand a
 * doctor the whole clinic.
 *
 * ─── HOW A PLATFORM ROLE REACHES THESE AT ALL ───────────────────────────────────
 *
 * Not through `tenantMiddleware`, which requires an organisation in the request context and
 * would refuse the two roles the matrix grants a masked read to. Every function here runs
 * inside `withOrganisationScope`: a clinic role gets `withTenant`, and a platform role gets
 * `asOrganisationSystem`, which is platform scope in the database (so row-level security lets
 * the query through) and tenant scope in the application (so the extension injects
 * `organisation_id` from the clinic that was named).
 *
 * THAT IS WHY THE REPOSITORY'S EXPLICIT FILTERS ARE A SECOND LAYER AND NOT THE CONTROL. The
 * first version of this used unbounded `asSystem`, where the extension injects nothing and
 * confinement rested on every repository function remembering to filter: a function added
 * later without one would return another clinic's patients and no test would notice.
 *
 * A platform role must still NAME the clinic (`?organisationId=`), and a platform read with
 * no clinic named is a 400 rather than a list of every clinic's patients.
 */

/** A patient's history panel is bounded: a profile is not a paged list. */
const HISTORY_LIMIT = 50;

export type PatientView = {
  readonly id: string;
  readonly fullName: string | null;
  readonly phone: string | null;
  readonly dateOfBirth: string | null;
  readonly notes: string | null;
  readonly lastAppointmentAt: string | null;
  readonly nextAppointmentAt: string | null;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export type PatientListPage = {
  readonly items: readonly Omit<PatientView, 'notes' | 'updatedAt'>[];
  readonly nextCursor: string | null;
};

export type PatientDetail = PatientView & {
  readonly appointments: readonly {
    readonly id: string;
    readonly startAt: string;
    readonly endAt: string;
    readonly status: string;
    readonly source: string;
    readonly doctorName: string;
    readonly serviceName: string | null;
  }[];
};

/**
 * A date of birth as the calendar day it is, never as an instant.
 *
 * The column is a PostgreSQL `date`, which Prisma hands back as a `Date` at UTC midnight.
 * Formatting it with `toISOString()` and slicing is correct ONLY because of that: the value
 * has no time and no zone, so reading its UTC fields gives the day that was stored. Going
 * through the clinic's zone instead would shift a birthday by a day for any clinic west of
 * UTC, which is the classic version of this bug.
 */
const toDay = (value: Date | null): string | null => value?.toISOString().slice(0, 10) ?? null;

const resolveDoctorScope = async (
  db: TenantDb,
  organisationId: string,
  principal: Principal,
  scope: ReturnType<typeof requirePermission>,
): Promise<string | undefined> => {
  const filter = scopeFilter(scope, principal);

  if (filter.kind !== 'own-doctor') {
    return undefined;
  }

  const doctorId = await repository.findDoctorIdForUser(db, organisationId, filter.doctorUserId);

  if (doctorId === undefined) {
    /**
     * A DOCTOR-role user with no doctor profile sees nothing, rather than everything.
     *
     * This is the fail-closed case and it is a real one: a clinic can create a DOCTOR login
     * before anyone links it to a doctor row. Returning `undefined` here would drop the
     * filter and turn the narrowest scope in the matrix into the widest.
     */
    return 'no-doctor-profile';
  }

  return doctorId;
};

export const list = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  /**
   * `| undefined` is spelled out on the optional members because the project compiles with
   * `exactOptionalPropertyTypes`, and what arrives here is a PARSED QUERY STRING: zod gives
   * an absent optional field as a present key holding `undefined`. Writing `q?: string`
   * would describe a shape the router cannot produce.
   */
  query: {
    readonly q?: string | undefined;
    readonly cursor?: string | undefined;
    readonly limit: number;
    readonly sort: 'recent' | 'name';
  },
  now: Date = new Date(),
): Promise<PatientListPage> => {
  const scope = requirePermission('patients', 'read', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'patients.list', async (db) => {
    const onlyForDoctorId = await resolveDoctorScope(db, organisationId, principal, scope);

    /**
     * One more row than asked for, to discover whether another page exists.
     *
     * A separate `count` would be a second query over the same filter, and on a search it
     * would be the expensive one.
     */
    const rows = await repository.list(db, {
      organisationId,
      ...(query.q === undefined ? {} : { search: query.q }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(onlyForDoctorId === undefined ? {} : { onlyForDoctorId }),
      take: query.limit + 1,
      sort: query.sort,
    });

    const page = rows.slice(0, query.limit);
    const bounds = await repository.appointmentBounds(
      db,
      organisationId,
      page.map((row) => row.id),
      now,
    );
    const boundsByPatient = new Map(bounds.map((row) => [row.patientId, row]));

    const masked = shouldMask(scope, await hasSupportSession(db));

    await recordRead(db, 'patient', undefined, {
      count: page.length,
      searched: query.q !== undefined,
    });

    return {
      items: page.map((row) => {
        const view = {
          id: row.id,
          fullName: row.fullName,
          phone: row.phone,
          dateOfBirth: toDay(row.dateOfBirth),
          lastAppointmentAt: boundsByPatient.get(row.id)?.lastAppointmentAt?.toISOString() ?? null,
          nextAppointmentAt: boundsByPatient.get(row.id)?.nextAppointmentAt?.toISOString() ?? null,
          createdAt: row.createdAt.toISOString(),
        };

        return masked ? maskPatientFields(view) : view;
      }),
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  });
};

/**
 * Whether a support session unmasks this request.
 *
 * Always false for now, and it is a stub with a name rather than a `false` inline, so the
 * place the support-session lookup belongs is visible. The support-sessions module owns
 * that state and the admin console has no patient screens yet, so wiring it in would be
 * code no caller reaches. `shouldMask` already treats "no session" as the masking case,
 * which is the fail-closed direction.
 */
const hasSupportSession = (_db: TenantDb): Promise<boolean> => Promise.resolve(false);

export const get = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  patientId: string,
): Promise<PatientDetail> => {
  /**
   * The permission gate runs BEFORE the clinic is resolved, because
   * `organisationInScope` answers 400 for a platform role that named none, and a 400 in
   * place of a 403 tells a denied caller that a missing parameter was all that stopped them.
   */
  const scope = requirePermission('patients', 'read', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'patients.read', async (db) => {
    const onlyForDoctorId = await resolveDoctorScope(db, organisationId, principal, scope);

    const patient = await repository.findById(db, organisationId, patientId);

    if (patient === null) {
      throw new NotFoundError(`patient ${patientId} not reachable`, 'That patient was not found.');
    }

    if (onlyForDoctorId !== undefined) {
      const seen =
        onlyForDoctorId !== 'no-doctor-profile' &&
        (await repository.doctorHasSeenPatient(db, organisationId, onlyForDoctorId, patientId));

      if (!seen) {
        // The same 404 as a patient in another clinic: a doctor must not be able to probe
        // which patients exist in their own clinic by reading the error.
        throw new NotFoundError(
          `patient ${patientId} not reachable`,
          'That patient was not found.',
        );
      }
    }

    const [history, bounds] = await Promise.all([
      repository.appointmentHistory(db, organisationId, patientId, HISTORY_LIMIT),
      repository.appointmentBounds(db, organisationId, [patientId], new Date()),
    ]);

    await recordRead(db, 'patient', patientId);

    const masked = shouldMask(scope, await hasSupportSession(db));

    const view: PatientDetail = {
      id: patient.id,
      fullName: patient.fullName,
      phone: patient.phone,
      dateOfBirth: toDay(patient.dateOfBirth),
      notes: patient.notes,
      lastAppointmentAt: bounds[0]?.lastAppointmentAt?.toISOString() ?? null,
      nextAppointmentAt: bounds[0]?.nextAppointmentAt?.toISOString() ?? null,
      createdAt: patient.createdAt.toISOString(),
      updatedAt: patient.updatedAt.toISOString(),
      appointments: history.map((row) => ({
        id: row.id,
        startAt: row.startAt.toISOString(),
        endAt: row.endAt.toISOString(),
        status: row.status,
        source: row.source,
        doctorName: row.doctor.fullName,
        serviceName: row.service?.name ?? null,
      })),
    };

    return masked ? maskPatientFields(view) : view;
  });
};

export const create = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  input: PatientInput,
): Promise<{ readonly patientId: string }> => {
  requirePermission('patients', 'write', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'patients.create', async (db) => {
    const patientId = await repository.create(db, organisationId, {
      fullName: input.fullName,
      phone: input.phone,
      dateOfBirth:
        input.dateOfBirth === null ? null : new Date(`${input.dateOfBirth}T00:00:00.000Z`),
      notes: input.notes,
    });

    await record(db, {
      action: 'patient.created',
      entityType: 'patient',
      entityId: patientId,
      // No name, no number: the id is the record and the audit row points at it.
      metadata: { hasDateOfBirth: input.dateOfBirth !== null },
    });

    return { patientId };
  });
};

export const update = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  patientId: string,
  input: UpdatePatientInput,
): Promise<void> => {
  requirePermission('patients', 'write', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  await withOrganisationScope(principal, organisationId, 'patients.update', async (db) => {
    const changed = await repository.update(db, organisationId, patientId, {
      ...(input.fullName === undefined ? {} : { fullName: input.fullName }),
      ...(input.phone === undefined ? {} : { phone: input.phone }),
      ...(input.dateOfBirth === undefined
        ? {}
        : {
            dateOfBirth:
              input.dateOfBirth === null ? null : new Date(`${input.dateOfBirth}T00:00:00.000Z`),
          }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
    });

    if (changed === 0) {
      throw new NotFoundError(`patient ${patientId} not reachable`, 'That patient was not found.');
    }

    await record(db, {
      action: 'patient.updated',
      entityType: 'patient',
      entityId: patientId,
      // WHICH fields changed, never what they changed to. That is the line rule 5 draws.
      metadata: { fields: Object.keys(input).toSorted() },
    });
  });
};

/**
 * Exported for the module's own tests, which drive the rules against a real database inside
 * a scope they opened themselves.
 */
export const internals = { hasSupportSession };
