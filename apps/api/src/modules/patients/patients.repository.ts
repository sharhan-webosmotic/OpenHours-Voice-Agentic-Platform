import type { AppointmentSource, AppointmentStatus } from '@clinicai/shared';
import type { TenantDb } from '../../db/tenant-client.js';
import { uuidV7 } from '../../common/uuid.js';

/**
 * The only place in this module that touches Prisma (apps/api/CLAUDE.md).
 *
 * NO PERMISSION CHECKS HERE, and no decision about masking: the service resolves the scope
 * and this layer is handed a filter. What it does guarantee is that no query here is
 * unbounded and that every one selects columns rather than rows: `select` is spelled out on
 * every call, so adding a column to the schema never silently adds it to a response.
 *
 * EVERY FUNCTION TAKES `organisationId` AND FILTERS ON IT EXPLICITLY, which is not
 * belt-and-braces. These endpoints are reachable by a platform role, whose matrix cell is
 * `read: 'masked'`, and a platform principal runs inside `asSystem`, where the client
 * extension injects NOTHING and row-level security does not confine the query. A read that
 * relied on the scope alone would hand an internal admin every clinic's patients. Under a
 * clinic scope the same filter is VERIFIED against the active tenant rather than trusted, so
 * a foreign id raises `CrossTenantWriteError` instead of reaching another clinic's rows.
 */

export type PatientRow = {
  readonly id: string;
  readonly fullName: string;
  readonly phone: string;
  readonly dateOfBirth: Date | null;
  readonly notes: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

const PATIENT_SELECT = {
  id: true,
  fullName: true,
  phone: true,
  dateOfBirth: true,
  notes: true,
  createdAt: true,
  updatedAt: true,
} as const;

/**
 * One patient by id, or null when it does not exist, is deleted, or belongs elsewhere.
 *
 * All three cases are deliberately indistinguishable from the caller's side, which is root
 * CLAUDE.md rule 7: a 403 for another clinic's id would confirm that the id exists.
 */
export const findById = async (
  db: TenantDb,
  organisationId: string,
  id: string,
): Promise<PatientRow | null> =>
  db.patient.findFirst({
    where: { id, organisationId, deletedAt: null },
    select: PATIENT_SELECT,
  });

/**
 * Every patient whose stored number is exactly `phone`, newest first.
 *
 * FOR THE VOICE AGENT, where the number comes from the telephone network rather than from
 * somebody typing, so it is complete and an EQUALITY match uses the
 * `(organisation_id, phone)` index. The dashboard's search deliberately does the opposite,
 * a `contains` on digits, because a receptionist types fragments. Two different reads for
 * two genuinely different inputs: the fragment search would scan, on a path with a 400 ms
 * budget, to answer a question the exact number already answers.
 *
 * RETURNS A LIST, NOT A ROW, and the caller must handle more than one. `phone` is not
 * unique on purpose: a family shares a number. Picking the first match would book one
 * person's appointment under their relative's name, so the agent asks for a name instead.
 *
 * Bounded at five. A sixth record on one number is a data-quality problem for a human, not
 * something to read out on a call.
 */
export const findByExactPhone = async (
  db: TenantDb,
  organisationId: string,
  phone: string,
): Promise<readonly PatientRow[]> =>
  db.patient.findMany({
    where: { organisationId, phone, deletedAt: null },
    select: PATIENT_SELECT,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: 5,
  });

export type ListFilters = {
  readonly organisationId: string;
  readonly search?: string;
  readonly cursor?: string;
  readonly take: number;
  readonly sort: 'recent' | 'name';
  /** Set for a DOCTOR, whose matrix scope is `own`: only patients they have seen. */
  readonly onlyForDoctorId?: string;
};

/**
 * A page of patients.
 *
 * THE SEARCH MATCHES NAME OR PHONE, because those are the two things a receptionist has in
 * front of them while a patient is on the telephone. `mode: 'insensitive'` on the name needs
 * the trigram index that M1-06 owes; the phone match is a prefix so it uses the existing
 * `(organisation_id, phone)` index rather than scanning.
 *
 * THE CURSOR IS THE ID AND THE SORT ALWAYS ENDS WITH IT. `createdAt` is not unique: two
 * patients registered in the same millisecond would make a cursor page skip or repeat a row,
 * and the id tiebreaker is what makes the order total.
 */
export const list = async (db: TenantDb, filters: ListFilters): Promise<readonly PatientRow[]> => {
  const search = filters.search?.trim();

  return db.patient.findMany({
    where: {
      organisationId: filters.organisationId,
      deletedAt: null,
      ...(search === undefined || search === ''
        ? {}
        : {
            OR: [
              { fullName: { contains: search, mode: 'insensitive' as const } },
              { phone: { contains: phoneDigits(search) } },
            ],
          }),
      ...(filters.onlyForDoctorId === undefined
        ? {}
        : { appointments: { some: { doctorId: filters.onlyForDoctorId } } }),
    },
    select: PATIENT_SELECT,
    orderBy:
      filters.sort === 'name'
        ? [{ fullName: 'asc' }, { id: 'asc' }]
        : [{ createdAt: 'desc' }, { id: 'desc' }],
    take: filters.take,
    ...(filters.cursor === undefined ? {} : { cursor: { id: filters.cursor }, skip: 1 }),
  });
};

/**
 * The digits of whatever someone typed, for matching inside a stored E.164 number.
 *
 * `contains` RATHER THAN `startsWith`, and that is not a detail. Numbers are stored as
 * `+919876543210`, and a receptionist with a patient on the telephone types `98765`, or the
 * last five digits, or the number with spaces in it. A prefix match finds none of those,
 * because every stored value starts with the country code: it looked right and found nothing,
 * which the suite caught.
 *
 * The cost is honest: `contains` cannot use the `(organisation_id, phone)` b-tree index, so
 * this leans on the same trigram index M1-06 owes for the name search. For one clinic's
 * patient list that is a small sequential scan today, and the alternative, a search that does
 * not find the patient who is on the line, is not a trade worth making.
 *
 * The shared normaliser is deliberately not used: it needs a COMPLETE number and refuses a
 * partial one, which is exactly what a search box holds.
 */
const phoneDigits = (search: string): string => search.replace(/[^\d]/g, '');

export type CreateInput = {
  readonly fullName: string;
  readonly phone: string;
  readonly dateOfBirth: Date | null;
  readonly notes: string | null;
};

/**
 * `organisationId` is passed explicitly, as every create in this repository does.
 *
 * The tenant client extension VERIFIES it against the active scope rather than trusting it,
 * so a mismatch raises `CrossTenantWriteError` instead of writing into another clinic. The
 * service passes the value from the verified token, never from the request body.
 */
export const create = async (
  db: TenantDb,
  organisationId: string,
  input: CreateInput,
): Promise<string> => {
  const created = await db.patient.create({
    data: {
      // uuid v7, so the primary key is time-ordered and the index does not fragment.
      id: uuidV7(),
      organisationId,
      fullName: input.fullName,
      phone: input.phone,
      dateOfBirth: input.dateOfBirth,
      notes: input.notes,
    },
    select: { id: true },
  });

  return created.id;
};

export type UpdateInput = {
  readonly fullName?: string;
  readonly phone?: string;
  readonly dateOfBirth?: Date | null;
  readonly notes?: string | null;
};

/**
 * Applies a partial update.
 *
 * `updateMany` rather than `update`, and the difference matters: `update` on a row that row
 * level security hides raises an error naming the record, while `updateMany` affects zero
 * rows. The service turns zero rows into a 404.
 */
export const update = async (
  db: TenantDb,
  organisationId: string,
  id: string,
  input: UpdateInput,
): Promise<number> => {
  const result = await db.patient.updateMany({
    where: { id, organisationId, deletedAt: null },
    data: input,
  });

  return result.count;
};

export type AppointmentHistoryRow = {
  readonly id: string;
  readonly startAt: Date;
  readonly endAt: Date;
  readonly status: AppointmentStatus;
  readonly source: AppointmentSource;
  readonly doctor: { readonly fullName: string };
  readonly service: { readonly name: string } | null;
};

/**
 * A patient's appointments, newest first, bounded.
 *
 * The bound is not a page size the caller chooses, because this is a panel on a profile
 * rather than a list anybody pages through. A patient with twelve years of visits must not
 * turn their profile into a thousand-row response.
 */
export const appointmentHistory = async (
  db: TenantDb,
  organisationId: string,
  patientId: string,
  take: number,
): Promise<readonly AppointmentHistoryRow[]> =>
  db.appointment.findMany({
    where: { patientId, organisationId },
    select: {
      id: true,
      startAt: true,
      endAt: true,
      status: true,
      source: true,
      doctor: { select: { fullName: true } },
      service: { select: { name: true } },
    },
    orderBy: [{ startAt: 'desc' }, { id: 'desc' }],
    take,
  });

export type NextAppointment = {
  readonly startAt: Date;
  readonly status: AppointmentStatus;
  readonly source: AppointmentSource;
  readonly serviceName: string | null;
};

export type AppointmentBounds = {
  readonly patientId: string;
  readonly lastAppointmentAt: Date | null;
  readonly nextAppointmentAt: Date | null;
  /** The upcoming visit itself, so a list row can say what and in which state. */
  readonly next: NextAppointment | null;
};

/**
 * The newest past appointment and the next upcoming one, for a page of patients at once.
 *
 * ONE QUERY FOR THE WHOLE PAGE, NOT ONE PER PATIENT. The list shows both columns for every
 * row, and the obvious implementation is two queries inside a loop, which is fifty queries
 * for a page of twenty-five. This groups instead.
 *
 * A cancelled appointment still counts as the last one: it happened in the clinic's history
 * even though the visit did not. Only the NEXT one filters to the statuses that still hold a
 * slot, because an upcoming cancelled appointment is not something to show as "next".
 */
export const appointmentBounds = async (
  db: TenantDb,
  organisationId: string,
  patientIds: readonly string[],
  now: Date,
): Promise<readonly AppointmentBounds[]> => {
  if (patientIds.length === 0) {
    return [];
  }

  const [past, upcoming] = await Promise.all([
    db.appointment.groupBy({
      by: ['patientId'],
      where: { organisationId, patientId: { in: [...patientIds] }, startAt: { lt: now } },
      _max: { startAt: true },
    }),
    /**
     * The next visit as a row rather than a `_min`, because the list shows its service and
     * status too. `distinct` on the patient after ordering by start keeps the earliest per
     * patient, still one query for the page.
     */
    db.appointment.findMany({
      where: {
        organisationId,
        patientId: { in: [...patientIds] },
        startAt: { gte: now },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
      },
      select: {
        patientId: true,
        startAt: true,
        status: true,
        source: true,
        service: { select: { name: true } },
      },
      orderBy: [{ patientId: 'asc' }, { startAt: 'asc' }, { id: 'asc' }],
      distinct: ['patientId'],
    }),
  ]);

  const lastByPatient = new Map(past.map((row) => [row.patientId, row._max.startAt]));
  const nextByPatient = new Map(
    upcoming.map((row) => [
      row.patientId,
      {
        startAt: row.startAt,
        status: row.status,
        source: row.source,
        serviceName: row.service?.name ?? null,
      },
    ]),
  );

  return patientIds.map((patientId) => {
    const next = nextByPatient.get(patientId) ?? null;

    return {
      patientId,
      lastAppointmentAt: lastByPatient.get(patientId) ?? null,
      nextAppointmentAt: next?.startAt ?? null,
      next,
    };
  });
};

/** Whether this doctor has ever seen this patient. The `own` scope's gate for a DOCTOR. */
/**
 * How many patients the clinic holds and how many visits are still to come, for the
 * directory's header.
 *
 * Two counts, both on `organisation_id`-led indexes, and the doctor scope narrows both the
 * same way the list does: a doctor counts the patients they have seen and their own visits,
 * never the clinic's.
 */
export const directorySummary = async (
  db: TenantDb,
  organisationId: string,
  now: Date,
  onlyForDoctorId: string | undefined,
): Promise<{ readonly registered: number; readonly upcomingVisits: number }> => {
  const [registered, upcomingVisits] = await Promise.all([
    db.patient.count({
      where: {
        organisationId,
        deletedAt: null,
        ...(onlyForDoctorId === undefined
          ? {}
          : { appointments: { some: { doctorId: onlyForDoctorId } } }),
      },
    }),
    db.appointment.count({
      where: {
        organisationId,
        startAt: { gte: now },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        patient: { deletedAt: null },
        ...(onlyForDoctorId === undefined ? {} : { doctorId: onlyForDoctorId }),
      },
    }),
  ]);

  return { registered, upcomingVisits };
};

export const doctorHasSeenPatient = async (
  db: TenantDb,
  organisationId: string,
  doctorId: string,
  patientId: string,
): Promise<boolean> =>
  (await db.appointment.count({ where: { organisationId, doctorId, patientId }, take: 1 })) > 0;

/**
 * The doctor row that belongs to a DOCTOR-role login, if one is linked.
 *
 * `undefined` rather than null for "no profile", so the service's fail-closed branch reads
 * as the distinct case it is: a DOCTOR login with no doctor row sees no patients, and the
 * scope filter must not quietly disappear.
 */
export const findDoctorIdForUser = async (
  db: TenantDb,
  organisationId: string,
  userId: string,
): Promise<string | undefined> => {
  const doctor = await db.doctor.findFirst({
    where: { userId, organisationId, deletedAt: null },
    select: { id: true },
  });

  return doctor?.id;
};
