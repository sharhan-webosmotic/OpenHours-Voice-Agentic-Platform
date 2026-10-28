import type { ReadinessRepository } from './health.repository.js';

/** Answers "can this process serve traffic?". */
export type ReadinessProbe = () => Promise<void>;

/**
 * Readiness now goes through a repository, so the probe exercises the same client stack
 * that serves requests. M1-02 used a bare `pg` pool only because Prisma did not exist.
 *
 * The pool's resilience guarantee (CR-001: a long-lived handle must survive its remote
 * end dying) is now owned by @prisma/adapter-pg, which attaches an idle-client error
 * handler. Verified by stopping PostgreSQL under a live client: the query rejected and
 * the process stayed up.
 */
export const createReadinessProbe =
  (repository: ReadinessRepository): ReadinessProbe =>
  async () => {
    await repository.ping();
  };
