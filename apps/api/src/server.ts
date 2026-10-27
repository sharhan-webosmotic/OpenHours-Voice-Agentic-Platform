import { createApp } from './app.js';
import { config } from './config.js';
import { logger } from './common/logger.js';
import { createDatabasePool, createDatabaseReadinessProbe } from './health/health.service.js';

const pool = createDatabasePool(config);
const app = createApp({ readiness: createDatabaseReadinessProbe(pool) });

const server = app.listen(config.PORT, () => {
  logger.info({ port: config.PORT, env: config.NODE_ENV }, 'api listening');
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
    pool
      .end()
      .then(() => {
        logger.info('shutdown complete');
        process.exit(closeError ? 1 : 0);
      })
      .catch((poolError: unknown) => {
        logger.error({ err: poolError }, 'error closing database pool');
        process.exit(1);
      });
  });
};

process.on('SIGTERM', () => {
  shutdown('SIGTERM');
});
process.on('SIGINT', () => {
  shutdown('SIGINT');
});
