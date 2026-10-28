import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { runWithContext } from './request-context.js';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * RFC 4122 UUID, any version. An inbound request ID is echoed into response headers
 * and log lines, so it is untrusted input: accepting it unchecked would allow header
 * injection, log forging and unbounded-length values. Anything that is not exactly a
 * UUID is discarded and replaced.
 */
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

const safeInboundRequestId = (header: unknown): string | undefined => {
  if (typeof header !== 'string') {
    return undefined;
  }
  return UUID_PATTERN.test(header) ? header.toLowerCase() : undefined;
};

/**
 * Assigns the request ID, echoes it to the client, and opens the async context for the
 * rest of the request.
 *
 * Only `requestId` is set here. Identity fields are added later from a verified token
 * (root CLAUDE.md rule 2), so a client sending `X-Organisation-Id` or `X-Role` cannot
 * influence tenancy or permissions.
 */
export const requestContextMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const requestId = safeInboundRequestId(req.headers[REQUEST_ID_HEADER]) ?? randomUUID();

  res.setHeader(REQUEST_ID_HEADER, requestId);

  // Captured once here so every audit row in the request agrees, and so the rest of the
  // code never reaches into req for them.
  const userAgent = req.headers['user-agent'];

  runWithContext(
    {
      requestId,
      ...(req.ip === undefined ? {} : { ipAddress: req.ip }),
      // Truncated: a user agent is unbounded client-controlled input and is stored.
      ...(typeof userAgent === 'string' ? { userAgent: userAgent.slice(0, 512) } : {}),
    },
    () => {
      next();
    },
  );
};
