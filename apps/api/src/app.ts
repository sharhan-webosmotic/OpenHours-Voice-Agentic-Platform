import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import { pinoHttp } from 'pino-http';
import { logger } from './common/logger.js';
import { AppError, ServiceUnavailableError } from './common/errors.js';
import type { ReadinessProbe } from './health/health.service.js';

export type AppDependencies = {
  readonly readiness: ReadinessProbe;
};

const PROBLEM_JSON = 'application/problem+json';

const requestIdOf = (req: Request): string | undefined => {
  const id: unknown = (req as Request & { id?: unknown }).id;
  return typeof id === 'string' || typeof id === 'number' ? String(id) : undefined;
};

export const createApp = ({ readiness }: AppDependencies): Express => {
  const app = express();

  app.disable('x-powered-by');
  app.use(pinoHttp({ logger }));
  // Request body limits are set here once; routes never raise them.
  app.use(express.json({ limit: '100kb' }));

  /**
   * Liveness: 200 whenever the process is up. It must never touch a dependency,
   * otherwise a database blip would make the orchestrator kill healthy containers.
   */
  app.get('/health', (_req: Request, res: Response) => {
    res.status(200).json({ status: 'ok' });
  });

  /**
   * Readiness: 200 only if the database answers, 503 otherwise. Express 5 propagates
   * async errors, so the rejection lands in the error handler below.
   */
  app.get('/ready', async (_req: Request, res: Response) => {
    try {
      await readiness();
    } catch (cause) {
      // Log the real reason for operators; never send driver or SQL detail to a client.
      logger.error({ err: cause }, 'readiness probe failed');
      throw new ServiceUnavailableError('readiness probe failed', 'A dependency is unavailable.');
    }
    res.status(200).json({ status: 'ready' });
  });

  app.use((_req: Request, res: Response) => {
    res.status(404).type(PROBLEM_JSON).json({
      type: 'https://openhours.health/problems/not-found',
      title: 'Not Found',
      status: 404,
    });
  });

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    const requestId = requestIdOf(req);

    if (error instanceof AppError) {
      res
        .status(error.status)
        .type(PROBLEM_JSON)
        .json({
          type: error.type,
          title: error.title,
          status: error.status,
          ...(error.detail === undefined ? {} : { detail: error.detail }),
          ...(requestId === undefined ? {} : { requestId }),
        });
      return;
    }

    logger.error({ err: error }, 'unhandled error');
    res
      .status(500)
      .type(PROBLEM_JSON)
      .json({
        type: 'https://openhours.health/problems/internal-error',
        title: 'Internal Server Error',
        status: 500,
        ...(requestId === undefined ? {} : { requestId }),
      });
  });

  return app;
};
