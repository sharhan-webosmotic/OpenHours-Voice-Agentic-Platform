import type { TenantDb } from '../db/tenant-client.js';

/**
 * The only place in the voice module that touches Prisma (apps/api/CLAUDE.md).
 *
 * Everything here is read on the hot path of a live telephone call, so each function is one
 * query with an explicit `select` and an index behind it.
 */

export type AgentCredentialRow = {
  readonly id: string;
  readonly organisationId: string;
  readonly toolSecretHash: string | null;
  readonly status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  readonly organisationStatus: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED';
  readonly sarvamAppId: string | null;
};

/**
 * The agent whose tool secret hashes to `hash`, or null.
 *
 * Reads ACROSS tenants by necessity: this is the query that decides which tenant the caller
 * is, so it cannot be filtered by one. It is therefore deliberately narrow. It selects the
 * credential and the two status fields and nothing else, matches on a unique index, and is
 * the single call site of `asAuthenticator`.
 *
 * The organisation's status is joined rather than read in a second query, because a
 * deactivated clinic must not be served and a second round trip would be spent on every
 * call to learn it.
 */
export const findAgentBySecretHash = async (
  db: TenantDb,
  hash: string,
): Promise<AgentCredentialRow | null> => {
  const row = await db.voiceAgent.findUnique({
    where: { toolSecretHash: hash },
    select: {
      id: true,
      organisationId: true,
      toolSecretHash: true,
      status: true,
      sarvamAppId: true,
      organisation: { select: { status: true } },
    },
  });

  return row === null
    ? null
    : {
        id: row.id,
        organisationId: row.organisationId,
        toolSecretHash: row.toolSecretHash,
        status: row.status,
        organisationStatus: row.organisation.status,
        sarvamAppId: row.sarvamAppId,
      };
};

export type ResolvableTargets = {
  readonly doctors: readonly { readonly id: string; readonly fullName: string }[];
  readonly services: readonly {
    readonly id: string;
    readonly name: string;
    readonly durationMinutes: number;
    readonly priceMinor: number | null;
  }[];
};

/**
 * The clinic's active doctors and services, for resolving what a patient said into an id.
 *
 * TWO READS IN ONE ROUND TRIP, and both bounded. A clinic with more than fifty active
 * services is not a clinic the agent can read a list from anyway, and an unbounded query on
 * a 400 ms path is the thing `performance-optimisation` forbids.
 */
export const resolvableTargets = async (
  db: TenantDb,
  organisationId: string,
): Promise<ResolvableTargets> => {
  const [doctors, services] = await db.$transaction([
    db.doctor.findMany({
      where: { organisationId, active: true, deletedAt: null },
      select: { id: true, fullName: true },
      orderBy: [{ fullName: 'asc' }, { id: 'asc' }],
      take: 50,
    }),
    db.service.findMany({
      where: { organisationId, active: true, deletedAt: null },
      select: { id: true, name: true, durationMinutes: true, priceMinor: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 50,
    }),
  ]);

  return { doctors, services };
};

export type ClinicInformation = {
  readonly name: string;
  readonly timezone: string;
  readonly profile: {
    readonly addressLine1: string | null;
    readonly addressLine2: string | null;
    readonly city: string | null;
    readonly state: string | null;
    readonly postalCode: string | null;
    readonly mapUrl: string | null;
  } | null;
  readonly hoursCollected: boolean;
  readonly hours: readonly {
    readonly weekday: string;
    readonly opensAtMinute: number;
    readonly closesAtMinute: number;
  }[];
  readonly faqs: readonly { readonly question: string; readonly answer: string }[];
  readonly services: ResolvableTargets['services'];
};

/**
 * Everything the agent may say about the clinic itself.
 *
 * FIVE READS IN ONE ROUND TRIP, for the same reason `slotInputs` batches six: this answers
 * "what are your timings" while a patient waits.
 *
 * `opening_hours_collected_at` is read as well as the rows, because D-013 turns on the
 * difference between a clinic that is closed on Sunday and a clinic nobody has asked. The
 * agent is told to state no hours at all in the second case rather than assert a closure.
 */
export const clinicInformation = async (
  db: TenantDb,
  organisationId: string,
): Promise<ClinicInformation | null> => {
  const [organisation, profile, hours, faqs, services] = await db.$transaction([
    db.organisation.findUnique({
      where: { id: organisationId },
      select: { name: true, timezone: true, openingHoursCollectedAt: true },
    }),
    db.clinicProfile.findUnique({
      where: { organisationId },
      select: {
        addressLine1: true,
        addressLine2: true,
        city: true,
        state: true,
        postalCode: true,
        mapUrl: true,
      },
    }),
    db.clinicHours.findMany({
      where: { organisationId },
      select: { weekday: true, opensAtMinute: true, closesAtMinute: true },
      orderBy: [{ weekday: 'asc' }, { opensAtMinute: 'asc' }],
      take: 50,
    }),
    db.clinicFaq.findMany({
      // Active only, in the clinic's own order: an answer switched off must not be spoken.
      where: { organisationId, active: true },
      select: { question: true, answer: true },
      orderBy: [{ sortOrder: 'asc' }, { id: 'asc' }],
      take: 50,
    }),
    db.service.findMany({
      where: { organisationId, active: true, deletedAt: null },
      select: { id: true, name: true, durationMinutes: true, priceMinor: true },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
      take: 50,
    }),
  ]);

  if (organisation === null) {
    return null;
  }

  return {
    name: organisation.name,
    timezone: organisation.timezone,
    profile,
    hoursCollected: organisation.openingHoursCollectedAt !== null,
    hours,
    faqs,
    services,
  };
};
