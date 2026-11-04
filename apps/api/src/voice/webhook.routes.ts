import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
import { bodyErrorKind } from '../common/body-errors.js';
import { NotFoundError } from '../common/errors.js';
import { logger } from '../common/logger.js';
import { createRateLimiter } from '../common/rate-limit.js';
import { registerRoute } from '../common/route-registry.js';
import { getContext, runWithContext } from '../common/request-context.js';
import { hashToken } from '../common/tokens.js';
import { uuidV7 } from '../common/uuid.js';
import { asAuthenticator, withTenant } from '../db/tenant-client.js';
import { record } from '../modules/audit/audit.service.js';
import { enqueue, VOICE_QUEUES } from '../jobs/queue.js';
import { ProviderContractError } from './provider.js';
import { sarvamProvider } from './providers/sarvam.js';
import * as repository from './voice.repository.js';

/**
 * Where Sarvam tells us a call has finished.
 *
 * ─── THE CONTROL IS THE SECRET AND THE ADDRESS (D-006) ──────────────────────────
 *
 * Sarvam documents no signature, so:
 *
 * 1. A long random secret per clinic in the URL PATH, stored only as a hash. It resolves the
 *    clinic, so a request without it is not merely unauthorised: it addresses nobody.
 * 2. An allow-list of Sarvam's egress addresses, or a deliberate, configured decision to run
 *    without it. Config refuses to start with neither (`SARVAM_WEBHOOK_IP_CHECK_DISABLED`).
 *
 * The clinic always comes from the secret, never from `metadata.clinic_id`.
 *
 * VERIFICATION IS AFTER THE FACT, NOT BEFORE. The call and its transcript are created from
 * this payload straight away, with no provider re-read in front of them, so a call appears
 * the moment it is processed. The recording job, which authenticates to Sarvam for the
 * interaction anyway, then looks it up and marks the call VERIFIED or NOT_FOUND. What used
 * to be the third measure is now a label on the call, not a gate.
 *
 * ─── VALIDATED ON THE WAY IN, THEN STORED AND RETURNED ──────────────────────────
 *
 * The body is checked against the adapter's schema here: expected shape, types and length
 * bounds. That schema is the only thing between an unauthenticated body and the database,
 * so a body that fails it is NOT stored. It is answered 200, because a 4xx would make Sarvam
 * re-send something that will fail again, and logged with the failing field PATHS only.
 *
 * A valid body goes into `webhook_events`, a job is enqueued, and the response goes out. A
 * provider that re-sends gets a 200 and no second row: the unique index on `(provider,
 * external_event_id)` deduplicates, not a check in this file.
 *
 * ─── EVERY ANSWER IS 200 OR 404 ─────────────────────────────────────────────────
 *
 * 404 for a secret that resolves to no clinic, which is also what a wrong address gets.
 * 200 for everything else, including a body that is refused.
 */

const BASE = '/webhooks/sarvam';

/**
 * The secret is a path parameter, so it must be a plausible one before it is hashed.
 *
 * Base64url of 32 bytes is 43 characters (`generateOpaqueToken`). The bound is wide enough
 * for a future format and narrow enough that a megabyte of path is refused before it reaches
 * a hash function.
 */
const secretParamSchema = z.object({ secret: z.string().min(20).max(200) });

/**
 * A guard on the source address, which is OFF when the list is empty.
 *
 * Deliberately not a 403: an address that is not allowed is told the same thing as an
 * address with the wrong secret, which is that there is nothing here.
 */
const requireSarvamAddress = (req: Request, _res: Response, next: NextFunction): void => {
  if (config.SARVAM_WEBHOOK_IP_CHECK_DISABLED) {
    // Switched off by an explicit setting, never by an empty list (config refuses that).
    next();
    return;
  }

  const allowed = config.SARVAM_WEBHOOK_SOURCE_IPS;

  const address = req.ip;

  if (address === undefined || !allowed.includes(address)) {
    // The address IS logged: it is not patient data, and it is the only evidence that
    // somebody is posting to a clinic's webhook URL from somewhere unexpected.
    logger.warn({ address }, 'webhook refused: source address is not allow-listed');
    next(new NotFoundError('webhook source address not allow-listed', 'Not found.'));
    return;
  }

  next();
};

/**
 * A webhook body the JSON parser itself refused: cut off, or over the size bound.
 *
 * Mounted by `app.ts` straight after this route's own body parser. Answered 200 and stored
 * nowhere, like any other invalid body, and logged by KIND only: the parser's error carries
 * the raw text, which here is a transcript (`common/body-errors.ts`).
 */
export const refusedWebhookBody = (
  error: unknown,
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  const kind = bodyErrorKind(error);

  if (kind === undefined || res.headersSent) {
    next(error);
    return;
  }

  (req.log ?? logger).warn({ bodyError: kind }, 'webhook refused: body could not be read');
  res.status(200).json({ ok: false, received: false });
};

registerRoute({
  method: 'post',
  path: `${BASE}/:secret`,
  summary: 'Sarvam call-finished webhook: stores the event and returns, processing in a job',
  params: secretParamSchema,
  /**
   * No `permission`: there is no principal. The controls are the three in D-006, described
   * at the top of this file.
   *
   * `phiSensitive` IS TRUE and the audit action is the receipt rather than the contents. The
   * body carries a transcript and two telephone numbers, so storing it is a write of patient
   * data, and the row records that a call event arrived for this clinic with its provider
   * identifier. Nothing from the payload itself reaches the audit metadata.
   */
  phiSensitive: true,
  auditAction: 'call.webhook_received',
});

/**
 * One limiter, keyed by address, and generous.
 *
 * Unlike the tool endpoints, there is nothing to key on per clinic before the secret has been
 * resolved, and resolving it is the work being protected. Sarvam's own volume is one request
 * per finished call, so 600 a minute from one address is far above any real clinic and still
 * bounds somebody posting at the URL in a loop.
 */
const limiter = createRateLimiter({ windowMs: 60_000, limit: 600 });

export const sarvamWebhookRouter = (): Router => {
  const router = Router();

  router.post('/:secret', limiter, requireSarvamAddress, async (req: Request, res: Response) => {
    const params = secretParamSchema.safeParse(req.params);

    if (!params.success) {
      throw new NotFoundError('webhook secret is not a plausible value', 'Not found.');
    }

    const agent = await asAuthenticator('voice-webhook-secret', (db) =>
      repository.findAgentByWebhookSecretHash(db, hashToken(params.data.secret)),
    );

    /**
     * A 404, and the same one for every reason: no such secret, a suspended agent, a
     * deactivated clinic. Anybody probing these URLs learns nothing, and a clinic that has
     * been switched off does not have its calls recorded.
     */
    if (agent === null || agent.status !== 'ACTIVE' || agent.organisationStatus !== 'ACTIVE') {
      logger.warn({ voiceAgentId: agent?.id }, 'webhook refused: no active agent for that secret');
      throw new NotFoundError('webhook secret matched no active agent', 'Not found.');
    }

    const raw: unknown = req.body;
    let externalEventId: string;

    try {
      externalEventId = sarvamProvider.parseWebhook(raw).externalCallId;
    } catch (error) {
      if (!(error instanceof ProviderContractError)) {
        throw error;
      }

      /**
       * Refused, stored nowhere, answered 200. The note names the failing field PATHS, which
       * is all the adapter's message carries: never a value, because the values are a
       * transcript and two telephone numbers.
       */
      logger.warn(
        { voiceAgentId: agent.id, organisationId: agent.organisationId, reason: error.message },
        'webhook refused: body failed validation',
      );
      res.status(200).json({ ok: false, received: false });
      return;
    }

    const existing = getContext();

    const stored = await runWithContext(
      { ...(existing ?? { requestId: uuidV7() }), organisationId: agent.organisationId },
      () =>
        withTenant({ organisationId: agent.organisationId }, async (db) => {
          const result = await repository.insertInboxEvent(db, {
            id: uuidV7(),
            organisationId: agent.organisationId,
            externalEventId,
            eventType: 'call.finished',
            // The RAW body, unaltered and already validated. It is the evidence the adapter is
            // checked against after the first real call, and the thing a replay re-reads.
            payload: raw as object,
          });

          /**
           * Audited only when it was actually stored. A repeat delivery is not a new event,
           * and a row per retry would make the trail describe Sarvam's delivery behaviour
           * rather than the clinic's calls.
           */
          if (result.stored) {
            await record(db, {
              action: 'call.webhook_received',
              entityType: 'webhook_event',
              entityId: result.id,
              organisationId: agent.organisationId,
              // The provider's identifier is not patient data. The payload's contents are,
              // and none of them are here.
              metadata: { externalEventId },
            });
          }

          return result;
        }),
    );

    if (stored.stored) {
      await enqueue(VOICE_QUEUES.processWebhookEvent, { webhookEventId: stored.id });
    }

    /**
     * 200 either way, and the body says which. `received: false` is a duplicate, which is a
     * success from the provider's point of view and is what stops it re-sending.
     */
    res.status(200).json({ ok: true, received: stored.stored, eventId: stored.id });
  });

  return router;
};
