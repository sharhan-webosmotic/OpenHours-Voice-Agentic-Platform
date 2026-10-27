import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * Per-request values that every layer may read without threading them through
 * signatures. IDs only: this must never hold patient data, because it is bound to
 * every log line (root CLAUDE.md rule 4).
 *
 * `organisationId`, `userId` and `role` are populated ONLY from a verified token or a
 * resolved provider mapping, never from a request body, query or header the client
 * controls (root CLAUDE.md rule 2). Until authentication lands they stay undefined.
 */
export type RequestContext = {
  readonly requestId: string;
  readonly organisationId?: string;
  readonly userId?: string;
  readonly role?: string;
  /**
   * Set only for a paired Android device. A device is not a user: it has an
   * organisation but no role, which is what keeps it off the user endpoints.
   */
  readonly deviceId?: string;
  /** Client address, for audit rows. Resolved under the configured trust-proxy setting. */
  readonly ipAddress?: string;
  /** Truncated before storage: a user agent is unbounded client-controlled input. */
  readonly userAgent?: string;
};

const storage = new AsyncLocalStorage<RequestContext>();

/** Runs `fn` with `context` visible to `getContext()` for the whole async subtree. */
export const runWithContext = <T>(context: RequestContext, fn: () => T): T =>
  storage.run(context, fn);

/** The active context, or undefined outside a request (jobs, startup, tests). */
export const getContext = (): RequestContext | undefined => storage.getStore();

/**
 * Adds authenticated identity to the active context.
 *
 * Returns a NEW context and re-runs `fn` inside it rather than mutating, so a value
 * can never leak sideways into another request's context.
 */
export const withIdentity = <T>(identity: Omit<RequestContext, 'requestId'>, fn: () => T): T => {
  const current = getContext();
  if (current === undefined) {
    throw new Error('withIdentity called outside a request context');
  }
  return runWithContext({ ...current, ...identity }, fn);
};
