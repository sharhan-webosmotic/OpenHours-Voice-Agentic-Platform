import type { NextFunction, Request, Response } from 'express';
import { ForbiddenError, UnauthorizedError } from './errors.js';
import { getContext, runWithContext } from './request-context.js';
import { verifyAccessToken } from '../modules/auth/auth.tokens.js';
import { authenticateDevice } from '../modules/devices/devices.service.js';

/**
 * Authentication middleware.
 *
 * The verified token is the ONLY source of organisation and role (root CLAUDE.md
 * rule 2). Both are put into the request context here and nowhere else, so no handler
 * can be influenced by a header, query or body.
 */

const bearerToken = (header: unknown): string | undefined => {
  if (typeof header !== 'string') {
    return undefined;
  }
  const [scheme, value] = header.split(' ');
  return scheme?.toLowerCase() === 'bearer' && value !== undefined && value.length > 0
    ? value
    : undefined;
};

export const requireAuth = (req: Request, _res: Response, next: NextFunction): void => {
  const token = bearerToken(req.headers.authorization);

  if (token === undefined) {
    next(new UnauthorizedError('missing bearer token', 'Authentication is required.'));
    return;
  }

  verifyAccessToken(token)
    .then((claims) => {
      const existing = getContext();
      if (existing === undefined) {
        next(new Error('requireAuth used without requestContextMiddleware'));
        return;
      }

      runWithContext(
        {
          // Everything already captured stays: dropping it here would silently empty
          // the ip and user agent on every audited action.
          ...existing,
          userId: claims.userId,
          role: claims.role,
          ...(claims.organisationId === null ? {} : { organisationId: claims.organisationId }),
        },
        () => {
          next();
        },
      );
    })
    .catch(next);
};

/**
 * Requires a clinic user, i.e. one with an organisation.
 *
 * Platform roles have no organisation, so routes that read or write clinic data must
 * either use this or go through a support session.
 */
export const requireOrganisation = (_req: Request, _res: Response, next: NextFunction): void => {
  const context = getContext();

  if (context?.userId === undefined) {
    next(new UnauthorizedError('not authenticated', 'Authentication is required.'));
    return;
  }

  if (context.organisationId === undefined) {
    next(
      new ForbiddenError('no organisation on this principal', 'This endpoint is for clinic users.'),
    );
    return;
  }

  next();
};

export const DEVICE_TOKEN_HEADER = 'x-device-token';

/**
 * Authenticates a paired device.
 *
 * Sets an organisation and a device id but NO role, so a device cannot satisfy a
 * permission check. A user's access token is a JWT and will not match a stored device
 * token hash, and a device token is not a JWT, so neither credential works on the
 * other's endpoints.
 */
export const requireDevice = (req: Request, _res: Response, next: NextFunction): void => {
  const header = req.headers[DEVICE_TOKEN_HEADER];
  const token = typeof header === 'string' && header.length > 0 ? header : undefined;

  if (token === undefined) {
    next(new UnauthorizedError('missing device token', 'Device authentication is required.'));
    return;
  }

  authenticateDevice(token)
    .then((principal) => {
      const existing = getContext();
      if (existing === undefined) {
        next(new Error('requireDevice used without requestContextMiddleware'));
        return;
      }

      runWithContext(
        {
          ...existing,
          organisationId: principal.organisationId,
          deviceId: principal.deviceId,
        },
        () => {
          next();
        },
      );
    })
    .catch(next);
};

/** Rejects a principal that is a device, for endpoints that require a human user. */
export const requireUser = (_req: Request, _res: Response, next: NextFunction): void => {
  const context = getContext();

  if (context?.userId === undefined || context.deviceId !== undefined) {
    next(new UnauthorizedError('not a user principal', 'Authentication is required.'));
    return;
  }

  next();
};
