import { describe, expect, it, vi } from 'vitest';
import { createReadinessProbe } from './health.service.js';
import type { ReadinessRepository } from './health.repository.js';

const repositoryWith = (ping: () => Promise<void>): ReadinessRepository => ({
  ping,
  disconnect: () => Promise.resolve(),
});

describe('createReadinessProbe', () => {
  it('resolves when the repository answers', async () => {
    const ping = vi.fn<() => Promise<void>>(() => Promise.resolve());

    await expect(createReadinessProbe(repositoryWith(ping))()).resolves.toBeUndefined();
    expect(ping).toHaveBeenCalledOnce();
  });

  it('rejects when the database cannot be reached', async () => {
    const probe = createReadinessProbe(
      repositoryWith(() => Promise.reject(new Error('connection refused'))),
    );

    await expect(probe()).rejects.toThrow('connection refused');
  });

  it('does not swallow the driver error, so the route can log the real cause', async () => {
    const probe = createReadinessProbe(
      repositoryWith(() => Promise.reject(new Error('password authentication failed'))),
    );

    await expect(probe()).rejects.toThrow(/password authentication failed/);
  });
});
