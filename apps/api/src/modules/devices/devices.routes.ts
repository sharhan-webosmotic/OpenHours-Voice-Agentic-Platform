import { Router, type Request, type Response } from 'express';
import { createRateLimiter } from '../../common/rate-limit.js';
import { UnauthorizedError } from '../../common/errors.js';
import { getContext } from '../../common/request-context.js';
import { validate, validatedData } from '../../common/validate.js';
import { registerRoute } from '../../common/route-registry.js';
import { requireAuth, requireOrganisation, requireUser } from '../../common/auth.middleware.js';
import { tenantDb, tenantMiddleware } from '../../db/tenant.middleware.js';
import { pairDeviceBodySchema } from '../auth/auth.schemas.js';
import * as service from './devices.service.js';

/**
 * Device pairing.
 *
 * Issuing a code is a clinic-user action and runs tenant-scoped. Redeeming one is
 * unauthenticated by definition (the device has no credential yet), so it is rate
 * limited hard: a 6-character code is only safe because guessing is bounded.
 */

const pairLimiter = createRateLimiter({ windowMs: 600_000, limit: 10 });

/**
 * Registered once at import: the API surface is static, and the registry refuses a
 * duplicate path so that the generated OpenAPI can never describe only one of two.
 */
registerRoute({
  method: 'post',
  path: '/api/v1/devices/pairing-codes',
  summary: 'Issue a single-use device pairing code',
  permission: 'device:create',
  phiSensitive: false,
});

registerRoute({
  method: 'post',
  path: '/api/v1/devices/pair',
  summary: 'Exchange a pairing code for a device token',
  body: pairDeviceBodySchema,
  phiSensitive: false,
});

export const devicesRouter = (): Router => {
  const router = Router();

  router.post(
    '/pairing-codes',
    requireAuth,
    requireUser,
    requireOrganisation,
    tenantMiddleware,
    async (req: Request, res: Response) => {
      const context = getContext();

      if (
        context?.organisationId === undefined ||
        context.userId === undefined ||
        context.role === undefined
      ) {
        throw new UnauthorizedError('not authenticated', 'Authentication is required.');
      }

      const issued = await service.issuePairingCode(tenantDb(req), {
        organisationId: context.organisationId,
        actorRole: context.role,
        actorUserId: context.userId,
      });

      // The code is returned once and never retrievable again: only its hash is stored.
      res.status(201).json({ code: issued.code, expiresAt: issued.expiresAt.toISOString() });
    },
  );

  router.post(
    '/pair',
    pairLimiter,
    validate({ body: pairDeviceBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, { code: string; label: string }>(req);
      const paired = await service.pairDevice(body.code.toUpperCase(), body.label);

      res.status(201).json({
        deviceToken: paired.deviceToken,
        deviceId: paired.deviceId,
        organisationId: paired.organisationId,
      });
    },
  );

  return router;
};
