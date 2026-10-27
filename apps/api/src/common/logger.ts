import { pino } from 'pino';
import { config } from '../config.js';
import { redactLogObject } from './redaction.js';
import { getContext } from './request-context.js';

/**
 * Redaction is mandatory (root CLAUDE.md rule 4: never log patient data or secrets).
 * It is a safety net, not the primary control: callers log IDs only.
 *
 * Two layers, because one is not enough:
 *  1. `formatters.log` -> redactLogObject walks the whole payload to ANY depth and
 *     handles Error instances. This is the real control. Verified ordering: pino calls
 *     `formatters.log` BEFORE its serializers, so the formatter sees live Error objects
 *     whose name/message/stack are non-enumerable.
 *  2. `redact.paths` stays for the predictable request/response header paths. It is
 *     cheap and native, and keeps working if layer 1 is ever changed.
 */
const REDACTED_HEADER_PATHS = [
  'req.headers.authorization',
  'req.headers.cookie',
  'req.headers["x-api-key"]',
  'res.headers["set-cookie"]',
];

/**
 * The pino options, exported so tests can build an identical logger against a
 * capturing destination and assert on real output rather than re-describing the rules.
 */
export const buildLoggerOptions = (): pino.LoggerOptions => ({
  level: config.LOG_LEVEL,
  redact: { paths: REDACTED_HEADER_PATHS, censor: '[REDACTED]' },
  formatters: { log: redactLogObject },
  /**
   * Identity, overriding pino's default error serializer on purpose.
   *
   * That default runs AFTER formatters.log and rewrites `err.message` to
   * `"parent: cause"`, folding a cause's message into the parent's. Messages are never
   * redacted (a redacted message is useless), so folding is a route for a cause's text
   * to surface somewhere it was not reviewed. redactLogObject has already produced the
   * final error shape with the cause nested and redacted, so nothing further is needed.
   */
  serializers: { err: (value: unknown) => value },
  /**
   * Binds the request context to EVERY log line, so any line can be tied back to the
   * request that produced it without callers remembering to pass it. IDs only.
   */
  mixin: () => {
    const context = getContext();
    if (context === undefined) {
      return {};
    }
    return {
      requestId: context.requestId,
      ...(context.organisationId === undefined ? {} : { organisationId: context.organisationId }),
      ...(context.userId === undefined ? {} : { userId: context.userId }),
      ...(context.role === undefined ? {} : { role: context.role }),
    };
  },
  // Pretty output is a development convenience only; staging and production emit JSON.
  ...(config.NODE_ENV === 'development'
    ? { transport: { target: 'pino-pretty', options: { translateTime: 'SYS:standard' } } }
    : {}),
});

export const logger = pino(buildLoggerOptions());

export type Logger = typeof logger;
