import {
  addDays,
  canTransition,
  clinicDayOf,
  holdsSlot,
  startOfClinicDay,
  weekdayOf,
  type AgendaRange,
  type AppointmentSource,
  type AppointmentStatus,
  type CancelAppointmentInput,
  type CreateAppointmentInput,
  type RescheduleAppointmentInput,
} from '@clinicai/shared';
import { ConflictError, NotFoundError, ValidationError } from '../../common/errors.js';
import { organisationInScope } from '../../common/organisation-scope.js';
import {
  MATCHES_NO_DOCTOR,
  maskPatientFields,
  requirePermission,
  scopeFilter,
  shouldMask,
  type Principal,
} from '../../common/permissions.js';
import { withOrganisationScope } from '../../db/principal-scope.js';
import type { TenantDb } from '../../db/tenant-client.js';
import { record, recordRead } from '../audit/audit.service.js';
import { bookableSlots, type Slot } from '../availability/availability.engine.js';
import { findDoctorIdForUser } from '../patients/patients.repository.js';
import * as repository from './appointments.repository.js';

/**
 * Appointments: booking, rescheduling, cancelling, and the status machine.
 *
 * ─── THE DATABASE IS WHAT MAKES DOUBLE BOOKING IMPOSSIBLE, NOT THIS FILE ────────
 *
 * The slot engine is consulted before a write, and it is NOT the control. Two bookings for
 * one slot arriving together both see the slot free, because both read before either wrote:
 * no amount of checking first can fix that, which is why `appointments_no_overlap`, a GiST
 * exclusion constraint over `(doctor_id, tstzrange(start_at, end_at))` where the status
 * still holds the slot, is the thing that decides. This file's job is to turn the
 * constraint's refusal into a 409 that says "that time was just taken" instead of the 500 an
 * unrecognised driver error would produce.
 *
 * The engine check is still worth running first, because it is what produces a USEFUL
 * refusal: outside opening hours, the doctor is not working, the notice period, the
 * maximum advance. Those are things the constraint knows nothing about.
 *
 * ─── WHY THE STATUS CHANGE IS A COMPARE-AND-SET ─────────────────────────────────
 *
 * `changeStatus` names the status it expects to find. Two users acting at once, one
 * cancelling and one completing, both read SCHEDULED; the second write would otherwise
 * overwrite the first and the clinic would have no record that anything was contested. A
 * zero row count becomes a 409 telling the user to look again.
 *
 * ─── SCOPES ─────────────────────────────────────────────────────────────────────
 *
 *   all      CLINIC_OWNER, CLINIC_MANAGER, STAFF
 *   own      DOCTOR: read and write their OWN appointments, enforced as a query filter
 *   masked   platform roles, unreachable today for the reason given in patients.service.ts
 */

/** Hard maximum page size (apps/api/CLAUDE.md). */
export const MAX_PAGE_SIZE = 100;

/** How far either side of a day occupancy is loaded, so a buffer cannot reach past it. */
const OCCUPANCY_MARGIN_MINUTES = 240;

export type AppointmentView = {
  readonly id: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly status: AppointmentStatus;
  readonly source: AppointmentSource;
  readonly patient: {
    readonly id: string;
    readonly fullName: string | null;
    readonly phone: string | null;
  };
  readonly doctor: { readonly id: string; readonly fullName: string };
  readonly service: {
    readonly id: string;
    readonly name: string;
    readonly durationMinutes: number;
  } | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly rescheduledFromId: string | null;
  /** PHI. Null for a platform role's masked read, as the patient's name is. */
  readonly notes: string | null;
  readonly createdAt: string;
};

const toView = (row: repository.AppointmentListRow): AppointmentView => ({
  id: row.id,
  startAt: row.startAt.toISOString(),
  endAt: row.endAt.toISOString(),
  status: row.status,
  source: row.source,
  patient: { id: row.patient.id, fullName: row.patient.fullName, phone: row.patient.phone },
  doctor: { id: row.doctor.id, fullName: row.doctor.fullName },
  service: row.service,
  cancelledAt: row.cancelledAt?.toISOString() ?? null,
  cancellationReason: row.cancellationReason,
  rescheduledFromId: row.rescheduledFromId,
  notes: row.notes,
  createdAt: row.createdAt.toISOString(),
});

/**
 * Masks the patient's identifying fields inside an appointment view.
 *
 * `maskPatientFields` works on a flat record, and the patient is nested here, so the nested
 * object is masked and put back rather than the whole view being passed in: calling it on
 * the outer object would silently mask nothing, which is the quiet kind of failure.
 */
const maskView = (view: AppointmentView): AppointmentView => ({
  ...view,
  patient: maskPatientFields(view.patient),
  /**
   * The note too. It is free text a receptionist typed about a patient, which is as
   * identifying as their name and often more so, and the masked read exists so that support
   * can see the shape of a clinic's day without seeing who is in it.
   */
  notes: null,
});

const doctorScope = async (
  db: TenantDb,
  organisationId: string,
  principal: Principal,
  scope: ReturnType<typeof requirePermission>,
): Promise<string | undefined> => {
  const filter = scopeFilter(scope, principal);

  if (filter.kind !== 'own-doctor') {
    return undefined;
  }

  // Fail closed: a DOCTOR login with no linked doctor row sees nothing. An impossible id
  // is used rather than dropping the filter, because dropping it would widen the narrowest
  // scope in the matrix to the whole clinic.
  return (await findDoctorIdForUser(db, organisationId, filter.doctorUserId)) ?? MATCHES_NO_DOCTOR;
};

/**
 * `| undefined` is spelled out on every optional member because the project compiles with
 * `exactOptionalPropertyTypes`, and this is a PARSED QUERY STRING: zod hands back an absent
 * optional field as a present key holding `undefined`.
 */
export type ListQuery = {
  /** Free text over the patient's name or number. See the repository for why not the service. */
  readonly q?: string | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly status?: readonly AppointmentStatus[] | undefined;
  readonly doctorId?: string | undefined;
  readonly patientId?: string | undefined;
  readonly cursor?: string | undefined;
  readonly limit: number;
};

const listWithin = async (
  db: TenantDb,
  principal: Principal,
  organisationId: string,
  query: ListQuery,
): Promise<{ readonly items: readonly AppointmentView[]; readonly nextCursor: string | null }> => {
  const scope = requirePermission('appointments', 'read', principal);
  const ownDoctorId = await doctorScope(db, organisationId, principal, scope);

  if (ownDoctorId !== undefined && query.doctorId !== undefined && query.doctorId !== ownDoctorId) {
    // A doctor asking for another doctor's list gets an empty page rather than a 403: the
    // refusal would confirm that the other doctor exists.
    return { items: [], nextCursor: null };
  }

  const rows = await repository.list(db, {
    organisationId,
    ...(query.q === undefined ? {} : { search: query.q }),
    ...(query.from === undefined ? {} : { from: new Date(query.from) }),
    ...(query.to === undefined ? {} : { to: new Date(query.to) }),
    ...(query.status === undefined ? {} : { status: query.status }),
    ...((ownDoctorId ?? query.doctorId)
      ? { doctorId: ownDoctorId ?? (query.doctorId as string) }
      : {}),
    ...(query.patientId === undefined ? {} : { patientId: query.patientId }),
    ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
    take: query.limit + 1,
  });

  const page = rows.slice(0, query.limit);
  const masked = shouldMask(scope, false);

  await recordRead(db, 'appointment', undefined, {
    count: page.length,
    // WHETHER a search ran, never what was typed: a search term is a patient's name.
    searched: query.q !== undefined,
  });

  return {
    items: page.map((row) => (masked ? maskView(toView(row)) : toView(row))),
    nextCursor: rows.length > query.limit ? (page.at(-1)?.id ?? null) : null,
  };
};

const getWithin = async (
  db: TenantDb,
  principal: Principal,
  organisationId: string,
  appointmentId: string,
): Promise<AppointmentView> => {
  const scope = requirePermission('appointments', 'read', principal);
  const ownDoctorId = await doctorScope(db, organisationId, principal, scope);

  const row = await repository.findById(db, organisationId, appointmentId);

  if (row === null || (ownDoctorId !== undefined && row.doctorId !== ownDoctorId)) {
    throw new NotFoundError(
      `appointment ${appointmentId} not reachable`,
      'That appointment was not found.',
    );
  }

  await recordRead(db, 'appointment', appointmentId);

  const view = toView(row);

  return shouldMask(scope, false) ? maskView(view) : view;
};

/**
 * Checks a proposed time against the engine, and says why not when it is refused.
 *
 * Shared by booking and rescheduling so the two cannot diverge: a reschedule that skipped
 * this would be a booking with none of the rules applied.
 */
const assertSlotIsOfferable = async (
  db: TenantDb,
  organisationId: string,
  input: {
    readonly doctorId: string;
    readonly serviceId: string;
    readonly startAt: Date;
    readonly excludeAppointmentId?: string;
    readonly now: Date;
  },
): Promise<{
  readonly endAt: Date;
  readonly timeZone: string;
  readonly priceMinor: number | null;
}> => {
  const inputs = await repository.slotInputs(db, organisationId, input.doctorId, input.serviceId);

  if (inputs.service === null) {
    throw new NotFoundError(
      `service ${input.serviceId} not reachable`,
      'That service was not found.',
    );
  }
  if (inputs.doctor === null) {
    throw new NotFoundError(`doctor ${input.doctorId} not reachable`, 'That doctor was not found.');
  }

  const timeZone = inputs.organisation.timezone;
  const day = clinicDayOf(input.startAt, timeZone);
  const dayStart = startOfClinicDay(day, timeZone);

  const occupancy = await repository.dayOccupancy(
    db,
    organisationId,
    input.doctorId,
    new Date(dayStart.getTime() - OCCUPANCY_MARGIN_MINUTES * 60_000),
    new Date(
      startOfClinicDay(addDays(day, 1), timeZone).getTime() + OCCUPANCY_MARGIN_MINUTES * 60_000,
    ),
    input.excludeAppointmentId,
  );

  const result = bookableSlots({
    day,
    timeZone,
    now: input.now,
    serviceDurationMinutes: inputs.service.durationMinutes,
    policy: inputs.policy ?? {
      slotGranularityMinutes: null,
      minimumNoticeMinutes: null,
      maximumAdvanceDays: null,
      defaultBufferMinutes: null,
      maxPerSlot: null,
    },
    doctorBufferMinutes: inputs.doctor.bufferMinutes,
    hoursCollected: inputs.organisation.hoursCollected,
    clinicHours: inputs.clinicHours.map((row) => ({
      weekday: row.weekday,
      startAtMinute: row.opensAtMinute,
      endAtMinute: row.closesAtMinute,
    })),
    doctorWorkingHours: inputs.doctorWorkingHours,
    timeOff: occupancy.timeOff,
    appointments: occupancy.appointments,
  });

  const offered = result.slots.find((slot) => slot.startAt.getTime() === input.startAt.getTime());

  if (offered === undefined) {
    /**
     * The refusal names the RULE, not the data.
     *
     * The voice agent reads this to a caller, so "that time is outside the clinic's opening
     * hours" is useful and "validation failed" is not. None of these messages contains
     * anything about a patient, which is what lets them be spoken and logged.
     */
    throw new ConflictError(
      `slot ${input.startAt.toISOString()} is not offerable for doctor ${input.doctorId}`,
      SLOT_REFUSALS[result.reason ?? 'FULLY_BOOKED'],
    );
  }

  // The price is read in the same round trip as the duration, so the one booked is the one
  // the slot was offered at.
  return { endAt: offered.endAt, timeZone, priceMinor: inputs.service.priceMinor };
};

const SLOT_REFUSALS: Readonly<Record<string, string>> = {
  HOURS_NOT_COLLECTED: "This clinic's opening hours have not been recorded yet.",
  DAY_IN_THE_PAST: 'That date has already passed.',
  BEYOND_MAXIMUM_ADVANCE: 'That date is further ahead than this clinic takes bookings.',
  CLINIC_CLOSED: 'The clinic is closed that day.',
  DOCTOR_NOT_WORKING: 'The doctor is not available that day.',
  FULLY_BOOKED: 'That time is no longer available.',
};

export type BookingResult = {
  readonly appointmentId: string;
  readonly startAt: string;
  readonly endAt: string;
  /** True when an `Idempotency-Key` replay returned the original booking. */
  readonly replayed: boolean;
};

/**
 * Books inside a transaction the caller already holds.
 *
 * Exported for the voice agent's booking of a NEW caller, whose patient record must be created
 * in the same transaction so that a refused booking takes the record with it (Feature 3
 * review, I4). A slot taken concurrently raises the exclusion constraint, which aborts the
 * whole transaction, so nothing written before it in that transaction survives.
 */
export const bookWithin = async (
  db: TenantDb,
  principal: Principal,
  organisationId: string,
  input: CreateAppointmentInput,
  options: {
    readonly source: AppointmentSource;
    readonly idempotencyKey?: string | undefined;
    readonly now?: Date | undefined;
  },
): Promise<BookingResult> => {
  requirePermission('appointments', 'write', principal);

  const now = options.now ?? new Date();

  /**
   * A replay returns the original result rather than booking again (root CLAUDE.md rule 8).
   *
   * Checked before anything else, because the whole point is that a retried request costs
   * nothing and changes nothing. The unique index on `(organisation_id, idempotency_key)` is
   * what makes it safe when two retries arrive together: this read can miss, and the insert
   * then collides, which is handled below.
   */
  if (options.idempotencyKey !== undefined) {
    const existing = await repository.findByIdempotencyKey(
      db,
      organisationId,
      options.idempotencyKey,
    );

    if (existing !== null) {
      return {
        appointmentId: existing.id,
        startAt: existing.startAt.toISOString(),
        endAt: existing.endAt.toISOString(),
        replayed: true,
      };
    }
  }

  const startAt = new Date(input.startAt);
  const targets = await repository.bookingTargets(
    db,
    organisationId,
    input.patientId,
    input.doctorId,
    input.serviceId,
  );

  if (!targets.patientExists) {
    throw new NotFoundError(
      `patient ${input.patientId} not reachable`,
      'That patient was not found.',
    );
  }

  const { endAt, priceMinor } = await assertSlotIsOfferable(db, organisationId, {
    doctorId: input.doctorId,
    serviceId: input.serviceId,
    startAt,
    now,
  });

  try {
    const appointmentId = await repository.create(db, organisationId, {
      patientId: input.patientId,
      doctorId: input.doctorId,
      serviceId: input.serviceId,
      startAt,
      endAt,
      status: 'SCHEDULED',
      source: options.source,
      ...(options.idempotencyKey === undefined ? {} : { idempotencyKey: options.idempotencyKey }),
      notes: input.notes ?? null,
      priceMinor,
    });

    await record(db, {
      action: 'appointment.created',
      entityType: 'appointment',
      entityId: appointmentId,
      // WHETHER a note was written, never the note: it is patient data (rule 5).
      metadata: {
        source: options.source,
        doctorId: input.doctorId,
        hasNotes: (input.notes ?? null) !== null,
      },
    });

    return {
      appointmentId,
      startAt: startAt.toISOString(),
      endAt: endAt.toISOString(),
      replayed: false,
    };
  } catch (error) {
    if (repository.isSlotTakenError(error)) {
      /**
       * THE RACE THIS EXISTS FOR, and the only correct answer to it.
       *
       * Another booking for the same doctor and the same range committed between the
       * engine's check and this insert. The constraint refused it, which is the system
       * working: the alternative, a check that was somehow trusted, is a clinic with two
       * patients in one chair.
       */
      throw new ConflictError(
        `slot ${startAt.toISOString()} was taken concurrently for doctor ${input.doctorId}`,
        'That time was just taken by another booking. Please choose another.',
      );
    }

    throw error;
  }
};

const rescheduleWithin = async (
  db: TenantDb,
  principal: Principal,
  organisationId: string,
  appointmentId: string,
  input: RescheduleAppointmentInput,
  now: Date = new Date(),
  actorSource?: AppointmentSource,
): Promise<BookingResult> => {
  const scope = requirePermission('appointments', 'write', principal);
  const ownDoctorId = await doctorScope(db, organisationId, principal, scope);

  const existing = await repository.findById(db, organisationId, appointmentId);

  if (existing === null || (ownDoctorId !== undefined && existing.doctorId !== ownDoctorId)) {
    throw new NotFoundError(
      `appointment ${appointmentId} not reachable`,
      'That appointment was not found.',
    );
  }

  if (!holdsSlot(existing.status)) {
    throw new ConflictError(
      `appointment ${appointmentId} is ${existing.status} and cannot be rescheduled`,
      'That appointment is no longer active, so it cannot be moved.',
    );
  }

  const doctorId = input.doctorId ?? existing.doctorId;
  const serviceId = input.serviceId ?? existing.serviceId;

  if (serviceId === null) {
    throw new ValidationError(
      `appointment ${appointmentId} has no service and none was supplied`,
      'Choose a service for this appointment.',
    );
  }

  const startAt = new Date(input.startAt);

  const offerable = await assertSlotIsOfferable(db, organisationId, {
    doctorId,
    serviceId,
    startAt,
    // The appointment being moved must not block its own new time, which it would if the
    // new time overlaps the old one: moving 09:00 to 09:15 is a legitimate reschedule.
    excludeAppointmentId: appointmentId,
    now,
  });

  /**
   * A RESCHEDULE IS A NEW ROW, NOT AN UPDATE, and `rescheduledFromId` links them.
   *
   * The clinic's history has to show that an appointment moved and where it moved from: a
   * patient who says "but I rebooked" is asking a question an updated row cannot answer.
   * The old row is cancelled rather than deleted for the same reason.
   *
   * Both writes are in one transaction, so there is never a moment with two live rows for
   * one slot, nor one with neither.
   */
  try {
    const newId = await db.$transaction(async (tx) => {
      const cancelled = await repository.changeStatus(
        tx,
        organisationId,
        appointmentId,
        existing.status,
        'CANCELLED',
        {
          cancelledAt: now,
          reason: input.reason ?? 'Rescheduled',
        },
      );

      if (cancelled === 0) {
        throw new ConflictError(
          `appointment ${appointmentId} changed status during the reschedule`,
          'That appointment was changed by someone else. Reload and try again.',
        );
      }

      return repository.create(tx, organisationId, {
        patientId: existing.patientId,
        doctorId,
        serviceId,
        startAt,
        endAt: offerable.endAt,
        status: existing.status,
        source: existing.source,
        rescheduledFromId: appointmentId,
        /**
         * The note travels with the appointment. A reschedule makes a NEW row, and a note
         * that stayed on the cancelled one would vanish from every screen that shows the
         * appointment, lost without anybody deleting it.
         */
        notes: existing.notes,
        /**
         * A move keeps the price it was booked at: it is the same visit at another time. A
         * change of SERVICE is a different visit, so it takes that service's price now.
         */
        priceMinor: serviceId === existing.serviceId ? existing.priceMinor : offerable.priceMinor,
      });
    });

    await record(db, {
      action: 'appointment.rescheduled',
      entityType: 'appointment',
      entityId: newId,
      /**
       * `actorSource` is how a voice-initiated move names its actor.
       *
       * `audit_logs.actor_role` is the database's six-value `role` enum, so the voice
       * agent cannot be written there, and a row with no actor at all would leave a
       * regulated trail unable to answer who moved an appointment. The appointment's own
       * `source` column is not the answer either: a reschedule inherits the source of the
       * booking it replaces, which is correct and says nothing about who moved it.
       */
      metadata: {
        from: appointmentId,
        doctorId,
        ...(actorSource === undefined ? {} : { actorSource }),
      },
    });

    return {
      appointmentId: newId,
      startAt: startAt.toISOString(),
      endAt: offerable.endAt.toISOString(),
      replayed: false,
    };
  } catch (error) {
    if (repository.isSlotTakenError(error)) {
      throw new ConflictError(
        `slot ${startAt.toISOString()} was taken concurrently during a reschedule`,
        'That time was just taken by another booking. Please choose another.',
      );
    }

    throw error;
  }
};

const cancelWithin = async (
  db: TenantDb,
  principal: Principal,
  organisationId: string,
  appointmentId: string,
  input: CancelAppointmentInput,
  now: Date = new Date(),
  actorSource?: AppointmentSource,
): Promise<void> => {
  const scope = requirePermission('appointments', 'write', principal);
  const ownDoctorId = await doctorScope(db, organisationId, principal, scope);

  const existing = await repository.findById(db, organisationId, appointmentId);

  if (existing === null || (ownDoctorId !== undefined && existing.doctorId !== ownDoctorId)) {
    throw new NotFoundError(
      `appointment ${appointmentId} not reachable`,
      'That appointment was not found.',
    );
  }

  if (!canTransition(existing.status, 'CANCELLED')) {
    throw new ConflictError(
      `appointment ${appointmentId} cannot move from ${existing.status} to CANCELLED`,
      `An appointment that is already ${existing.status.toLowerCase().replace('_', ' ')} cannot be cancelled.`,
    );
  }

  const changed = await repository.changeStatus(
    db,
    organisationId,
    appointmentId,
    existing.status,
    'CANCELLED',
    { cancelledAt: now, reason: input.reason },
  );

  if (changed === 0) {
    throw new ConflictError(
      `appointment ${appointmentId} changed status concurrently`,
      'That appointment was changed by someone else. Reload and try again.',
    );
  }

  await record(db, {
    action: 'appointment.cancelled',
    entityType: 'appointment',
    entityId: appointmentId,
    // See the note on the reschedule audit row for why the actor is in metadata.
    metadata: {
      from: existing.status,
      hasReason: input.reason !== null,
      ...(actorSource === undefined ? {} : { actorSource }),
    },
  });
};

const changeStatusWithin = async (
  db: TenantDb,
  principal: Principal,
  organisationId: string,
  appointmentId: string,
  to: AppointmentStatus,
  now: Date = new Date(),
): Promise<void> => {
  const scope = requirePermission('appointments', 'write', principal);
  const ownDoctorId = await doctorScope(db, organisationId, principal, scope);

  const existing = await repository.findById(db, organisationId, appointmentId);

  if (existing === null || (ownDoctorId !== undefined && existing.doctorId !== ownDoctorId)) {
    throw new NotFoundError(
      `appointment ${appointmentId} not reachable`,
      'That appointment was not found.',
    );
  }

  if (!canTransition(existing.status, to)) {
    throw new ConflictError(
      `appointment ${appointmentId} cannot move from ${existing.status} to ${to}`,
      `An appointment that is ${existing.status.toLowerCase().replace('_', ' ')} cannot become ${to.toLowerCase().replace('_', ' ')}.`,
    );
  }

  const changed = await repository.changeStatus(
    db,
    organisationId,
    appointmentId,
    existing.status,
    to,
    to === 'CANCELLED' ? { cancelledAt: now, reason: null } : undefined,
  );

  if (changed === 0) {
    throw new ConflictError(
      `appointment ${appointmentId} changed status concurrently`,
      'That appointment was changed by someone else. Reload and try again.',
    );
  }

  await record(db, {
    action: 'appointment.status_changed',
    entityType: 'appointment',
    entityId: appointmentId,
    metadata: { from: existing.status, to },
  });
};

// ─── The agenda ─────────────────────────────────────────────────────────────────

export type AgendaResult = {
  readonly range: AgendaRange;
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
  readonly counts: Readonly<Record<AppointmentStatus, number>>;
  readonly appointments: readonly AppointmentView[];
};

/**
 * The bounds of a range, on the clinic's calendar.
 *
 * A WEEK STARTS ON MONDAY, which is the clinic's week and the prototype's calendar. A month
 * is the calendar month the day falls in, not thirty days either side of it.
 */
export const agendaBounds = (
  range: AgendaRange,
  on: string,
): { readonly fromDay: string; readonly toDay: string } => {
  if (range === 'day') {
    return { fromDay: on, toDay: addDays(on, 1) };
  }

  if (range === 'week') {
    const weekdayIndex = [
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ].indexOf(weekdayOf(on));

    const monday = addDays(on, -weekdayIndex);
    return { fromDay: monday, toDay: addDays(monday, 7) };
  }

  const firstOfMonth = `${on.slice(0, 7)}-01`;
  const [year, month] = firstOfMonth.split('-').map(Number) as [number, number];
  const firstOfNext =
    month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, '0')}-01`;

  return { fromDay: firstOfMonth, toDay: firstOfNext };
};

const agendaWithin = async (
  db: TenantDb,
  principal: Principal,
  organisationId: string,
  query: {
    readonly range: AgendaRange;
    readonly on: string;
    readonly doctorId?: string | undefined;
  },
): Promise<AgendaResult> => {
  const scope = requirePermission('appointments', 'read', principal);
  const ownDoctorId = await doctorScope(db, organisationId, principal, scope);
  const doctorId = ownDoctorId ?? query.doctorId;

  const timeZone = await repository.organisationTimeZone(db, organisationId);
  const { fromDay, toDay } = agendaBounds(query.range, query.on);
  const from = startOfClinicDay(fromDay, timeZone);
  const to = startOfClinicDay(toDay, timeZone);

  const [counts, rows] = await Promise.all([
    repository.statusCounts(db, {
      organisationId,
      from,
      to,
      ...(doctorId === undefined ? {} : { doctorId }),
    }),
    /**
     * A month of appointments is bounded by the page size, not by the range.
     *
     * A calendar shows markers per day rather than every appointment, and the day view is
     * where the list matters. `MAX_PAGE_SIZE` is the ceiling either way: a clinic with more
     * than a hundred appointments in a day has a product problem this endpoint cannot fix,
     * and the counts are what the month view renders from.
     */
    repository.list(db, {
      organisationId,
      from,
      to,
      ...(doctorId === undefined ? {} : { doctorId }),
      take: MAX_PAGE_SIZE,
    }),
  ]);

  await recordRead(db, 'appointment', undefined, { range: query.range, count: rows.length });

  const masked = shouldMask(scope, false);

  return {
    range: query.range,
    from: from.toISOString(),
    to: to.toISOString(),
    timeZone,
    counts,
    appointments: rows.map((row) => (masked ? maskView(toView(row)) : toView(row))),
  };
};

// ─── Availability, which is the engine plus the loads it needs ──────────────────

export type AvailabilityResponse = {
  readonly date: string;
  readonly timeZone: string;
  readonly doctorId: string;
  readonly serviceId: string;
  readonly durationMinutes: number;
  readonly slots: readonly {
    readonly startAt: string;
    readonly endAt: string;
    readonly label: string;
  }[];
  readonly reason: string | null;
};

const availabilityWithin = async (
  db: TenantDb,
  principal: Principal,
  organisationId: string,
  query: { readonly doctorId: string; readonly serviceId: string; readonly date: string },
  now: Date = new Date(),
): Promise<AvailabilityResponse> => {
  // Reading availability is reading the appointment book, which is the appointments cell.
  requirePermission('appointments', 'read', principal);

  const inputs = await repository.slotInputs(db, organisationId, query.doctorId, query.serviceId);

  if (inputs.service === null) {
    throw new NotFoundError(
      `service ${query.serviceId} not reachable`,
      'That service was not found.',
    );
  }
  if (inputs.doctor === null) {
    throw new NotFoundError(`doctor ${query.doctorId} not reachable`, 'That doctor was not found.');
  }

  const timeZone = inputs.organisation.timezone;
  const dayStart = startOfClinicDay(query.date, timeZone);
  const occupancy = await repository.dayOccupancy(
    db,
    organisationId,
    query.doctorId,
    new Date(dayStart.getTime() - OCCUPANCY_MARGIN_MINUTES * 60_000),
    new Date(
      startOfClinicDay(addDays(query.date, 1), timeZone).getTime() +
        OCCUPANCY_MARGIN_MINUTES * 60_000,
    ),
  );

  const result = bookableSlots({
    day: query.date,
    timeZone,
    now,
    serviceDurationMinutes: inputs.service.durationMinutes,
    policy: inputs.policy ?? {
      slotGranularityMinutes: null,
      minimumNoticeMinutes: null,
      maximumAdvanceDays: null,
      defaultBufferMinutes: null,
      maxPerSlot: null,
    },
    doctorBufferMinutes: inputs.doctor.bufferMinutes,
    hoursCollected: inputs.organisation.hoursCollected,
    clinicHours: inputs.clinicHours.map((row) => ({
      weekday: row.weekday,
      startAtMinute: row.opensAtMinute,
      endAtMinute: row.closesAtMinute,
    })),
    doctorWorkingHours: inputs.doctorWorkingHours,
    timeOff: occupancy.timeOff,
    appointments: occupancy.appointments,
  });

  /**
   * NO AUDIT ROW FOR AN AVAILABILITY READ, and the route declares no PHI.
   *
   * A slot list contains no patient data: it is the clinic's own opening hours with the
   * taken times removed. Auditing it would add a row per keystroke on a date picker and
   * bury the reads that matter, which is the failure mode of auditing everything.
   */
  return {
    date: query.date,
    timeZone,
    doctorId: query.doctorId,
    serviceId: query.serviceId,
    durationMinutes: inputs.service.durationMinutes,
    slots: result.slots.map((slot: Slot) => ({
      startAt: slot.startAt.toISOString(),
      endAt: slot.endAt.toISOString(),
      label: slot.label,
    })),
    reason: result.reason ?? null,
  };
};

// ─── The scoped entry points ────────────────────────────────────────────────────

/**
 * THE PERMISSION CHECK RUNS BEFORE THE ORGANISATION IS RESOLVED, in every entry point below,
 * and the order is load-bearing.
 *
 * `organisationInScope` answers 400 when a platform role names no clinic. A platform role
 * also holds no write permission on either resource, so resolving the clinic first turned
 * "you may not do that" (403) into "name a clinic" (400), which told an internal admin that
 * the only thing standing between them and a write was a missing parameter. The guard in
 * `tests/declared-permissions-are-enforced.test.ts` caught exactly that.
 *
 * `requirePermission` is therefore called here as the GATE, and again inside the
 * implementation, which needs the scope it returns. It is a pure function over the matrix,
 * so calling it twice costs nothing and makes the ordering visible at both ends.
 */

/**
 * Everything above takes a `db` and everything below decides which `db` that is.
 *
 * THE SPLIT IS DELIBERATE AND IT IS NOT CEREMONY. `withOrganisationScope` opens a transaction,
 * so an implementation that called it would be untestable without a database and
 * unusable from inside another transaction: the voice tool endpoints in M3 call these same
 * rules with a scope they have already opened from a per-clinic secret rather than from a
 * user token. Keeping the rules in functions that accept a `db` means they can be reused
 * there without a second copy.
 *
 * `requirePermission` runs INSIDE the implementations, before any query. That ordering
 * matters: `withOrganisationScope` decides where a query may look, never whether the caller
 * may run it, so calling it first would open a scope for a caller who may not be there.
 */

export const list = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  query: ListQuery,
): Promise<{ readonly items: readonly AppointmentView[]; readonly nextCursor: string | null }> => {
  requirePermission('appointments', 'read', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'appointments.list', (db) =>
    listWithin(db, principal, organisationId, query),
  );
};

export const get = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  appointmentId: string,
): Promise<AppointmentView> => {
  requirePermission('appointments', 'read', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'appointments.read', (db) =>
    getWithin(db, principal, organisationId, appointmentId),
  );
};

export const book = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  input: CreateAppointmentInput,
  options: {
    readonly source: AppointmentSource;
    readonly idempotencyKey?: string | undefined;
    readonly now?: Date | undefined;
  },
): Promise<BookingResult> => {
  requirePermission('appointments', 'write', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'appointments.book', (db) =>
    bookWithin(db, principal, organisationId, input, options),
  );
};

export const reschedule = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  appointmentId: string,
  input: RescheduleAppointmentInput,
  now?: Date,
  options: { readonly actorSource?: AppointmentSource } = {},
): Promise<BookingResult> => {
  requirePermission('appointments', 'write', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'appointments.reschedule', (db) =>
    rescheduleWithin(
      db,
      principal,
      organisationId,
      appointmentId,
      input,
      now ?? new Date(),
      options.actorSource,
    ),
  );
};

export const cancel = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  appointmentId: string,
  input: CancelAppointmentInput,
  now?: Date,
  options: { readonly actorSource?: AppointmentSource } = {},
): Promise<void> => {
  requirePermission('appointments', 'write', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  await withOrganisationScope(principal, organisationId, 'appointments.cancel', (db) =>
    cancelWithin(
      db,
      principal,
      organisationId,
      appointmentId,
      input,
      now ?? new Date(),
      options.actorSource,
    ),
  );
};

export const changeStatus = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  appointmentId: string,
  to: AppointmentStatus,
  now?: Date,
): Promise<void> => {
  requirePermission('appointments', 'write', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  await withOrganisationScope(principal, organisationId, 'appointments.status', (db) =>
    changeStatusWithin(db, principal, organisationId, appointmentId, to, now ?? new Date()),
  );
};

export const agenda = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  query: {
    readonly range: AgendaRange;
    readonly on: string;
    readonly doctorId?: string | undefined;
  },
): Promise<AgendaResult> => {
  requirePermission('appointments', 'read', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'appointments.agenda', (db) =>
    agendaWithin(db, principal, organisationId, query),
  );
};

export const availability = async (
  principal: Principal,
  requestedOrganisationId: string | undefined,
  query: { readonly doctorId: string; readonly serviceId: string; readonly date: string },
  now?: Date,
): Promise<AvailabilityResponse> => {
  requirePermission('appointments', 'read', principal);
  const organisationId = organisationInScope(principal, requestedOrganisationId);

  return withOrganisationScope(principal, organisationId, 'appointments.availability', (db) =>
    availabilityWithin(db, principal, organisationId, query, now ?? new Date()),
  );
};

/** Exported for the module's own tests, which drive the rules against a real database. */
export const internals = {
  listWithin,
  getWithin,
  bookWithin,
  rescheduleWithin,
  cancelWithin,
  changeStatusWithin,
  agendaWithin,
  availabilityWithin,
};
