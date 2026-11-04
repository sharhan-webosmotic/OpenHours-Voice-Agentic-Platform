import express, {
  type Express,
  type NextFunction,
  type Request,
  type Response,
  type Router,
} from 'express';
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
import { CSRF_HEADER } from './common/csrf.js';
import { PROBLEM_JSON_CONTENT_TYPE, toProblemDetails } from './common/problem-details.js';
import { getContext } from './common/request-context.js';
import { requestContextMiddleware } from './common/request-context.middleware.js';
import type { ReadinessProbe } from './health/health.service.js';
import { authRouter } from './modules/auth/auth.routes.js';
import { devicesRouter } from './modules/devices/devices.routes.js';
import { forwardingRouter } from './modules/devices/forwarding.routes.js';
import { supportSessionsRouter } from './modules/support-sessions/support-sessions.routes.js';
import { auditRouter } from './modules/audit/audit.routes.js';
import { organisationsRouter } from './modules/organisations/organisations.routes.js';
import { patientsRouter } from './modules/patients/patients.routes.js';
import { appointmentsRouter } from './modules/appointments/appointments.routes.js';
import { callsRouter } from './modules/calls/calls.routes.js';
import { analyticsRouter } from './modules/analytics/analytics.routes.js';
import { bodyErrorKind } from './common/body-errors.js';
import { redactRequestUrl } from './common/url-redaction.js';
import { spokenBodyError, voiceToolsRouter } from './voice/tools.routes.js';
import { refusedWebhookBody, sarvamWebhookRouter } from './voice/webhook.routes.js';

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
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'Idempotency-Key',
    'X-Request-Id',
    // Without this the preflight for the cookie-bearing auth routes fails, because the
    // dashboard and the API are different ORIGINS even though they are same-SITE.
    CSRF_HEADER,
  ],
  exposedHeaders: ['X-Request-Id'],
  maxAge: 600,
});

/**
 * Every router and the prefix it is mounted at, as data rather than as five `app.use`
 * calls.
 *
 * WHY IT IS A TABLE. `src/route-table.test.ts` walks this list, asks each router for the
 * routes it actually carries, and asserts the result matches `getRegisteredRoutes()`
 * exactly. Express 5 does not expose a layer's mount prefix, so without a shared table the
 * test would have to re-state these five strings and could drift from what `createApp`
 * really mounts, which is the drift it exists to catch. Reading the prefix from the same
 * list the application uses is what makes the assertion mean something.
 *
 * That test is what closes review finding I2: the registry is a hand-written declaration,
 * and three guards walk it (the first-login gate, the declared-permission check and the
 * PHI audit check), so a route mounted without a `registerRoute` call was invisible to all
 * three. A gated user reached such a route with a 200 while every guard stayed green.
 */
export const ROUTER_MOUNTS: readonly (readonly [string, () => Router])[] = [
  ['/api/v1/auth', authRouter],
  ['/api/v1/devices', devicesRouter],
  ['/api/v1/forwarding', forwardingRouter],
  ['/api/v1/support-sessions', supportSessionsRouter],
  ['/api/v1/audit-logs', auditRouter],
  ['/api/v1/organisations', organisationsRouter],
  ['/api/v1/patients', patientsRouter],
  ['/api/v1/appointments', appointmentsRouter],
  ['/api/v1/calls', callsRouter],
  ['/api/v1/analytics', analyticsRouter],
  /**
   * Deliberately NOT under `/api/v1`: a provider-facing surface authenticated by a
   * per-clinic secret rather than a session. See the note in `voice/tools.routes.ts`.
   */
  ['/voice/tools', voiceToolsRouter],
  /**
   * Also outside `/api/v1`, and for a stronger reason than the tool endpoints: the secret
   * that authenticates it is IN THE PATH (D-006), so the URL itself is a credential.
   */
  ['/webhooks/sarvam', sarvamWebhookRouter],
];

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
      // `req` runs after pino-http's standard request serializer: the webhook's secret is a
      // path segment, and the URL it logs must not carry it (review C3).
      serializers: { err: (value: unknown) => value, req: redactRequestUrl },
    }),
  );

  /**
   * The webhook's own parser, AHEAD of the general one, with a larger bound.
   *
   * The body is a call's whole transcript, in English and the original language side by side,
   * and a long call passes the general 100 kb limit. The webhook stores what it is given and
   * refuses an invalid body without storing it (D-006), so a real call over the general limit
   * would simply be lost. body-parser marks a request it has read, so the general parser
   * below skips this one.
   */
  app.use(
    '/webhooks/sarvam',
    express.json({ limit: config.WEBHOOK_BODY_LIMIT }),
    refusedWebhookBody,
  );
  app.use(express.json({ limit: config.BODY_LIMIT }));

  /**
   * A body the parser refused, on a voice tool path, is still a sentence for the agent.
   *
   * The parser runs before any router, so the tool router's own error handler never sees its
   * failure: without this a broken body reached the patient as a 400 problem document, which
   * D-022 forbids. Mounted on the prefix and straight after the parser, so it handles exactly
   * those errors and nothing from any other surface.
   */
  app.use('/voice/tools', spokenBodyError);

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

  for (const [prefix, router] of ROUTER_MOUNTS) {
    app.use(prefix, router());
  }

  app.use((_req: Request, _res: Response, next: NextFunction) => {
    next(new NotFoundError('route not found'));
  });

  app.use((error: unknown, req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }

    // Body-parser failures arrive as generic errors; translate before rendering.
    const bodyError = bodyErrorKind(error);
    const rendered: unknown =
      bodyError === 'body-too-large'
        ? new PayloadTooLargeError('request body too large', 'The request body is too large.')
        : bodyError === 'malformed-json'
          ? new ValidationError('malformed json body', 'The request body is not valid JSON.')
          : error;

    const requestId = getContext()?.requestId;
    const problem = toProblemDetails(rendered, requestId);

    // Log the real cause server-side. For a 500 this is the ONLY record of it, because
    // the response deliberately carries no message or stack.
    const log = req.log ?? logger;
    if (bodyError !== undefined) {
      // The kind only: the parser's error holds the raw body (see common/body-errors.ts).
      log.warn({ bodyError, status: problem.status }, 'request body refused');
    } else if (problem.status >= 500) {
      log.error({ err: error }, 'request failed');
    } else {
      log.warn({ err: error, status: problem.status }, 'request rejected');
    }

    res.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  });

  return app;
};

export { AppError };
