import type { AppointmentSource, AppointmentStatus, Weekday } from '@clinicai/shared';
import type { TenantDb } from '../../db/tenant-client.js';
import { uuidV7 } from '../../common/uuid.js';

/**
 * The only place in this module that touches Prisma (apps/api/CLAUDE.md).
 *
 * The slot engine is a pure function that needs five different tables loaded for one day,
 * so a lot of this file is about loading them in as few round trips as the voice tool
 * endpoints' 400 ms budget allows, and about selecting columns rather than rows.
 *
 * EVERY FUNCTION TAKES `organisationId` AND FILTERS ON IT EXPLICITLY. These endpoints are
 * reachable by a platform role reading masked data, and a platform principal runs inside
 * `asSystem`, where the client extension injects nothing and row-level security does not
 * confine the query. Relying on the scope would hand an internal admin every clinic's
 * appointment book. Under a clinic scope the filter is verified rather than trusted.
 */

export type AppointmentRow = {
  readonly id: string;
  readonly patientId: string;
  readonly doctorId: string;
  readonly serviceId: string | null;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly status: AppointmentStatus;
  readonly source: AppointmentSource;
  readonly cancelledAt: Date | null;
  readonly cancellationReason: string | null;
  readonly rescheduledFromId: string | null;
  /** PHI. See the column's note in the schema. */
  readonly notes: string | null;
  /** The listed price when booked. Internal: no response carries it yet. */
  readonly priceMinor: number | null;
  readonly createdAt: Date;
};

const APPOINTMENT_SELECT = {
  id: true,
  patientId: true,
  doctorId: true,
  serviceId: true,
  startAt: true,
  endAt: true,
  status: true,
  source: true,
  cancelledAt: true,
  cancellationReason: true,
  rescheduledFromId: true,
  notes: true,
  priceMinor: true,
  createdAt: true,
} as const;

/** The joined columns a list row shows, which is three names and no more. */
const LIST_SELECT = {
  ...APPOINTMENT_SELECT,
  patient: { select: { id: true, fullName: true, phone: true } },
  doctor: { select: { id: true, fullName: true } },
  service: { select: { id: true, name: true, durationMinutes: true } },
} as const;

export type AppointmentListRow = AppointmentRow & {
  readonly patient: { readonly id: string; readonly fullName: string; readonly phone: string };
  readonly doctor: { readonly id: string; readonly fullName: string };
  readonly service: {
    readonly id: string;
    readonly name: string;
    readonly durationMinutes: number;
  } | null;
};

/**
 * THERE IS NO `notes` COLUMN ON `appointments`, which is why nothing here reads or writes
 * one. The prototype's booking form and detail drawer both show a notes field, so this is a
 * gap rather than a decision: adding the column is an additive migration awaiting sign-off,
 * recorded in `docs/features/clinic-dashboard.md`. Nothing fakes it in the meantime.
 */
export const findById = async (
  db: TenantDb,
  organisationId: string,
  id: string,
): Promise<AppointmentListRow | null> =>
  db.appointment.findFirst({
    where: { id, organisationId },
    select: LIST_SELECT,
  });

export type ListFilters = {
  readonly organisationId: string;
  /**
   * Free text, matched against the PATIENT the appointment names, not the appointment.
   *
   * An appointment has nothing of its own to search: its identifying details are the
   * patient's name and number, which is what a receptionist types while somebody is on the
   * telephone. The service name is deliberately not matched, because "follow-up" would then
   * return every follow-up in the clinic and bury the person being looked for.
   */
  readonly search?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly status?: readonly AppointmentStatus[];
  readonly doctorId?: string;
  readonly patientId?: string;
  readonly cursor?: string;
  readonly take: number;
};

/**
 * A page of appointments, soonest first within the range.
 *
 * ASCENDING, unlike every other list in this application, because this one is a schedule:
 * "the next appointments" is what a clinic reads, and newest-first would put next week
 * above this afternoon. The id tiebreaker keeps the order total for the cursor.
 */
export const list = async (
  db: TenantDb,
  filters: ListFilters,
): Promise<readonly AppointmentListRow[]> => {
  const term = filters.search?.trim() ?? '';
  const digits = term.replace(/[^\d]/g, '');

  return db.appointment.findMany({
    where: {
      organisationId: filters.organisationId,
      /**
       * THE DIGITS CLAUSE IS ONLY INCLUDED WHEN THERE ARE DIGITS, and that is not tidiness.
       *
       * The first version stripped non-digits unconditionally, so a search for a NAME produced
       * `phone: { contains: '' }`, which every phone number contains: the OR then matched every
       * appointment in the clinic, and the screen showed a search that appeared to work and
       * filtered nothing. The test "returns nothing for a term that matches no patient" is what
       * caught it.
       *
       * Two digits is the shortest fragment worth matching. One would bring the whole book back
       * in a subtler way.
       */
      ...(term === ''
        ? {}
        : {
            patient: {
              OR: [
                { fullName: { contains: term, mode: 'insensitive' as const } },
                ...(digits.length >= 2 ? [{ phone: { contains: digits } }] : []),
              ],
            },
          }),
      ...(filters.from === undefined && filters.to === undefined
        ? {}
        : {
            startAt: {
              ...(filters.from === undefined ? {} : { gte: filters.from }),
              ...(filters.to === undefined ? {} : { lt: filters.to }),
            },
          }),
      ...(filters.status === undefined ? {} : { status: { in: [...filters.status] } }),
      ...(filters.doctorId === undefined ? {} : { doctorId: filters.doctorId }),
      ...(filters.patientId === undefined ? {} : { patientId: filters.patientId }),
    },
    select: LIST_SELECT,
    orderBy: [{ startAt: 'asc' }, { id: 'asc' }],
    take: filters.take,
    ...(filters.cursor === undefined ? {} : { cursor: { id: filters.cursor }, skip: 1 }),
  });
};

/**
 * Status counts for a range, in one grouped query rather than one query per status.
 *
 * The agenda shows the counts beside the days, and five separate counts would be five
 * round trips for a number the database can produce in one pass.
 */
export const statusCounts = async (
  db: TenantDb,
  range: {
    readonly organisationId: string;
    readonly from: Date;
    readonly to: Date;
    readonly doctorId?: string;
  },
): Promise<Readonly<Record<AppointmentStatus, number>>> => {
  const rows = await db.appointment.groupBy({
    by: ['status'],
    where: {
      organisationId: range.organisationId,
      startAt: { gte: range.from, lt: range.to },
      ...(range.doctorId === undefined ? {} : { doctorId: range.doctorId }),
    },
    _count: { _all: true },
  });

  const counts: Record<AppointmentStatus, number> = {
    SCHEDULED: 0,
    CONFIRMED: 0,
    COMPLETED: 0,
    CANCELLED: 0,
    NO_SHOW: 0,
  };

  for (const row of rows) {
    counts[row.status] = row._count._all;
  }

  return counts;
};

export type CreateInput = {
  readonly patientId: string;
  readonly doctorId: string;
  readonly serviceId: string;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly status: AppointmentStatus;
  readonly source: AppointmentSource;
  readonly idempotencyKey?: string;
  readonly rescheduledFromId?: string;
  readonly notes?: string | null;
  /** Required, so no path can book without deciding what price the booking was made at. */
  readonly priceMinor: number | null;
};

export const create = async (
  db: TenantDb,
  organisationId: string,
  input: CreateInput,
): Promise<string> => {
  const created = await db.appointment.create({
    data: {
      id: uuidV7(),
      organisationId,
      patientId: input.patientId,
      doctorId: input.doctorId,
      serviceId: input.serviceId,
      startAt: input.startAt,
      endAt: input.endAt,
      status: input.status,
      source: input.source,
      ...(input.idempotencyKey === undefined ? {} : { idempotencyKey: input.idempotencyKey }),
      ...(input.rescheduledFromId === undefined
        ? {}
        : { rescheduledFromId: input.rescheduledFromId }),
      ...(input.notes === undefined ? {} : { notes: input.notes }),
      priceMinor: input.priceMinor,
    },
    select: { id: true },
  });

  return created.id;
};

/** An earlier result for the same `Idempotency-Key`, if this clinic has seen it. */
export const findByIdempotencyKey = async (
  db: TenantDb,
  organisationId: string,
  idempotencyKey: string,
): Promise<AppointmentRow | null> =>
  db.appointment.findFirst({
    where: { organisationId, idempotencyKey },
    select: APPOINTMENT_SELECT,
  });

/**
 * Moves an appointment to a new status, ONLY IF it is still in the status that was read.
 *
 * `where` carries the expected current status, which makes this a compare-and-set rather
 * than a write: two people pressing "cancel" and "mark completed" at the same moment both
 * read SCHEDULED, and without the guard the second write would silently overwrite the
 * first. The service turns a zero count into a 409 that says the appointment moved on.
 */
export const changeStatus = async (
  db: TenantDb,
  organisationId: string,
  id: string,
  from: AppointmentStatus,
  to: AppointmentStatus,
  cancellation?: { readonly cancelledAt: Date; readonly reason: string | null },
): Promise<number> =>
  (
    await db.appointment.updateMany({
      where: { id, organisationId, status: from },
      data: {
        status: to,
        ...(cancellation === undefined
          ? {}
          : { cancelledAt: cancellation.cancelledAt, cancellationReason: cancellation.reason }),
      },
    })
  ).count;

/**
 * Whether an error is the no-overlap exclusion constraint refusing a double booking.
 *
 * HERE RATHER THAN IN THE SERVICE because recognising it means knowing the driver's error
 * shape, which apps/api/CLAUDE.md keeps inside the repository.
 *
 * SEVERAL PLACES ARE CHECKED ON PURPOSE. Prisma maps unique violations to `P2002` and does
 * not map exclusion violations at all, so a `23P01` arrives as an unmapped known-request
 * error, as an unknown-request error, or wrapped with the SQLSTATE only in the message,
 * depending on the driver path. Matching one of those shapes and missing the others would
 * turn a double booking into a 500, which is exactly the outcome the feature brief forbids.
 */
export const isSlotTakenError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null) {
    return false;
  }

  const candidate = error as {
    readonly code?: unknown;
    readonly message?: unknown;
    readonly meta?: { readonly code?: unknown; readonly message?: unknown };
    readonly cause?: unknown;
  };

  if (candidate.code === '23P01' || candidate.meta?.code === '23P01') {
    return true;
  }

  const text = [candidate.message, candidate.meta?.message]
    .filter((value): value is string => typeof value === 'string')
    .join(' ');

  if (text.includes('23P01') || text.includes('appointments_no_overlap')) {
    return true;
  }

  return candidate.cause === undefined ? false : isSlotTakenError(candidate.cause);
};

// ─── What the slot engine needs loaded ──────────────────────────────────────────

export type SlotInputs = {
  readonly organisation: { readonly timezone: string; readonly hoursCollected: boolean };
  readonly service: {
    readonly id: string;
    readonly durationMinutes: number;
    readonly priceMinor: number | null;
  } | null;
  readonly doctor: { readonly id: string; readonly bufferMinutes: number } | null;
  readonly policy: {
    readonly slotGranularityMinutes: number | null;
    readonly minimumNoticeMinutes: number | null;
    readonly maximumAdvanceDays: number | null;
    readonly defaultBufferMinutes: number | null;
    readonly maxPerSlot: number | null;
  } | null;
  readonly clinicHours: readonly {
    readonly weekday: Weekday;
    readonly opensAtMinute: number;
    readonly closesAtMinute: number;
  }[];
  readonly doctorWorkingHours: readonly {
    readonly weekday: Weekday;
    readonly startAtMinute: number;
    readonly endAtMinute: number;
  }[];
};

/**
 * Everything the slot engine needs except the day's appointments and time off.
 *
 * SIX READS IN ONE ROUND TRIP, through `$transaction` with an array, because the voice tool
 * endpoints have a 400 ms budget at the 95th percentile and six sequential awaits over a
 * network is six times the latency of one. They are all reads, so the transaction is only
 * doing the batching.
 */
export const slotInputs = async (
  db: TenantDb,
  organisationId: string,
  doctorId: string,
  serviceId: string,
): Promise<SlotInputs> => {
  const [organisation, service, doctor, policy, clinicHours, doctorWorkingHours] =
    await db.$transaction([
      db.organisation.findUnique({
        where: { id: organisationId },
        select: { timezone: true, openingHoursCollectedAt: true },
      }),
      db.service.findFirst({
        where: { id: serviceId, organisationId, active: true, deletedAt: null },
        select: { id: true, durationMinutes: true, priceMinor: true },
      }),
      db.doctor.findFirst({
        where: { id: doctorId, organisationId, active: true, deletedAt: null },
        select: { id: true, bufferMinutes: true },
      }),
      db.clinicBookingPolicy.findUnique({
        where: { organisationId },
        select: {
          slotGranularityMinutes: true,
          minimumNoticeMinutes: true,
          maximumAdvanceDays: true,
          defaultBufferMinutes: true,
          maxPerSlot: true,
        },
      }),
      db.clinicHours.findMany({
        where: { organisationId },
        select: { weekday: true, opensAtMinute: true, closesAtMinute: true },
      }),
      db.doctorWorkingHours.findMany({
        where: { organisationId, doctorId },
        select: { weekday: true, startAtMinute: true, endAtMinute: true },
      }),
    ]);

  return {
    organisation: {
      timezone: organisation?.timezone ?? 'UTC',
      hoursCollected: organisation?.openingHoursCollectedAt !== null,
    },
    service,
    doctor,
    policy,
    clinicHours,
    doctorWorkingHours,
  };
};

/**
 * The slot-holding appointments and the time off that overlap a window.
 *
 * The window is a day widened by the buffer on both sides, so an appointment that ends just
 * before midnight still blocks the first slot of the next morning.
 */
export const dayOccupancy = async (
  db: TenantDb,
  organisationId: string,
  doctorId: string,
  from: Date,
  to: Date,
  excludeAppointmentId?: string,
): Promise<{
  readonly appointments: readonly { readonly startAt: Date; readonly endAt: Date }[];
  readonly timeOff: readonly { readonly startAt: Date; readonly endAt: Date }[];
}> => {
  const [appointments, timeOff] = await db.$transaction([
    db.appointment.findMany({
      where: {
        organisationId,
        doctorId,
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        startAt: { lt: to },
        endAt: { gt: from },
        ...(excludeAppointmentId === undefined ? {} : { id: { not: excludeAppointmentId } }),
      },
      select: { startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    }),
    db.doctorTimeOff.findMany({
      where: { organisationId, doctorId, startAt: { lt: to }, endAt: { gt: from } },
      select: { startAt: true, endAt: true },
      orderBy: { startAt: 'asc' },
    }),
  ]);

  return { appointments, timeOff };
};

/** The patient, doctor and service a booking names, checked in one round trip. */
export const bookingTargets = async (
  db: TenantDb,
  organisationId: string,
  patientId: string,
  doctorId: string,
  serviceId: string,
): Promise<{
  readonly patientExists: boolean;
  readonly doctorExists: boolean;
  readonly service: { readonly durationMinutes: number } | null;
}> => {
  const [patient, doctor, service] = await db.$transaction([
    db.patient.findFirst({
      where: { id: patientId, organisationId, deletedAt: null },
      select: { id: true },
    }),
    db.doctor.findFirst({
      where: { id: doctorId, organisationId, active: true, deletedAt: null },
      select: { id: true },
    }),
    db.service.findFirst({
      where: { id: serviceId, organisationId, active: true, deletedAt: null },
      select: { durationMinutes: true },
    }),
  ]);

  return {
    patientExists: patient !== null,
    doctorExists: doctor !== null,
    service,
  };
};

/** The clinic's time zone, which every date on every screen is rendered in. */
export const organisationTimeZone = async (
  db: TenantDb,
  organisationId: string,
): Promise<string> => {
  const organisation = await db.organisation.findUnique({
    where: { id: organisationId },
    select: { timezone: true },
  });

  if (organisation === null) {
    // Unreachable through a tenant-scoped route, where the organisation is the caller's
    // own. Throwing rather than defaulting, because a wrong zone silently shifts every
    // time on the screen and a missing clinic is a bug, not a state to render.
    throw new Error(`organisation ${organisationId} not found while reading its time zone`);
  }

  return organisation.timezone;
};
