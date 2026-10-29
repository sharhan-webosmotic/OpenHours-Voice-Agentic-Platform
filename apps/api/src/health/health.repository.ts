import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';
import type { Config } from '../config.js';

/**
 * Readiness through the ORM rather than a second raw driver pool.
 *
 * M1-02 used a bare `pg` pool because Prisma did not exist yet, and said so in a
 * comment. This replaces it, so the probe now exercises the same client stack the API
 * actually serves requests with: a probe that passes while Prisma is misconfigured
 * would be worse than no probe.
 *
 * Unscoped on purpose. `SELECT 1` touches no tenant table, so it needs no tenant
 * context, and readiness must not depend on an organisation existing.
 */

export type ReadinessRepository = {
  readonly ping: () => Promise<void>;
  readonly disconnect: () => Promise<void>;
};

export const createReadinessRepository = (appConfig: Config): ReadinessRepository => {
  const client = new PrismaClient({
    adapter: new PrismaPg({
      connectionString: appConfig.DATABASE_URL,
      // A readiness probe must fail fast rather than hold the request open.
      connectionTimeoutMillis: 2_000,
      max: 2,
      application_name: 'clinicai-api-readiness',
    }),
  });

  return {
    ping: async () => {
      await client.$queryRawUnsafe('SELECT 1');
    },
    disconnect: async () => {
      await client.$disconnect();
    },
  };
};
