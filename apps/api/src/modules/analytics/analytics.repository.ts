import type { TenantDb } from '../../db/tenant-client.js';

/**
 * The only place in the analytics module that touches Prisma (apps/api/CLAUDE.md).
 *
 * ─── ROWS, AGGREGATED IN THE SERVICE, BOUNDED HERE ──────────────────────────────
 *
 * Every figure on the overview is bucketed by the CLINIC's day, which is a time-zone
 * question PostgreSQL can answer only through raw SQL, and raw SQL on a tenant table is
 * something the isolation suite enumerates and refuses by default. So the narrowest possible
 * rows are read with the ordinary client, under the ordinary tenant scope, and summed in the
 * service.
 *
 * The cap is what keeps that honest. 20,000 rows is far more than a clinic produces in the
 * widest range the screen offers (a month), and a clinic that ever exceeded it would see a
 * figure that undercounts rather than a query that takes the database down.
 */
const ROW_CAP = 20_000;

export type AppointmentFact = {
  readonly createdAt: Date;
  readonly source: string;
  readonly status: string;
  readonly priceMinor: number | null;
};

/** Appointments CREATED in `[from, to)`: a booking is counted when it was made. */
export const appointmentsCreated = async (
  db: TenantDb,
  organisationId: string,
  from: Date,
  to: Date,
  doctorId: string | undefined,
): Promise<readonly AppointmentFact[]> => {
  const rows = await db.appointment.findMany({
    where: {
      organisationId,
      createdAt: { gte: from, lt: to },
      ...(doctorId === undefined ? {} : { doctorId }),
    },
    select: {
      createdAt: true,
      source: true,
      status: true,
      service: { select: { priceMinor: true } },
    },
    take: ROW_CAP,
  });

  return rows.map((row) => ({
    createdAt: row.createdAt,
    source: row.source,
    status: row.status,
    priceMinor: row.service?.priceMinor ?? null,
  }));
};

export type CallFact = {
  readonly at: Date;
  readonly status: string;
  readonly direction: string;
  readonly outcome: string;
};

/**
 * Calls that began in `[from, to)`.
 *
 * `startedAt` is null for an event that arrived without one, so `createdAt` stands in, and
 * the window is applied to whichever the row has. A DOCTOR sees the calls attached to their
 * own appointments, which is what `own` means for `call_history` too.
 */
export const callsBetween = async (
  db: TenantDb,
  organisationId: string,
  from: Date,
  to: Date,
  doctorId: string | undefined,
): Promise<readonly CallFact[]> => {
  const rows = await db.call.findMany({
    where: {
      organisationId,
      OR: [
        { startedAt: { gte: from, lt: to } },
        { startedAt: null, createdAt: { gte: from, lt: to } },
      ],
      ...(doctorId === undefined ? {} : { appointment: { doctorId } }),
    },
    select: { startedAt: true, createdAt: true, status: true, direction: true, outcome: true },
    take: ROW_CAP,
  });

  return rows.map((row) => ({
    at: row.startedAt ?? row.createdAt,
    status: row.status,
    direction: row.direction,
    outcome: row.outcome,
  }));
};

/** Upcoming appointments still awaiting confirmation, with when each request arrived. */
export const pendingRequests = async (
  db: TenantDb,
  organisationId: string,
  now: Date,
  doctorId: string | undefined,
): Promise<readonly { readonly createdAt: Date }[]> =>
  db.appointment.findMany({
    where: {
      organisationId,
      status: 'SCHEDULED',
      startAt: { gte: now },
      ...(doctorId === undefined ? {} : { doctorId }),
    },
    select: { createdAt: true },
    take: ROW_CAP,
  });

/**
 * When the clinic last took a call. The agent's STATE is not here: it is worked out once, from
 * every part it needs, on the clinic itself (`voiceAgentStatus`), and this endpoint returning
 * the bare row status beside it is how a screen came to show an unconfigured agent as live.
 */
export const agentSnapshot = async (
  db: TenantDb,
  organisationId: string,
): Promise<{ readonly lastCallAt: Date | null }> => {
  const last = await db.call.findFirst({
    where: { organisationId },
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    select: { startedAt: true, createdAt: true },
  });

  return { lastCallAt: last === null ? null : (last.startedAt ?? last.createdAt) };
};

/** The doctor row behind a DOCTOR user, for the `own` scope. */
export const doctorIdForUser = async (
  db: TenantDb,
  organisationId: string,
  userId: string,
): Promise<string | null> => {
  const doctor = await db.doctor.findFirst({
    where: { organisationId, userId, deletedAt: null },
    select: { id: true },
  });

  return doctor?.id ?? null;
};
