import { clinicDayOf, endOfClinicDay, startOfClinicDay } from '@clinicai/shared';
import { config } from '../../config.js';
import { ForbiddenError, NotFoundError } from '../../common/errors.js';
import {
  MATCHES_NO_DOCTOR,
  requirePermission,
  scopeFilter,
  type Principal,
} from '../../common/permissions.js';
import { organisationInScope } from '../../common/organisation-scope.js';
import { withOrganisationScope } from '../../db/principal-scope.js';
import type { TenantDb } from '../../db/tenant-client.js';
import { record, recordRead } from '../audit/audit.service.js';
import { organisationTimeZone } from '../appointments/appointments.repository.js';
import { createObjectStorage, type StorageClient } from '../../storage/object-storage.js';
import * as repository from './calls.repository.js';
import type { ListCallsQuery } from './calls.schemas.js';

/**
 * Reading the call history.
 *
 * ─── THREE DIFFERENT READERS, THREE DIFFERENT ANSWERS ───────────────────────────
 *
 * The matrix is unusually specific about this resource, and each cell changes what this file
 * does rather than only whether it answers:
 *
 *   - a CLINIC role reads the whole clinic's calls, numbers and all
 *   - a PLATFORM role reads at scope `metadata`: timings and outcomes, with the numbers and
 *     the patient nulled. A call's numbers are personal data on their own, and support does
 *     not need them to see that a clinic's agent is answering
 *   - a DOCTOR reads `own`, which here means calls attached to their own appointments. A call
 *     with no appointment is not theirs to see, because nothing says it concerns them
 *
 * ─── RECORDINGS ARE A SEPARATE PERMISSION AND A SEPARATE ENDPOINT ───────────────
 *
 * `recordings` is its own resource: platform roles never, doctors never, staff only when the
 * clinic has switched it on. So the list says WHETHER a recording exists and the URL is
 * minted by a second request that checks that cell, which also means every access to the
 * audio is one audit row.
 */

export type CallView = {
  readonly id: string;
  readonly externalCallId: string;
  readonly direction: 'INBOUND' | 'OUTBOUND';
  readonly status: string;
  readonly outcome: string;
  readonly fromE164: string | null;
  readonly toE164: string | null;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly durationSeconds: number | null;
  readonly patient: { readonly id: string; readonly fullName: string | null } | null;
  readonly appointmentId: string | null;
  readonly hasRecording: boolean;
  readonly createdAt: string;
};

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

const toView = (row: repository.CallRow): CallView => ({
  id: row.id,
  externalCallId: row.externalCallId,
  direction: row.direction,
  status: row.status,
  outcome: row.outcome,
  fromE164: row.fromE164 === '' ? null : row.fromE164,
  toE164: row.toE164 === '' ? null : row.toE164,
  startedAt: iso(row.startedAt),
  endedAt: iso(row.endedAt),
  durationSeconds: row.durationSeconds,
  patient: row.patient,
  appointmentId: row.appointmentId,
  // The KEY NEVER LEAVES THE SERVER. A client that knew it would still need credentials, and
  // a client that does not know it cannot try.
  hasRecording: row.recordingKey !== null,
  createdAt: row.createdAt.toISOString(),
});

/** Scope `metadata`: the call happened, and who it was with is not part of the answer. */
const toMetadataView = (view: CallView): CallView => ({
  ...view,
  fromE164: null,
  toE164: null,
  patient: null,
});

/**
 * A clinic-local day range, resolved in the clinic's own zone.
 *
 * `from` and `to` arrive as dates, not instants, because a receptionist filters by day and
 * "the 2nd" in Kolkata is not the 2nd in UTC. The upper bound is the END of `to`, so a
 * single-day filter includes that whole day rather than nothing.
 */
const windowFor = async (
  db: TenantDb,
  organisationId: string,
  query: ListCallsQuery,
): Promise<{ readonly from?: Date; readonly to?: Date }> => {
  if (query.from === undefined && query.to === undefined) {
    return {};
  }

  const timeZone = await organisationTimeZone(db, organisationId);

  return {
    ...(query.from === undefined ? {} : { from: startOfClinicDay(query.from, timeZone) }),
    ...(query.to === undefined ? {} : { to: endOfClinicDay(query.to, timeZone) }),
  };
};

/** The doctor row for a user, when the matrix scope is `own`. */
const ownDoctorId = async (
  db: TenantDb,
  organisationId: string,
  principal: Principal,
  scope: ReturnType<typeof requirePermission>,
): Promise<string | undefined> => {
  if (scopeFilter(scope, principal).kind !== 'own-doctor') {
    return undefined;
  }

  const doctor = await db.doctor.findFirst({
    where: { organisationId, userId: principal.userId, deletedAt: null },
    select: { id: true },
  });

  /**
   * A DOCTOR with no doctor row sees NOTHING, rather than everything. The alternative, an
   * undefined filter, would widen `own` to `all` for a misconfigured user, which is the
   * direction that must never happen by accident.
   */
  return doctor?.id ?? MATCHES_NO_DOCTOR;
};

export const list = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  query: ListCallsQuery,
): Promise<{ readonly items: readonly CallView[]; readonly nextCursor: string | null }> => {
  const scope = requirePermission('call_history', 'read', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'calls.list', async (db) => {
    const doctorId = await ownDoctorId(db, organisationId, principal, scope);
    const window = await windowFor(db, organisationId, query);

    const rows = await repository.list(db, {
      organisationId,
      ...window,
      ...(query.direction === undefined ? {} : { direction: query.direction }),
      ...(query.status === undefined ? {} : { status: query.status }),
      ...(query.q === undefined ? {} : { search: query.q }),
      ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
      ...(doctorId === undefined ? {} : { ownDoctorId: doctorId }),
      take: query.limit + 1,
    });

    const page = rows.slice(0, query.limit);

    await recordRead(db, 'call', undefined, {
      count: page.length,
      // WHETHER a search ran, never the digits: a caller's number is patient data.
      searched: query.q !== undefined,
      scope,
    });

    const views = page.map(toView);

    return {
      items: scope === 'metadata' ? views.map(toMetadataView) : views,
      nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
    };
  });
};

export type CallDetail = {
  readonly call: CallView;
  readonly transcript: readonly { readonly role: string; readonly text: string }[];
};

export const get = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  callId: string,
): Promise<CallDetail> => {
  const scope = requirePermission('call_history', 'read', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'calls.read', async (db) => {
    const doctorId = await ownDoctorId(db, organisationId, principal, scope);
    const row = await repository.findById(db, organisationId, callId);

    if (row === null || (doctorId !== undefined && row.appointmentId === null)) {
      // Not found rather than forbidden, for another clinic's id and for a call outside a
      // doctor's own scope alike (rule 7).
      throw new NotFoundError(`call ${callId} not reachable`, 'That call was not found.');
    }

    /**
     * A PLATFORM ROLE GETS NO TRANSCRIPT AT ALL. Scope `metadata` means timings and
     * outcomes; a transcript is the conversation itself, which is further from metadata than
     * the numbers this scope already hides.
     */
    const transcript =
      scope === 'metadata' ? [] : await repository.transcriptFor(db, organisationId, callId);

    await recordRead(db, 'call', callId, { scope, transcriptTurns: transcript.length });

    const view = toView(row);

    return {
      call: scope === 'metadata' ? toMetadataView(view) : view,
      transcript: transcript.map((turn) => ({ role: turn.role, text: turn.text })),
    };
  });
};

/**
 * Whether this clinic lets staff hear recordings.
 *
 * The matrix returns `clinic_opt_in` for STAFF, which `scopeFilter` deliberately turns into a
 * denial until somebody checks the setting: forgetting the check then fails closed. This is
 * the check.
 */
const recordingsVisibleToStaff = async (db: TenantDb, organisationId: string): Promise<boolean> => {
  const organisation = await db.organisation.findUnique({
    where: { id: organisationId },
    select: { settings: true },
  });

  const settings = organisation?.settings;

  return (
    typeof settings === 'object' &&
    settings !== null &&
    (settings as Record<string, unknown>)['recordings_visible_to_staff'] === true
  );
};

export type RecordingUrl = {
  readonly url: string;
  readonly expiresInSeconds: number;
};

/**
 * A short-lived URL for one call's recording.
 *
 * PRESIGNED, NEVER PROXIED. D-007 forbids streaming a response through the API, and a
 * recording is minutes of audio: `tenantMiddleware` would buffer the whole thing in memory
 * and send it only after the transaction committed. The URL is minted here and the bytes
 * travel from object storage to the browser.
 *
 * EVERY MINT IS AUDITED, because listening to a recording is the most sensitive read in the
 * product. The row names the call and the actor, never the key or the URL: a URL in an audit
 * row would be a credential in a table people are allowed to read.
 */
export const recordingUrl = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  callId: string,
  storage: StorageClient = createObjectStorage(),
): Promise<RecordingUrl> => {
  const scope = requirePermission('recordings', 'read', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'calls.recording', async (db) => {
    if (scope === 'clinic_opt_in' && !(await recordingsVisibleToStaff(db, organisationId))) {
      throw new ForbiddenError(
        `recordings are not visible to staff in organisation ${organisationId}`,
        'This clinic has not made recordings available to staff.',
      );
    }

    const row = await repository.findById(db, organisationId, callId);

    if (row === null) {
      throw new NotFoundError(`call ${callId} not reachable`, 'That call was not found.');
    }

    if (row.recordingKey === null) {
      /**
       * A real state, not an error in the system: consent may have been declined, the
       * recording may not have been copied yet, or the call may have had none. The screen
       * says which, so this is a 404 with a plain reason rather than a 500.
       */
      throw new NotFoundError(
        `call ${callId} has no recording`,
        'There is no recording for this call.',
      );
    }

    const url = await storage.presignGet({
      bucket: config.RECORDINGS_BUCKET,
      key: row.recordingKey,
      expiresInSeconds: config.PRESIGNED_URL_TTL_SECONDS,
    });

    await record(db, {
      action: 'call.recording_accessed',
      entityType: 'call',
      entityId: callId,
      organisationId,
      // No key and no URL. Both are credentials of a sort for the lifetime of the signature.
      metadata: { ttlSeconds: config.PRESIGNED_URL_TTL_SECONDS },
    });

    return { url, expiresInSeconds: config.PRESIGNED_URL_TTL_SECONDS };
  });
};

/** Exported for this module's tests, which drive the day-window arithmetic directly. */
export const internals = { windowFor, clinicDayOf };
