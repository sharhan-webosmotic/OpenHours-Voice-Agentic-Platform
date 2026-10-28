import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import { config, type Config } from '../config.js';
import { logger } from '../common/logger.js';
import { getContext } from '../common/request-context.js';
import { uuidV7 } from '../common/uuid.js';
import { buildTenantExtension } from './tenant-extension.js';
import { runInScope } from './tenant-scope.js';

/**
 * The first of the two isolation locks: the application lock.
 *
 * Every query for a tenant model gets organisation_id injected into its `where` and its
 * `data`, and a query with no active scope throws. The second lock is row-level
 * security in the database, which holds even if this layer is bypassed or wrong; the
 * suite in tests/ proves that independently.
 */

const createBaseClient = (appConfig: Config): PrismaClient =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString: appConfig.DATABASE_URL }) });

/** The extended client. Built once: an extension cannot be applied inside a transaction. */
const scopedClient = createBaseClient(config).$extends(buildTenantExtension());

/** What a repository receives: the transaction client, already scoped. */
export type TenantDb = Parameters<Parameters<typeof scopedClient.$transaction>[0]>[0];

/**
 * The scope statements, exported so the test that proves the reset uses the same SQL the
 * API does rather than a copy that can drift away from it.
 *
 * Both settings are written on EVERY entry, and both use `is_local = true`:
 *
 * `app.platform` is an ordinary PostgreSQL custom GUC, which means the unprivileged
 * `app_user` the API connects as may set it itself, and setting it with a false third
 * argument makes it SESSION-scoped, so it outlives the statement and every later
 * transaction on that pooled connection. A reviewer proved the escalation: one
 * `set_config('app.platform','on',false)` turned a tenant-scoped connection into a
 * platform-scoped one for every request that reused it. Clearing the setting
 * transaction-locally at the top of every tenant transaction means a leaked session
 * value cannot widen a tenant-scoped request.
 *
 * This is a containment measure, NOT a fix. `app_user` can still assert platform scope
 * inside its own transaction, because a client-settable GUC cannot be the authority.
 * The real fix is tracked in docs/ROADMAP.md and must land before go-live.
 */
export const TENANT_SCOPE_SQL = `SELECT set_config('app.org_id', $1, true), set_config('app.platform', '', true)`;

export const PLATFORM_SCOPE_SQL = `SELECT set_config('app.platform', 'on', true), set_config('app.org_id', '', true)`;

export type TenantContext = {
  readonly organisationId: string;
  readonly actorUserId?: string;
  readonly actorRole?: string;
};

/**
 * Runs `fn` inside an interactive transaction scoped to one organisation.
 *
 * Interactive is mandatory: `set_config(..., true)` is transaction-local, so a
 * non-transactional query or a second transaction would see no setting and therefore no
 * rows (docs/STACK.md).
 */
export const withTenant = async <T>(
  context: TenantContext,
  fn: (db: TenantDb) => Promise<T>,
): Promise<T> =>
  runInScope({ kind: 'tenant', organisationId: context.organisationId }, () =>
    scopedClient.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(TENANT_SCOPE_SQL, context.organisationId);
      return fn(tx);
    }),
  );

/**
 * Runs `fn` with cross-organisation access, for the paths that legitimately have no
 * tenant yet: login, resolving a provider webhook to an organisation, and jobs.
 *
 * Every call writes an audit row inside the same transaction, so the escape hatch is
 * never silent. It is not a way to make a query work: a repository that needs this is
 * usually missing a tenant context.
 */
export const asSystem = async <T>(reason: string, fn: (db: TenantDb) => Promise<T>): Promise<T> =>
  runInScope({ kind: 'platform', reason }, () =>
    scopedClient.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(PLATFORM_SCOPE_SQL);

      // Written directly rather than through the audit module, which imports from here:
      // routing it through would be a cycle. The fields are kept in step by hand, and
      // the reason only, never the data the call went on to read.
      const context = getContext();
      await tx.auditLog.create({
        data: {
          id: uuidV7(),
          action: 'system.scope.used',
          entityType: 'system',
          metadata: { reason },
          ...(context?.requestId === undefined ? {} : { requestId: context.requestId }),
          ...(context?.ipAddress === undefined ? {} : { ipAddress: context.ipAddress }),
        },
      });

      logger.info({ reason }, 'platform scope opened');

      return fn(tx);
    }),
  );

/** Closes the pool. Called from the server's shutdown path. */
export const disconnectDatabase = async (): Promise<void> => {
  await scopedClient.$disconnect();
};

/** Unextended client, for the tests that must prove RLS holds without the app lock. */
export const createUnscopedClientForTests = (connectionString: string): PrismaClient =>
  new PrismaClient({ adapter: new PrismaPg({ connectionString }) });
