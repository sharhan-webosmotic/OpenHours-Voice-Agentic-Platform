import type { NextFunction, Request, Response } from 'express';
import { UnauthorizedError } from '../common/errors.js';
import { getContext, runWithContext } from '../common/request-context.js';
import type { Principal } from '../common/permissions.js';
import { authenticateToolSecret, type VoiceAgentIdentity } from './tool-secret.js';

/**
 * Authentication for the voice tool endpoints.
 *
 * WHAT THIS ROUTE DOES NOT PASS THROUGH, and why each omission is correct:
 *   - `requireAuth`: there is no token. The agent presents a per-clinic secret (D-004).
 *   - `requireUser` / `requirePasswordChangeComplete`: the first-login gate is about a
 *     person's temporary password. The agent has no password and no first login, and a
 *     clinic whose owner has not signed in yet still has patients ringing it.
 *   - `tenantMiddleware`: it takes the organisation from a verified token and wraps the
 *     whole request in one transaction. The organisation here comes from the secret, and
 *     the tenant scope is opened per operation in the service, which is also what keeps
 *     each tool to one short transaction instead of holding one open while an agent talks.
 *
 * WHICH SCOPE THE WORK RUNS IN: the ordinary TENANT scope. `voicePrincipal` carries the
 * resolved organisation and the `VOICE_AGENT` role, which is not a platform role, so
 * `withOrganisationScope` sends it through `withTenant`. Row-level security and the Prisma
 * extension both apply exactly as they do for a clinic user. The only unscoped query on
 * this path is the credential lookup itself, which cannot be scoped because it is what
 * decides the scope.
 */

const store = new WeakMap<Request, VoiceAgentIdentity>();

/**
 * The secret, from `Authorization: Bearer <secret>`.
 *
 * OURS TO DEFINE, and that is the honest status of it: these are our endpoints, so the
 * header they expect is our contract. Whether Sarvam's API tool can send a custom
 * `Authorization` header is recorded as an open question in
 * `docs/voice/sarvam-contract.md`. If it cannot, the fallback is the same arrangement as
 * the webhook: the secret in the URL path (D-006). That is a small change here and
 * nowhere else, which is why it is in one function.
 */
const presentedSecret = (req: Request): string | undefined => {
  const header = req.headers.authorization;

  if (typeof header !== 'string') {
    return undefined;
  }

  const [scheme, value] = header.split(' ');

  return scheme?.toLowerCase() === 'bearer' && value !== undefined && value.length > 0
    ? value
    : undefined;
};

/**
 * Resolves the clinic from the secret and puts it in the request context.
 *
 * A FAILURE HERE IS A 401, NOT A SPOKEN MESSAGE. Every other failure on these endpoints is
 * an HTTP 200 carrying `{ ok: false }` so the agent can say something useful to the
 * patient, and this one deliberately is not: a secret that does not authenticate means the
 * deployment is misconfigured or someone is probing, neither of which is a thing to tell a
 * caller, and a 200 would make both invisible to monitoring. Recorded as a deviation in
 * `docs/features/voice-tools.md`.
 */
export const requireVoiceAgent = (req: Request, _res: Response, next: NextFunction): void => {
  const secret = presentedSecret(req);

  if (secret === undefined) {
    next(
      new UnauthorizedError(
        'voice tool call presented no bearer secret',
        'This voice agent is not authorised.',
      ),
    );
    return;
  }

  authenticateToolSecret(secret)
    .then((identity) => {
      const existing = getContext();

      if (existing === undefined) {
        next(new Error('requireVoiceAgent used without requestContextMiddleware'));
        return;
      }

      store.set(req, identity);

      runWithContext(
        {
          // Keeps the request id, address and user agent that the audit rows need.
          ...existing,
          organisationId: identity.organisationId,
          /**
           * A ROLE AND NO USER ID. The agent is a principal, not a person, so there is
           * nothing to put in `userId`. `currentPrincipal()` refuses this context on
           * purpose, because `isUserRole` rejects the role: a tool route that reached for
           * the session principal by habit fails loudly instead of running as nobody.
           */
          role: 'VOICE_AGENT',
        },
        () => {
          next();
        },
      );
    })
    .catch(next);
};

/** The authenticated agent for this request. Throws if the middleware did not run. */
export const voiceAgent = (req: Request): VoiceAgentIdentity => {
  const identity = store.get(req);

  if (identity === undefined) {
    throw new Error('voiceAgent called on a route without requireVoiceAgent');
  }

  return identity;
};

/**
 * The agent as a principal the service layer can enforce the matrix against.
 *
 * `userId` is the voice agent row's id rather than a user's. Nothing reads it: every grant
 * the `VOICE_AGENT` row carries is scoped `all`, so no `own` or `assigned` filter is ever
 * built from it. It is the agent row's id rather than a constant so that a log line or a
 * future per-agent scope names the agent that acted.
 */
export const voicePrincipal = (identity: VoiceAgentIdentity): Principal => ({
  userId: identity.voiceAgentId,
  role: 'VOICE_AGENT',
  organisationId: identity.organisationId,
});
