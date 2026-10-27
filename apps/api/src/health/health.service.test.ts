import { describe, expect, it, vi } from 'vitest';
import { createDatabasePool, createDatabaseReadinessProbe } from './health.service.js';
import type { Config } from '../config.js';

const testConfig: Config = Object.freeze({
  NODE_ENV: 'test',
  PORT: 3000,
  LOG_LEVEL: 'silent',
  // Port 1 is never a PostgreSQL server, so connections fail fast.
  DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
  SHUTDOWN_TIMEOUT_MS: 10_000,
});

describe('createDatabasePool', () => {
  it('handles idle-client errors instead of crashing the process', async () => {
    const pool = createDatabasePool(testConfig);
    try {
      // Regression test: pg emits this when an idle connection dies, e.g. on a database
      // restart. Without a listener Node turns it into an unhandled 'error' event and
      // the API process exits.
      expect(pool.listenerCount('error')).toBeGreaterThan(0);
      expect(() => pool.emit('error', new Error('terminating connection'))).not.toThrow();
    } finally {
      await pool.end();
    }
  });
});

describe('createDatabaseReadinessProbe', () => {
  it('rejects when the database cannot be reached', async () => {
    const pool = createDatabasePool(testConfig);
    try {
      await expect(createDatabaseReadinessProbe(pool)()).rejects.toThrow();
    } finally {
      await pool.end();
    }
  });

  it('releases the client even when the query fails', async () => {
    const release = vi.fn();
    const query = vi.fn(() => Promise.reject(new Error('boom')));
    const fakePool = {
      connect: () => Promise.resolve({ query, release }),
    } as unknown as Parameters<typeof createDatabaseReadinessProbe>[0];

    await expect(createDatabaseReadinessProbe(fakePool)()).rejects.toThrow('boom');
    expect(release).toHaveBeenCalledOnce();
  });
});
