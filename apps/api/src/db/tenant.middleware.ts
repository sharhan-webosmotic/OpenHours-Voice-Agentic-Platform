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
 */

const store = new WeakMap<Request, TenantDb>();

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

  // The whole remainder of the request runs inside the transaction, so a handler that
  // writes in two steps cannot leave half of it committed.
  withTenant(identity, async (db) => {
    store.set(req, db);

    await new Promise<void>((resolve, reject) => {
      const settle = (): void => {
        // Roll back when the response was not completed, or completed as an error: a
        // 4xx or 5xx means the handler did not finish its work, and a partially applied
        // multi-step write is worse than none at all.
        if (!res.writableEnded || res.statusCode >= 400) {
          reject(new ResponseNotSuccessful());
          return;
        }
        resolve();
      };

      res.once('finish', settle);
      // 'close' without 'finish' is a client that went away mid-response.
      res.once('close', settle);

      // No argument: Express treats ANY truthy argument to next() as an error. An
      // earlier version passed a completion callback here, which Express dutifully
      // routed to the error handler, turning every tenant-scoped request into a 500.
      next();
    });
  }).catch((error: unknown) => {
    if (error instanceof ResponseNotSuccessful) {
      // The rollback was the point, and the response has already been sent.
      return;
    }
    next(error);
  });
};

/** Internal signal used to roll the request transaction back. Never reaches a client. */
class ResponseNotSuccessful extends Error {
  constructor() {
    super('response was not successful; tenant transaction rolled back');
    this.name = 'ResponseNotSuccessful';
  }
}

/** The scoped client for this request. Throws if the middleware did not run. */
export const tenantDb = (req: Request): TenantDb => {
  const db = store.get(req);
  if (db === undefined) {
    throw new Error('tenantDb called on a route without tenantMiddleware');
  }
  return db;
};
