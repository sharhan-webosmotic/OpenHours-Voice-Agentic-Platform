import { Pool } from 'pg';
import type { Config } from '../config.js';
import { logger } from '../common/logger.js';

/**
 * Answers "can this process serve traffic?". Injected into the app so tests can drive
 * both outcomes without a database, and so swapping the implementation later touches
 * one file.
 */
export type ReadinessProbe = () => Promise<void>;

/**
 * A bare `pg` pool, NOT Prisma. The API has no Prisma client, schema or repository
 * layer yet; those arrive in a later prompt. Until then this is the only database
 * handle in apps/api and it exists solely to answer GET /ready. When Prisma lands,
 * replace this with a repository call so there is one connection pool, and delete the
 * `pg` dependency if nothing else uses it.
 */
export const createDatabasePool = (appConfig: Config): Pool => {
  const pool = new Pool({
    connectionString: appConfig.DATABASE_URL,
    // A readiness probe must fail fast rather than hold the request open.
    connectionTimeoutMillis: 2_000,
    max: 2,
    application_name: 'openhours-api-readiness',
  });

  // Required, not optional: pg emits 'error' on the pool when an IDLE client's
  // connection dies (a database restart, failover, or an administrator terminating
  // the backend). With no listener Node treats it as an unhandled 'error' event and
  // kills the process, so a routine database restart would take the API down instead
  // of merely turning /ready red. Log it and let the pool replace the client.
  pool.on('error', (error) => {
    logger.error({ err: error }, 'idle database client error');
  });

  return pool;
};

export const createDatabaseReadinessProbe =
  (pool: Pool): ReadinessProbe =>
  async () => {
    const client = await pool.connect();
    try {
      await client.query('SELECT 1');
    } finally {
      client.release();
    }
  };
