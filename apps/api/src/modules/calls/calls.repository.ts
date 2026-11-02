import type { TenantDb } from '../../db/tenant-client.js';
import type {
  CallDirection,
  CallStatus,
  CallTranscriptRole,
} from '../../generated/prisma/enums.js';

/**
 * The only place in the calls module that touches Prisma (apps/api/CLAUDE.md).
 *
 * It serves two callers with different shapes of need: the ingestion jobs, which write what
 * the provider told us, and the dashboard, which reads it. Both are here rather than in two
 * repositories over one table, because a second repository is how two different ideas of what
 * a call row means get built.
 */

export type CallRow = {
  readonly id: string;
  readonly externalCallId: string;
  readonly direction: CallDirection;
  readonly status: CallStatus;
  readonly outcome: string;
  readonly fromE164: string;
  readonly toE164: string;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly durationSeconds: number | null;
  readonly recordingKey: string | null;
  readonly patient: { readonly id: string; readonly fullName: string } | null;
  readonly appointmentId: string | null;
  readonly createdAt: Date;
};

const CALL_SELECT = {
  id: true,
  externalCallId: true,
  direction: true,
  status: true,
  outcome: true,
  fromE164: true,
  toE164: true,
  startedAt: true,
  endedAt: true,
  durationSeconds: true,
  recordingKey: true,
  appointmentId: true,
  createdAt: true,
  patient: { select: { id: true, fullName: true } },
} as const;

export type UpsertCallInput = {
  readonly id: string;
  readonly externalCallId: string;
  readonly direction: CallDirection;
  readonly status: CallStatus;
  readonly fromE164: string;
  readonly toE164: string;
  readonly startedAt: Date | null;
  readonly endedAt: Date | null;
  readonly durationSeconds: number | null;
  readonly patientId: string | null;
};

/**
 * Writes a call the provider told us about, once.
 *
 * IDEMPOTENT ON `(provider, external_call_id)`, which is the unique index and therefore the
 * actual control rather than a check in the job. A repeat webhook, a replayed event and the
 * catch-up job finding the same interaction all land here, and all three must leave one row.
 *
 * ON UPDATE IT FILLS GAPS AND DOES NOT OVERWRITE: a second delivery that carries no duration
 * must not blank the duration the first one brought. `recordingKey` is never touched here,
 * because the recording job owns it and runs later.
 */
export const upsertFromProvider = async (
  db: TenantDb,
  organisationId: string,
  input: UpsertCallInput,
): Promise<{
  readonly id: string;
  readonly created: boolean;
  /** True when the provider's id already belongs to another clinic. See the note below. */
  readonly claimedElsewhere?: boolean;
}> => {
  const existing = await db.call.findFirst({
    where: { organisationId, provider: 'SARVAM', externalCallId: input.externalCallId },
    select: { id: true },
  });

  if (existing !== null) {
    await db.call.update({
      where: { id: existing.id },
      data: {
        status: input.status,
        ...(input.startedAt === null ? {} : { startedAt: input.startedAt }),
        ...(input.endedAt === null ? {} : { endedAt: input.endedAt }),
        ...(input.durationSeconds === null ? {} : { durationSeconds: input.durationSeconds }),
        ...(input.patientId === null ? {} : { patientId: input.patientId }),
      },
    });

    return { id: existing.id, created: false };
  }

  /**
   * `createMany` with `skipDuplicates`, NOT `create`.
   *
   * `calls` is unique on `(provider, external_call_id)` ACROSS THE WHOLE PLATFORM, not per
   * clinic, which is correct: a provider's interaction id identifies one conversation, so the
   * same id cannot belong to two clinics. The lookup above is scoped to this organisation,
   * so it finds nothing when the row exists under a DIFFERENT one, and `create` then threw a
   * unique violation. In a job that means six retries and a stuck event, for a condition no
   * retry can change.
   *
   * Skipping the duplicate turns that into a no-op this function reports honestly. A test
   * found it, with a stub that answered the same interaction for every clinic.
   */
  const inserted = await db.call.createMany({
    data: [
      {
        id: input.id,
        organisationId,
        provider: 'SARVAM',
        externalCallId: input.externalCallId,
        direction: input.direction,
        status: input.status,
        fromE164: input.fromE164,
        toE164: input.toE164,
        startedAt: input.startedAt,
        endedAt: input.endedAt,
        durationSeconds: input.durationSeconds,
        patientId: input.patientId,
      },
    ],
    skipDuplicates: true,
  });

  if (inserted.count === 1) {
    return { id: input.id, created: true };
  }

  /**
   * The id exists under another clinic. Not ours to read, not ours to change, and not a
   * failure to retry: the caller reports it and the oddity is visible in the log.
   */
  return { id: input.id, created: false, claimedElsewhere: true };
};

/**
 * Replaces a call's transcript turns with these.
 *
 * REPLACES rather than appends, so a re-ingest is idempotent: the unique index on
 * `(call_id, turn_index)` would refuse a second copy anyway, and deleting first means a
 * transcript that arrived empty and was fetched again later is simply correct.
 *
 * `calls.transcript` is written with the plain-text rendering in the same transaction, which
 * is what an export or a search wants and what a reader sees if the turns are missing.
 */
export const replaceTranscript = async (
  db: TenantDb,
  organisationId: string,
  callId: string,
  turns: readonly { readonly role: CallTranscriptRole; readonly text: string }[],
  plainText: string,
  newId: () => string,
): Promise<void> => {
  await db.callTranscriptTurn.deleteMany({ where: { organisationId, callId } });

  if (turns.length > 0) {
    await db.callTranscriptTurn.createMany({
      data: turns.map((turn, index) => ({
        id: newId(),
        organisationId,
        callId,
        turnIndex: index,
        role: turn.role,
        text: turn.text,
      })),
    });
  }

  await db.call.update({
    where: { id: callId },
    data: { transcript: plainText === '' ? null : plainText },
  });
};

export const setRecordingKey = async (
  db: TenantDb,
  organisationId: string,
  callId: string,
  recordingKey: string,
): Promise<void> => {
  // Scoped by organisation as well as id: `update` takes a unique where, and a call id from
  // a job payload is not something to trust on its own.
  await db.call.updateMany({ where: { id: callId, organisationId }, data: { recordingKey } });
};

export type ListFilters = {
  readonly organisationId: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly direction?: CallDirection;
  readonly status?: readonly CallStatus[];
  /** Matched against the CALLER's number, digits only, as the dashboard's search does. */
  readonly search?: string;
  readonly cursor?: string;
  /**
   * Set for a DOCTOR, whose matrix scope on `call_history` is `own`.
   *
   * Own means a call attached to one of their own appointments. A call with no appointment is
   * deliberately not theirs: nothing about it says it concerns them.
   */
  readonly ownDoctorId?: string;
  readonly take: number;
};

/**
 * A page of calls, newest first.
 *
 * NEWEST FIRST, unlike the appointment list: a call history is a log, and the call that just
 * came in is the one reception is looking for. `startedAt` can be null for an event that
 * arrived without one, so `createdAt` is the sort key with the id as the tiebreaker, which
 * keeps the cursor total.
 */
export const list = async (db: TenantDb, filters: ListFilters): Promise<readonly CallRow[]> => {
  const digits = (filters.search ?? '').replace(/[^\d]/g, '');

  return db.call.findMany({
    where: {
      organisationId: filters.organisationId,
      ...(filters.direction === undefined ? {} : { direction: filters.direction }),
      ...(filters.status === undefined || filters.status.length === 0
        ? {}
        : { status: { in: [...filters.status] } }),
      ...(filters.from === undefined && filters.to === undefined
        ? {}
        : {
            startedAt: {
              ...(filters.from === undefined ? {} : { gte: filters.from }),
              ...(filters.to === undefined ? {} : { lt: filters.to }),
            },
          }),
      ...(filters.ownDoctorId === undefined
        ? {}
        : { appointment: { doctorId: filters.ownDoctorId } }),
      ...(digits.length < 2
        ? {}
        : {
            // The caller's number, not the clinic's: every row shares the agent number, so
            // matching both would return the whole table for any fragment of it.
            fromE164: { contains: digits },
          }),
    },
    select: CALL_SELECT,
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: filters.take,
    ...(filters.cursor === undefined ? {} : { cursor: { id: filters.cursor }, skip: 1 }),
  });
};

export const findById = async (
  db: TenantDb,
  organisationId: string,
  id: string,
): Promise<CallRow | null> =>
  db.call.findFirst({ where: { id, organisationId }, select: CALL_SELECT });

export type TranscriptTurnRow = {
  readonly role: CallTranscriptRole;
  readonly text: string;
};

export const transcriptFor = async (
  db: TenantDb,
  organisationId: string,
  callId: string,
): Promise<readonly TranscriptTurnRow[]> =>
  db.callTranscriptTurn.findMany({
    where: { organisationId, callId },
    select: { role: true, text: true },
    orderBy: [{ turnIndex: 'asc' }],
    // A long call is a few hundred turns. The bound stops one malformed ingest from
    // returning an unbounded response.
    take: 1_000,
  });

/**
 * The one patient whose number is exactly this, or null when it is none or several.
 *
 * NULL FOR SEVERAL IS THE POINT, and the schema says so where `calls.patient_id` is defined:
 * a family shares a number, so linking a call to whichever record sorted first would attach
 * one person's call to another person's history. The dashboard shows the number instead, and
 * a human can link it.
 */
export const solePatientByPhone = async (
  db: TenantDb,
  organisationId: string,
  phone: string,
): Promise<string | null> => {
  if (phone === '') {
    return null;
  }

  const rows = await db.patient.findMany({
    where: { organisationId, phone, deletedAt: null },
    select: { id: true },
    take: 2,
  });

  return rows.length === 1 ? (rows[0]?.id ?? null) : null;
};
