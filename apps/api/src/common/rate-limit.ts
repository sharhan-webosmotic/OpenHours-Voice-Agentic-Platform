import rateLimit, { type RateLimitRequestHandler } from 'express-rate-limit';
import { config } from '../config.js';
import { TooManyRequestsError } from './errors.js';

export type RateLimiterOptions = {
  /** Sliding window in milliseconds. Defaults to RATE_LIMIT_WINDOW_MS. */
  readonly windowMs?: number;
  /** Allowed requests per window per key. Defaults to RATE_LIMIT_MAX. */
  readonly limit?: number;
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
export const createRateLimiter = (options: RateLimiterOptions = {}): RateLimitRequestHandler =>
  rateLimit({
    windowMs: options.windowMs ?? config.RATE_LIMIT_WINDOW_MS,
    limit: options.limit ?? config.RATE_LIMIT_MAX,
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
