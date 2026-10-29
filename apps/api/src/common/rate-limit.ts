import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { TooManyRequestsError } from './errors.js';

export type RateLimiterOptions = {
  /**
   * Sliding window in milliseconds. REQUIRED.
   *
   * This and `limit` used to fall back to `RATE_LIMIT_WINDOW_MS` and `RATE_LIMIT_MAX`.
   * Every call site passed both explicitly, so those two settings were never an effective
   * limit anywhere, while reading like an application-wide throttle an operator could tune.
   * The project removed a decorative `permission` field and a gate leg that asserted
   * nothing for the same reason, so the fallback is gone and the two settings with it:
   * every limiter now states its own bound where it is mounted. Review finding M7.
   */
  readonly windowMs: number;
  /** Allowed requests per window per key. REQUIRED, see windowMs. */
  readonly limit: number;
  /**
   * Bucket key. Defaults to the client IP as resolved under the configured
   * trust-proxy setting.
   *
   * Voice tool and webhook routes need an override: Sarvam calls from a small set of
   * fixed addresses, so an IP bucket would throttle every clinic together. Those routes
   * key on the agent or organisation id resolved from the verified payload instead.
   */
  readonly keyGenerator?: (request: Parameters<RateLimitRequestHandler>[0]) => string;
};

/**
 * Builds a rate limiter whose rejection is an AppError, so a throttled request renders
 * as problem+json through the normal error handler rather than express-rate-limit's
 * plain-text body.
 *
 * STORE: the default in-memory store counts per PROCESS. With more than one API
 * instance the effective limit is `limit x instances`. A shared store is required
 * before horizontal scaling (recorded in docs/STACK.md).
 */
export const createRateLimiter = (options: RateLimiterOptions): RateLimitRequestHandler =>
  rateLimit({
    windowMs: options.windowMs,
    limit: options.limit,
    // `RateLimit-*` headers per the IETF draft; the legacy `X-RateLimit-*` set is off.
    standardHeaders: 'draft-8',
    legacyHeaders: false,
    ...(options.keyGenerator === undefined ? {} : { keyGenerator: options.keyGenerator }),
    handler: (_req, _res, next) => {
      next(
        new TooManyRequestsError(
          'rate limit exceeded',
          'Too many requests. Retry after the window resets.',
        ),
      );
    },
  });
