import { PrismaPg } from '@prisma/adapter-pg';
import { inject } from 'vitest';
import { PrismaClient } from '../../src/generated/prisma/client.js';
import { generateOpaqueToken, hashToken } from '../../src/common/tokens.js';

/**
 * Clients for the database tests.
 *
 * `appUserClient` connects as the non-owner `app_user`, exactly as the API does, so the
 * row-level security policies are live. `ownerClient` is used only to build fixtures and
 * to assert what truly exists in a table, independently of any policy.
 */

let appUser: PrismaClient | undefined;
let owner: PrismaClient | undefined;

const clientFor = (connectionString: string): PrismaClient =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

export const appUserClient = (): PrismaClient => {
  appUser ??= clientFor(inject('appUserUrl'));
  return appUser;
};

export const ownerClient = (): PrismaClient => {
  owner ??= clientFor(inject('ownerUrl'));
  return owner;
};

export const disconnectAll = async (): Promise<void> => {
  await Promise.all([appUser?.$disconnect(), owner?.$disconnect()]);
  appUser = undefined;
  owner = undefined;
};

/** Transaction type Prisma hands a callback, so helpers can take either client. */
export type Tx = Parameters<Parameters<PrismaClient['$transaction']>[0]>[0];

/**
 * Runs `fn` scoped to one organisation, the way withTenant will in M1-07.
 *
 * Must be an interactive transaction: `set_config(..., true)` is transaction-local, so
 * the setting would be gone by the next query otherwise (recorded in docs/STACK.md).
 */
export const asOrganisation = async <T>(
  client: PrismaClient,
  organisationId: string,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> =>
  client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.org_id', $1, true)`, organisationId);
    return fn(tx);
  });

/** Runs `fn` with platform scope, which sees across organisations. */
export const asPlatform = async <T>(client: PrismaClient, fn: (tx: Tx) => Promise<T>): Promise<T> =>
  client.$transaction(async (tx) => {
    await tx.$executeRawUnsafe(`SELECT set_config('app.platform', 'on', true)`);
    return fn(tx);
  });

/** Runs `fn` with NO tenant context at all, to prove the default is "see nothing". */
export const withoutContext = async <T>(
  client: PrismaClient,
  fn: (tx: Tx) => Promise<T>,
): Promise<T> => client.$transaction(async (tx) => fn(tx));

/** Every table that carries organisation_id, plus organisations itself. */
export const tenantTables = async (client: PrismaClient): Promise<readonly string[]> => {
  const rows = await client.$queryRawUnsafe<{ table_name: string }[]>(`
    SELECT c.relname AS table_name
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind = 'r'
      AND (
        EXISTS (
          SELECT 1 FROM pg_attribute a
          WHERE a.attrelid = c.oid AND a.attname = 'organisation_id' AND a.attnum > 0
        )
        OR c.relname = 'organisations'
      )
    ORDER BY c.relname
  `);
  return rows.map((r) => r.table_name);
};

/**
 * Gives an organisation's voice agent a tool secret, and returns the secret.
 *
 * The platform mints these and stores only a SHA-256 hash (D-012), so a test cannot read
 * one back and has to set it. Written here rather than in the fixture because most suites
 * have no business authenticating as a voice agent, and a fixture that handed every test a
 * live credential would make it easy to use one by accident.
 */
export const mintToolSecret = async (tx: Tx, organisationId: string): Promise<string> => {
  const secret = generateOpaqueToken();

  await tx.voiceAgent.update({
    where: { organisationId_provider: { organisationId, provider: 'SARVAM' } },
    data: { toolSecretHash: hashToken(secret), toolSecretSetAt: new Date() },
  });

  return secret;
};

/**
 * Gives an organisation's voice agent a WEBHOOK secret, and returns it.
 *
 * Separate from the tool secret for the same reason the columns are separate: this one
 * travels in a URL path (D-006), so a test that used one value for both would not notice if
 * the application started accepting a URL secret as a bearer credential.
 */
export const mintWebhookSecret = async (tx: Tx, organisationId: string): Promise<string> => {
  const secret = generateOpaqueToken();

  await tx.voiceAgent.update({
    where: { organisationId_provider: { organisationId, provider: 'SARVAM' } },
    data: { webhookSecretHash: hashToken(secret), webhookSecretSetAt: new Date() },
  });

  return secret;
};
