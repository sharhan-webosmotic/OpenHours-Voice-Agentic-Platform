import {
  Router,
  type NextFunction,
  type Request,
  type RequestHandler,
  type Response,
} from 'express';
import { config as appConfig } from '../config.js';
import { AppError, UnauthorizedError, ValidationError } from '../common/errors.js';
import { logger } from '../common/logger.js';
import { createRateLimiter } from '../common/rate-limit.js';
import { registerRoute } from '../common/route-registry.js';
import { validate, validatedData } from '../common/validate.js';
import { requireVoiceAgent, voiceAgent } from './tool-auth.middleware.js';
import * as schemas from './tools.schemas.js';
import * as service from './tools.service.js';

/**
 * The endpoints the Sarvam agent calls while a patient is on the telephone.
 *
 * ─── NOT UNDER /api/v1 ──────────────────────────────────────────────────────────
 *
 * `/voice/tools/*`, as `sarvam-voice-integration` prescribes. This is a provider-facing
 * surface with its own authentication, not part of the dashboard's versioned API, and
 * putting it under the same prefix would imply the one thing it must not: that a session
 * reaches it. Recorded as a deviation from the path convention in
 * `docs/features/voice-tools.md`.
 *
 * ─── EVERY ANSWER IS AN HTTP 200 THE AGENT CAN SPEAK, WITH TWO EXCEPTIONS ───────
 *
 * A refused booking, an unknown doctor, a slot taken a second ago: all 200 with
 * `{ ok: false }` and a sentence for the patient, because an HTTP error reaches a patient
 * as silence or as a crash mid-sentence. The exceptions are deliberate:
 *
 *   - 401 when the secret does not authenticate. That is a misconfigured deployment or
 *     somebody probing, neither of which is a thing to say to a caller, and a 200 would
 *     hide both from monitoring.
 *   - 429 when a clinic exceeds its rate limit, so the provider can back off rather than
 *     being told everything is fine.
 *
 * A 5xx is never returned either: an unexpected failure becomes a neutral spoken sentence
 * and a logged error, because the patient's call is still in progress.
 */

const BASE = '/voice/tools';

/**
 * PER CLINIC, NEVER PER ADDRESS.
 *
 * Sarvam calls from a small set of fixed addresses, so an IP bucket would put every clinic
 * in the world in one bucket and throttle the agent itself. The key is the organisation
 * resolved from the verified secret, so one clinic's noise cannot touch another's.
 *
 * THE ARITHMETIC, so the number is not a guess. The milestone's own load target is 20
 * concurrent calls. A booking conversation makes on the order of six tool calls (lookup,
 * clinic info, two availability checks, a book, a confirmation), spread over two or three
 * minutes, so twenty concurrent calls is roughly 60 to 120 calls a minute for one clinic.
 * 600 a minute is five to ten times that, which cannot throttle a busy clinic and still
 * bounds what a leaked secret can do to one tenant.
 */
const perClinic = (limit: number) =>
  createRateLimiter({
    windowMs: 60_000,
    limit,
    keyGenerator: (req) => voiceAgent(req as Request).organisationId,
  });

/**
 * A backstop ahead of authentication, keyed by address, set where it cannot bind.
 *
 * The per-clinic limit can only be applied AFTER the secret has been resolved, which is one
 * indexed read, so without this an unauthenticated flood would still reach the database.
 * It is set at 3,000 a minute: legitimate traffic from Sarvam's two addresses is the 60 to
 * 120 a minute above, across all clinics, so this is an order of magnitude clear of the
 * agent and is a limit on abuse rather than on use.
 */
const perAddress = (limit: number) => createRateLimiter({ windowMs: 60_000, limit });

export type VoiceToolLimits = {
  readonly callsPerMinutePerClinic?: number;
  readonly callsPerMinutePerAddress?: number;
};

/**
 * ORDER MATTERS. The address limit runs first because it is the only one that can run
 * before the secret has been resolved; the clinic limit runs immediately after, because its
 * key does not exist until then.
 */
const toolChain = (limits: VoiceToolLimits): readonly RequestHandler[] => [
  perAddress(limits.callsPerMinutePerAddress ?? appConfig.VOICE_TOOL_CALLS_PER_MINUTE_PER_ADDRESS),
  requireVoiceAgent,
  perClinic(limits.callsPerMinutePerClinic ?? appConfig.VOICE_TOOL_CALLS_PER_MINUTE_PER_CLINIC),
];

/**
 * The `Idempotency-Key` header, bounded and character-checked.
 *
 * Same rule as the dashboard's booking route: it becomes part of a unique index key, so
 * printable ASCII and a length limit beat a database error on a 2 KB header. A malformed
 * one is refused rather than ignored, because silently dropping it would turn a retried
 * booking into a second appointment.
 */
const idempotencyKey = (req: Request): string | undefined => {
  const header = req.get('Idempotency-Key');

  if (header === undefined || header.trim() === '') {
    return undefined;
  }

  const key = header.trim();

  if (key.length > 200 || !/^[\x20-\x7E]+$/.test(key)) {
    throw new ValidationError(
      'malformed Idempotency-Key header',
      'The Idempotency-Key is invalid.',
      [{ field: 'header.Idempotency-Key', message: 'must be up to 200 printable characters' }],
    );
  }

  return key;
};

registerRoute({
  method: 'post',
  path: `${BASE}/clinic-info`,
  summary: 'What the agent may say about the clinic: name, address, timings, services, answers',
  body: schemas.clinicInfoBodySchema,
  response: schemas.toolEnvelopeSchema,
  /**
   * No `permission` field, and the reason is not that there is no permission check.
   *
   * The service calls `requirePermission` against the `VOICE_AGENT` row of the shared
   * matrix, exactly as every other service does. The field is omitted because the guard
   * that reads it, `tests/declared-permissions-are-enforced.test.ts`, proves a declaration
   * by signing in as each role and making a real request, and this principal has no
   * session to sign in with: its only credential is the per-clinic secret. The agent's
   * grants are proven in `tests/voice-tools.test.ts` instead, and its denials in the
   * matrix's own suite.
   */
  phiSensitive: false,
});

registerRoute({
  method: 'post',
  path: `${BASE}/lookup-patient`,
  summary: 'Whether the caller has a record, by their number and optionally their name',
  body: schemas.lookupPatientBodySchema,
  response: schemas.toolEnvelopeSchema,
  phiSensitive: true,
  auditAction: 'patient.read',
});

registerRoute({
  method: 'post',
  path: `${BASE}/check-availability`,
  summary: 'Bookable times on a day, resolving the doctor and service from what was said',
  body: schemas.checkAvailabilityBodySchema,
  response: schemas.toolEnvelopeSchema,
  // A slot list is the clinic's opening hours with the taken times removed. It names
  // nobody, which is the same reasoning as the dashboard's availability route.
  phiSensitive: false,
});

registerRoute({
  method: 'post',
  path: `${BASE}/book`,
  summary: 'Book an appointment for the caller, creating their record if they are new',
  body: schemas.bookBodySchema,
  response: schemas.toolEnvelopeSchema,
  phiSensitive: true,
  auditAction: 'appointment.created',
});

registerRoute({
  method: 'post',
  path: `${BASE}/reschedule`,
  summary: 'Move the caller’s upcoming appointment to another time',
  body: schemas.rescheduleBodySchema,
  response: schemas.toolEnvelopeSchema,
  phiSensitive: true,
  auditAction: 'appointment.rescheduled',
});

registerRoute({
  method: 'post',
  path: `${BASE}/cancel`,
  summary: 'Cancel the caller’s upcoming appointment',
  body: schemas.cancelBodySchema,
  response: schemas.toolEnvelopeSchema,
  phiSensitive: true,
  auditAction: 'appointment.cancelled',
});

/**
 * Turns anything thrown under this router into something the agent can say.
 *
 * MOUNTED ON THE ROUTER, not in `app.ts`, so the application's problem+json handler stays
 * the rule everywhere else. The status is preserved for the two cases the agent must be
 * able to tell apart (401 and 429) and flattened to 200 for everything else.
 *
 * A 4xx carries its own `detail`, which is already written for a person to read. A 5xx
 * deliberately carries nothing, so it becomes a neutral sentence and the real cause is
 * logged: an internal message read out to a patient would be both useless and a leak.
 */
const toSpokenError = (error: unknown, req: Request, res: Response, next: NextFunction): void => {
  if (res.headersSent) {
    next(error);
    return;
  }

  if (error instanceof UnauthorizedError) {
    (req.log ?? logger).warn({ err: error }, 'voice tool call refused');
    res.status(401).json({ ok: false, message: 'This voice agent is not authorised.', data: null });
    return;
  }

  if (error instanceof AppError && error.status === 429) {
    res.status(429).json({ ok: false, message: 'Too many requests.', data: null });
    return;
  }

  if (error instanceof AppError && error.status < 500) {
    (req.log ?? logger).warn({ err: error, status: error.status }, 'voice tool call rejected');
    res.status(200).json({
      ok: false,
      message: error.detail ?? 'I am not able to do that right now.',
      data: null,
    });
    return;
  }

  // The only record of the real cause. The sentence below is what the patient hears.
  (req.log ?? logger).error({ err: error }, 'voice tool call failed');
  res.status(200).json({
    ok: false,
    message: 'I am not able to do that right now. I can have somebody call you back.',
    data: null,
  });
};

/**
 * `limits` is for tests, which lower them to a handful to prove the bucket is per clinic.
 * Production passes nothing and gets the configured values.
 */
export const voiceToolsRouter = (limits: VoiceToolLimits = {}): Router => {
  const router = Router();
  const TOOL = toolChain(limits);

  router.post(
    '/clinic-info',
    ...TOOL,
    validate({ body: schemas.clinicInfoBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, schemas.ClinicInfoBody>(req);
      res.status(200).json(await service.clinicInfo(voiceAgent(req), body));
    },
  );

  router.post(
    '/lookup-patient',
    ...TOOL,
    validate({ body: schemas.lookupPatientBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, schemas.LookupPatientBody>(req);
      res.status(200).json(await service.lookupPatient(voiceAgent(req), body));
    },
  );

  router.post(
    '/check-availability',
    ...TOOL,
    validate({ body: schemas.checkAvailabilityBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, schemas.CheckAvailabilityBody>(req);
      res.status(200).json(await service.checkAvailability(voiceAgent(req), body));
    },
  );

  router.post(
    '/book',
    ...TOOL,
    validate({ body: schemas.bookBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, schemas.BookBody>(req);
      res.status(200).json(await service.book(voiceAgent(req), body, idempotencyKey(req)));
    },
  );

  router.post(
    '/reschedule',
    ...TOOL,
    validate({ body: schemas.rescheduleBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, schemas.RescheduleBody>(req);
      res.status(200).json(await service.reschedule(voiceAgent(req), body));
    },
  );

  router.post(
    '/cancel',
    ...TOOL,
    validate({ body: schemas.cancelBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, schemas.CancelBody>(req);
      res.status(200).json(await service.cancel(voiceAgent(req), body));
    },
  );

  router.use(toSpokenError);

  return router;
};
