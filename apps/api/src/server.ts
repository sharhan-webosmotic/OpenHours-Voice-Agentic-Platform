import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './common/logger.js';
import { createReadinessRepository } from './health/health.repository.js';
import { createReadinessProbe } from './health/health.service.js';
import { disconnectDatabase } from './db/index.js';
import { registerVoiceHandlers } from './jobs/handlers.js';
import { startQueue, stopQueue } from './jobs/queue.js';

const readinessRepository = createReadinessRepository(config);
const app = createApp({ readiness: createReadinessProbe(readinessRepository) });

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'api listening');
});

/**
 * The worker runs IN THIS PROCESS, for now, and that is a decision with a known cost.
 *
 * One clinic on one 2 GB Lightsail instance (D-020) does not justify a second process to
 * deploy, watch and restart. The cost is that a job which buffers a recording in memory is
 * competing with the API for that memory, and that a deployment restarts the worker with it.
 * Both are acceptable at one clinic and neither is at ten, which is the same scaling trigger
 * D-020 names. Splitting it out is a change to this file and nothing else, because the
 * handlers take their dependencies as arguments.
 *
 * A FAILURE TO START IS NOT A FAILURE TO SERVE. The API answers calls, bookings and the
 * dashboard without a worker; what stops is the ingestion of finished calls, and the events
 * are still stored for the catch-up to find. So this logs and carries on rather than
 * bringing the process down.
 */
startQueue()
  .then(registerVoiceHandlers)
  .catch((error: unknown) => {
    logger.error({ err: error }, 'job runner failed to start; the API is serving without it');
  });

let shuttingDown = false;

const shutdown = (signal: string): void => {
  if (shuttingDown) {
    return;
  }
  shuttingDown = true;
  logger.info({ signal }, 'shutting down');

  // Stop accepting connections, let in-flight requests finish, then close the pool.
  const forceExit = setTimeout(() => {
    logger.error({ timeoutMs: config.SHUTDOWN_TIMEOUT_MS }, 'graceful shutdown timed out');
    process.exit(1);
  }, config.SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  server.close((closeError) => {
    if (closeError) {
      logger.error({ err: closeError }, 'error closing http server');
    }
    /**
     * The worker is stopped FIRST, and gracefully, so a job that is halfway through writing
     * a recording to object storage finishes before the pools it is using are closed.
     * `stopQueue` waits for jobs in flight up to the same shutdown timeout.
     */
    stopQueue()
      .catch((queueError: unknown) => {
        logger.error({ err: queueError }, 'error stopping the job runner');
      })
      .finally(() => {
        // Both clients hold their own pool: the readiness probe's and the tenant client's.
        Promise.all([readinessRepository.disconnect(), disconnectDatabase()])
          .then(() => {
            logger.info('shutdown complete');
            process.exit(closeError ? 1 : 0);
          })
          .catch((poolError: unknown) => {
            logger.error({ err: poolError }, 'error closing database connections');
            process.exit(1);
          });
      });
  });
};

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
