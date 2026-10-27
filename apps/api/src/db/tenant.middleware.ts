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
      // The transaction commits when the response is finished; an error rolls it back.
      res.on('finish', resolve);
      res.on('close', resolve);
      next((error: unknown) => {
        if (error === undefined || error === null) {
          resolve();
          return;
        }
        // Not stringified: a thrown object would render as "[object Object]" and lose
        // the detail. The error handler logs the original separately.
        reject(
          error instanceof Error
            ? error
            : new Error('request failed with a value that is not an Error'),
        );
      });
    });
  }).catch(next);
};

/** The scoped client for this request. Throws if the middleware did not run. */
export const tenantDb = (req: Request): TenantDb => {
  const db = store.get(req);
  if (db === undefined) {
    throw new Error('tenantDb called on a route without tenantMiddleware');
  }
  return db;
};
