import type { NextFunction, Request, Response } from 'express';
import { getContext } from '../common/request-context.js';
import { UnauthorizedError } from '../common/errors.js';
import { withTenant, type TenantDb } from './tenant-client.js';

/**
 * Wraps an authenticated request in a tenant-scoped transaction and makes the scoped
 * client available to the handlers beneath it.
 *
 * The organisation comes from the request context, which is populated ONLY from a
 * verified token (root CLAUDE.md rule 2). Nothing here reads a header, query or body,
 * so a client cannot choose its own tenant.
 *
 * The client is held in a WeakMap keyed by the request rather than on a `req` property,
 * so no other middleware can substitute a differently-scoped client.
 *
 * THE RESPONSE IS BUFFERED, which is the part to understand before changing anything
 * here. An earlier version let the handler write straight to the socket and ended the
 * transaction on the response's `finish` event, so Prisma issued COMMIT *after* the
 * client already held a 201. Two things followed: a client that wrote and immediately
 * read back got a different pooled connection and did not see its own row (reproduced
 * at a 50 percent failure rate), and a COMMIT that failed could not change a response
 * that had already gone out. So the handler's bytes are collected here and sent only
 * once COMMIT has resolved.
 *
 * The cost is that NO ROUTE MAY STREAM while this holds: a progressive response would
 * be held until the handler ended it, and a long download would be accumulated in
 * memory. Nothing streams today, and large media (call recordings) must be served as
 * presigned S3 URLs rather than proxied through the API. Recorded in docs/STACK.md.
 */

const store = new WeakMap<Request, TenantDb>();

/** A finished response, held back until the transaction has committed. */
type BufferedResponse = {
  readonly chunks: readonly Buffer[];
  readonly statusCode: number;
};

export const tenantMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const context = getContext();

  if (context?.organisationId === undefined) {
    next(
      new UnauthorizedError(
        'no organisation in request context',
        'Authentication is required for this route.',
      ),
    );
    return;
  }

  const identity: Parameters<typeof withTenant>[0] = {
    organisationId: context.organisationId,
    ...(context.userId === undefined ? {} : { actorUserId: context.userId }),
    ...(context.role === undefined ? {} : { actorRole: context.role }),
  };

  // Assigned by captureResponse before next() runs, so every exit path below can put
  // the real write and end methods back before it touches the response.
  let restore: () => void = () => undefined;

  // The whole remainder of the request runs inside the transaction, so a handler that
  // writes in two steps cannot leave half of it committed.
  withTenant(identity, async (db) => {
    store.set(req, db);

    const buffered = await new Promise<BufferedResponse>((resolve, reject) => {
      restore = captureResponse(res, resolve);

      // 'close' before the handler ended the response is a client that went away
      // mid-request. Harmless after a flush, because the promise has already settled.
      res.once('close', () => {
        reject(new RequestAbandoned());
      });

      // No argument: Express treats ANY truthy argument to next() as an error. An
      // earlier version passed a completion callback here, which Express dutifully
      // routed to the error handler, turning every tenant-scoped request into a 500.
      next();
    });

    if (buffered.statusCode >= 400) {
      // Roll back: a 4xx or 5xx means the handler did not finish its work, and a
      // partially applied multi-step write is worse than none at all. The response is
      // still owed to the client, so it rides along with the rollback signal.
      throw new ResponseNotSuccessful(buffered);
    }

    return buffered;
  })
    .then((buffered) => {
      // Reached only once COMMIT has resolved, which is the whole point of the buffer.
      restore();
      flush(res, buffered);
    })
    .catch((error: unknown) => {
      restore();

      if (error instanceof ResponseNotSuccessful) {
        // The rollback was the point. The client still gets its 4xx or 5xx.
        flush(res, error.buffered);
        return;
      }

      if (error instanceof RequestAbandoned) {
        // Nobody is listening, and the transaction has already rolled back.
        return;
      }

      // Includes a failed COMMIT. Nothing has been sent, so res.headersSent is false and
      // the error handler in app.ts can still render a real problem+json response
      // instead of destroying the socket on a request the client thinks succeeded.
      next(error);
    });
};

/** Internal signal used to roll the request transaction back. Never reaches a client. */
class ResponseNotSuccessful extends Error {
  readonly buffered: BufferedResponse;

  constructor(buffered: BufferedResponse) {
    super('response was not successful; tenant transaction rolled back');
    this.name = 'ResponseNotSuccessful';
    this.buffered = buffered;
  }
}

/** Internal signal for a client that disconnected before the handler finished. */
class RequestAbandoned extends Error {
  constructor() {
    super('client went away before the response completed; tenant transaction rolled back');
    this.name = 'RequestAbandoned';
  }
}

/**
 * Replaces `write` and `end` with collectors, and reports the finished response.
 *
 * Status code and headers are left alone: nothing is sent while the real `end` is held
 * back, so Express's own bookkeeping (status, Content-Type, Content-Length) stays on the
 * response object and goes out unchanged at flush time.
 */
const captureResponse = (
  res: Response,
  onEnd: (buffered: BufferedResponse) => void,
): (() => void) => {
  // Bound, because they are put back as plain properties on the response and would
  // otherwise be called with the wrong `this`.
  const originalWrite = res.write.bind(res);
  const originalEnd = res.end.bind(res);
  const chunks: Buffer[] = [];

  const collect = (args: readonly unknown[]): (() => void) | undefined => {
    const { chunk, encoding, callback } = splitArgs(args);
    const buffer = toBuffer(chunk, encoding);
    if (buffer !== undefined) {
      chunks.push(buffer);
    }
    return callback;
  };

  const write = (...args: readonly unknown[]): boolean => {
    collect(args)?.();
    // Always "flushed": nothing is queued on the socket, so there is no back pressure.
    return true;
  };

  const end = (...args: readonly unknown[]): Response => {
    const callback = collect(args);
    onEnd({ chunks, statusCode: res.statusCode });
    callback?.();
    return res;
  };

  res.write = write as typeof res.write;
  res.end = end as typeof res.end;

  return () => {
    res.write = originalWrite;
    res.end = originalEnd;
  };
};

/** Sends a buffered response through the restored `end`. */
const flush = (res: Response, buffered: BufferedResponse): void => {
  res.end(Buffer.concat(buffered.chunks));
};

type SplitArgs = {
  readonly chunk: unknown;
  readonly encoding: BufferEncoding;
  readonly callback: (() => void) | undefined;
};

/**
 * Untangles the write and end overloads: both accept an optional encoding and an
 * optional callback in either of the trailing positions.
 */
const splitArgs = (args: readonly unknown[]): SplitArgs => {
  const [first, second, third] = args;

  if (typeof first === 'function') {
    return { chunk: undefined, encoding: 'utf8', callback: first as () => void };
  }

  if (typeof second === 'function') {
    return { chunk: first, encoding: 'utf8', callback: second as () => void };
  }

  return {
    chunk: first,
    encoding: typeof second === 'string' ? (second as BufferEncoding) : 'utf8',
    callback: typeof third === 'function' ? (third as () => void) : undefined,
  };
};

const toBuffer = (chunk: unknown, encoding: BufferEncoding): Buffer | undefined => {
  if (chunk === undefined || chunk === null) {
    return undefined;
  }
  if (typeof chunk === 'string') {
    return Buffer.from(chunk, encoding);
  }
  if (Buffer.isBuffer(chunk)) {
    return chunk;
  }
  if (chunk instanceof Uint8Array) {
    return Buffer.from(chunk);
  }
  // Only reachable from a route that streams something exotic, which the note at the
  // top of this file forbids. Throwing beats silently dropping bytes from a response.
  throw new Error('tenantMiddleware cannot buffer this response chunk type');
};

/** The scoped client for this request. Throws if the middleware did not run. */
export const tenantDb = (req: Request): TenantDb => {
  const db = store.get(req);
  if (db === undefined) {
    throw new Error('tenantDb called on a route without tenantMiddleware');
  }
  return db;
};
