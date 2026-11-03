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
  readonly appId: string | null;
  readonly deploymentId: string | null;
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
      sarvamDeploymentId: true,
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
        appId: row.sarvamAppId,
        deploymentId: row.sarvamDeploymentId,
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

/**
 * The agent whose WEBHOOK secret hashes to `hash`, or null.
 *
 * A separate column and a separate function from the tool secret, because the two credentials
 * travel differently: this one is in a URL path (D-006), where proxies and access logs see
 * it, and the other is a header. Sharing one value would mean a leaked access log handed
 * somebody the credential for the tool endpoints as well.
 *
 * Cross-tenant by necessity and narrow by design, exactly as the tool lookup is: it is the
 * query that decides which clinic the event belongs to.
 */
export const findAgentByWebhookSecretHash = async (
  db: TenantDb,
  hash: string,
): Promise<AgentCredentialRow | null> => {
  const row = await db.voiceAgent.findUnique({
    where: { webhookSecretHash: hash },
    select: {
      id: true,
      organisationId: true,
      toolSecretHash: true,
      status: true,
      sarvamAppId: true,
      sarvamDeploymentId: true,
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
        appId: row.sarvamAppId,
        deploymentId: row.sarvamDeploymentId,
      };
};

export type InboxInsert = {
  readonly id: string;
  readonly organisationId: string;
  readonly externalEventId: string;
  readonly eventType: string;
  readonly payload: object;
};

/**
 * Stores a webhook event, or reports that it was already stored.
 *
 * STORED BEFORE IT IS UNDERSTOOD, which is the inbox pattern and the reason the route can
 * answer in milliseconds. The unique index on `(provider, external_event_id)` is what makes a
 * repeat delivery a no-op rather than a second call row, so the deduplication is the
 * database's rather than a check-then-insert that two concurrent deliveries would both pass.
 */
export const insertInboxEvent = async (
  db: TenantDb,
  input: InboxInsert,
): Promise<{ readonly stored: boolean; readonly id: string }> => {
  const result = await db.webhookEvent.createMany({
    data: [
      {
        id: input.id,
        organisationId: input.organisationId,
        provider: 'SARVAM',
        externalEventId: input.externalEventId,
        eventType: input.eventType,
        payload: input.payload,
      },
    ],
    skipDuplicates: true,
  });

  if (result.count === 1) {
    return { stored: true, id: input.id };
  }

  const existing = await db.webhookEvent.findFirst({
    where: { provider: 'SARVAM', externalEventId: input.externalEventId },
    select: { id: true },
  });

  return { stored: false, id: existing?.id ?? input.id };
};

export type InboxEventRow = {
  readonly id: string;
  readonly organisationId: string | null;
  readonly externalEventId: string;
  readonly status: 'RECEIVED' | 'PROCESSED' | 'FAILED' | 'UNVERIFIED';
  readonly payload: unknown;
  readonly attempts: number;
};

/**
 * One stored webhook event.
 *
 * Read with `asSystem` by the job, because the row's own `organisation_id` is what says which
 * tenant to open: a tenant-scoped read would need the answer in order to ask the question.
 */
export const findInboxEvent = async (db: TenantDb, id: string): Promise<InboxEventRow | null> => {
  const row = await db.webhookEvent.findUnique({
    where: { id },
    select: {
      id: true,
      organisationId: true,
      externalEventId: true,
      status: true,
      payload: true,
      attempts: true,
    },
  });

  return row === null ? null : { ...row, payload: row.payload };
};

/**
 * Records what happened to an event.
 *
 * `attempts` is incremented on every call, including the successful one, so the row says how
 * many tries it took rather than only whether it eventually worked. `lastError` is a MESSAGE
 * and never a payload: the payload is in the same row and is full of patient data.
 */
export const markInboxEvent = async (
  db: TenantDb,
  id: string,
  status: 'PROCESSED' | 'FAILED' | 'UNVERIFIED',
  lastError: string | null,
  processedAt?: Date,
): Promise<void> => {
  await db.webhookEvent.update({
    where: { id },
    data: {
      status,
      lastError,
      attempts: { increment: 1 },
      ...(processedAt === undefined ? {} : { processedAt }),
    },
  });
};

export type AgentForIngestion = {
  readonly id: string;
  readonly organisationId: string;
  readonly appId: string | null;
};

/** The clinic's agent, for the app id the analytics API is addressed by. */
export const findAgentByOrganisation = async (
  db: TenantDb,
  organisationId: string,
): Promise<AgentForIngestion | null> => {
  const row = await db.voiceAgent.findFirst({
    where: { organisationId, provider: 'SARVAM' },
    select: { id: true, organisationId: true, sarvamAppId: true },
  });

  return row === null
    ? null
    : { id: row.id, organisationId: row.organisationId, appId: row.sarvamAppId };
};

/**
 * Every active agent that can be asked about its interactions, for the catch-up job.
 *
 * Cross-tenant by nature: the job runs for the platform rather than for a clinic, and it
 * opens each clinic's own scope to write. Bounded, because an unbounded read in a job that
 * then makes one HTTP call per row is how a nightly task becomes an outage.
 */
export const findActiveAgentsWithAppId = async (
  db: TenantDb,
): Promise<readonly { readonly organisationId: string; readonly appId: string }[]> => {
  const rows = await db.voiceAgent.findMany({
    where: {
      provider: 'SARVAM',
      status: 'ACTIVE',
      sarvamAppId: { not: null },
      organisation: { status: 'ACTIVE' },
    },
    select: { organisationId: true, sarvamAppId: true },
    orderBy: [{ organisationId: 'asc' }],
    take: 500,
  });

  return rows.flatMap((row) =>
    row.sarvamAppId === null
      ? []
      : [{ organisationId: row.organisationId, appId: row.sarvamAppId }],
  );
};
