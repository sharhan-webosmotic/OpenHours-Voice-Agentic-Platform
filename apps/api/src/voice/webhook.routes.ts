import { createHash } from 'node:crypto';
import { Router, type NextFunction, type Request, type Response } from 'express';
import { z } from 'zod';
import { config } from '../config.js';
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
import * as repository from './voice.repository.js';

/**
 * Where Sarvam tells us a call has finished.
 *
 * ─── THREE MEASURES, BECAUSE SARVAM DOCUMENTS NO SIGNATURE (D-006) ──────────────
 *
 * 1. A long random secret per clinic in the URL PATH, stored only as a hash. It resolves the
 *    clinic, so a request without it is not merely unauthorised: it addresses nobody.
 * 2. An allow-list of Sarvam's two published egress addresses, as defence in depth. It is
 *    configurable and off by default, because a developer replaying an event from a terminal
 *    is not coming from Mumbai, and `release-readiness` owns turning it on.
 * 3. The payload is NEVER trusted for anything that matters. The clinic comes from the
 *    secret, not from `metadata.clinic_id`, and the processing job re-reads the interaction
 *    from Sarvam's authenticated API before acting on it. Measure three is the one that
 *    holds: a forged payload cannot make the platform act on something that is not in the
 *    provider's own records.
 *
 * ─── IT STORES AND RETURNS, AND DOES NOT THINK ──────────────────────────────────
 *
 * The work is three calls to Sarvam and a file upload, which is far past the one second a
 * webhook has. So the raw body goes into `webhook_events` first, a job is enqueued, and the
 * response goes out. A provider that re-sends gets a 200 and no second call row, because the
 * unique index on `(provider, external_event_id)` is what deduplicates rather than a check in
 * this file.
 *
 * ─── EVERY ANSWER IS 200 OR 404, AND NOTHING ELSE ───────────────────────────────
 *
 * 404 for a secret that resolves to no clinic, which is also what a wrong address gets.
 * 200 for everything else, INCLUDING a payload this code cannot parse: the body is already
 * stored, a 500 would make Sarvam re-send something we have, and an unparseable event is a
 * contract problem for a person to look at rather than a delivery to retry. The event's row
 * carries the failure.
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
  const allowed = config.SARVAM_WEBHOOK_SOURCE_IPS;

  if (allowed.length === 0) {
    next();
    return;
  }

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
 * An identifier for an event whose body we could not read.
 *
 * `interaction_id` is the idempotency key (contract section 3). Without one there is nothing
 * to deduplicate on, so the digest of the body stands in: a provider re-sending the same
 * unreadable body is still one row, and a different unreadable body is a different row
 * somebody can look at. Prefixed, so nobody mistakes it for a provider identifier.
 */
const fallbackEventId = (raw: unknown): string =>
  `unparsed:${createHash('sha256')
    .update(JSON.stringify(raw) ?? '')
    .digest('hex')
    .slice(0, 32)}`;

/**
 * The interaction id, read WITHOUT the provider adapter.
 *
 * The adapter is strict about the fields it uses, and this route must store a body it cannot
 * understand rather than refuse it. So it reaches for one string and leaves the rest alone;
 * `parseWebhook` runs in the job, where a failure can be recorded against a stored row.
 */
const interactionId = (raw: unknown): string | undefined => {
  if (typeof raw !== 'object' || raw === null) {
    return undefined;
  }

  const value = (raw as { readonly interaction_id?: unknown }).interaction_id;

  return typeof value === 'string' && value.trim() !== '' ? value.trim() : undefined;
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
    const externalEventId = interactionId(raw) ?? fallbackEventId(raw);
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
            // The RAW body, unaltered. It is the evidence the adapter is checked against
            // after the first real call, and the thing a replay re-reads.
            payload: typeof raw === 'object' && raw !== null ? raw : { body: raw },
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
              metadata: { externalEventId, parsed: interactionId(raw) !== undefined },
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
