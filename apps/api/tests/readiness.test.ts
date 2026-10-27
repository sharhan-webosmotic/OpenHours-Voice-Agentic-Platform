import { afterAll, describe, expect, it } from 'vitest';
import { config } from '../src/config.js';
import { createReadinessRepository } from '../src/health/health.repository.js';
import { createReadinessProbe } from '../src/health/health.service.js';

/**
 * The readiness probe against a real database.
 *
 * M1-07 replaced the bare pg pool with a repository so the probe exercises the same
 * client stack that serves requests; a probe that passed while Prisma was misconfigured
 * would be worse than none.
 */

const repository = createReadinessRepository(config);

afterAll(async () => {
  await repository.disconnect();
});

describe('readiness against a live database', () => {
  it('resolves when PostgreSQL answers', async () => {
    await expect(createReadinessProbe(repository)()).resolves.toBeUndefined();
  });

  it('rejects when pointed at a port with no database', async () => {
    const unreachable = createReadinessRepository({
      ...config,
      DATABASE_URL: 'postgresql://nobody:nothing@127.0.0.1:1/absent',
    });

    try {
      await expect(createReadinessProbe(unreachable)()).rejects.toThrow();
    } finally {
      await unreachable.disconnect();
    }
  });
});
