import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import cors, { type CorsOptions } from 'cors';
import helmet from 'helmet';
import { pinoHttp } from 'pino-http';
import { config as appConfig, type Config } from './config.js';
import { logger } from './common/logger.js';
import {
  AppError,
  NotFoundError,
  PayloadTooLargeError,
  ServiceUnavailableError,
  ValidationError,
} from './common/errors.js';
import { PROBLEM_JSON_CONTENT_TYPE, toProblemDetails } from './common/problem-details.js';
import { getContext } from './common/request-context.js';
import { requestContextMiddleware } from './common/request-context.middleware.js';
import type { ReadinessProbe } from './health/health.service.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { devicesRouter } from './modules/devices/devices.routes.js';
import { forwardingRouter } from './modules/devices/forwarding.routes.js';
import { supportSessionsRouter } from './modules/support-sessions/support-sessions.routes.js';

export type AppDependencies = {
  readonly readiness: ReadinessProbe;
  /** Overridable so tests can exercise CORS and trust-proxy without mutating env. */
  readonly config?: Config;
};

/**
 * Strict allow-list. The origin callback can only ever echo an origin that is present
 * in `CORS_ALLOWED_ORIGINS`, so there is no code path that emits `*`. Config refuses to
 * load a wildcard together with credentials, so the dangerous pair is unreachable.
 */
const buildCorsOptions = (config: Config): CorsOptions => ({
  origin: (origin, callback) => {
    // No Origin header: same-origin or a non-browser client (curl, server-to-server).
    // Nothing to authorise, and no CORS headers are added.
    if (origin === undefined) {
      callback(null, false);
      return;
    }
    callback(null, config.CORS_ALLOWED_ORIGINS.includes(origin) ? origin : false);
  },
  credentials: config.CORS_ALLOW_CREDENTIALS,
  methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-Request-Id'],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
});

/** `express.json` rejects an oversized body with a 413; map it onto our error type. */
const isBodyTooLarge = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { type?: string }).type === 'entity.too.large';

/** A malformed JSON body is the client's mistake, so it is a 400, not a 500. */
const isMalformedJson = (error: unknown): boolean =>
  error instanceof SyntaxError && 'body' in error;

export const createApp = ({ readiness, config = appConfig }: AppDependencies): Express => {
  const app = express();

  app.disable('x-powered-by');

  /**
   * Never `true`: that would trust the whole X-Forwarded-For chain and let any client
   * spoof its address, defeating IP-keyed rate limits. Config permits only `false` or
   * a hop count.
   */
  app.set('trust proxy', config.TRUST_PROXY);

  app.use(helmet());
  app.use(cors(buildCorsOptions(config)));

  // Before the logger, so every log line carries the request id.
  app.use(requestContextMiddleware);
  app.use(
    pinoHttp({
      logger,
      // Reuse the context id so the log line and the X-Request-Id header always match.
      genReqId: () => getContext()?.requestId ?? 'unknown',
      // pino-http installs its own error serializer, which would re-introduce the
      // cause-into-message folding the base logger disables. See logger.ts.
      serializers: { err: (value: unknown) => value },
    }),
  );

  app.use(express.json({ limit: config.BODY_LIMIT }));

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
      // Wrapped rather than rethrown so a probe failure is a 503 (dependency down),
      // not the 500 an unrecognised error would produce.
      logger.error({ err: cause }, 'readiness probe failed');
      throw new ServiceUnavailableError('readiness probe failed', 'A dependency is unavailable.');
    }
    res.status(200).json({ status: 'ready' });
  });

  app.use('/api/v1/auth', authRouter());
  app.use('/api/v1/devices', devicesRouter());
  app.use('/api/v1/forwarding', forwardingRouter());
  app.use('/api/v1/support-sessions', supportSessionsRouter());

  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('route not found'));
  });

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    // Body-parser failures arrive as generic errors; translate before rendering.
    let rendered: unknown = error;
    if (isBodyTooLarge(error)) {
      rendered = new PayloadTooLargeError(
        'request body too large',
        'The request body is too large.',
      );
    } else if (isMalformedJson(error)) {
      rendered = new ValidationError('malformed json body', 'The request body is not valid JSON.');
    }

    const requestId = getContext()?.requestId;
    const problem = toProblemDetails(rendered, requestId);

    // Log the real cause server-side. For a 500 this is the ONLY record of it, because
    // the response deliberately carries no message or stack.
    const log = req.log ?? logger;
    if (problem.status >= 500) {
      log.error({ err: error }, 'request failed');
    } else {
      log.warn({ err: error, status: problem.status }, 'request rejected');
    }

    res.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  });

  return app;
};

export { AppError };
