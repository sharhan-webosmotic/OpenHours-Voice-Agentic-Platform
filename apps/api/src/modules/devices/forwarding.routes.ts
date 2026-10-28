import { Router, type Request, type Response } from 'express';
import { getContext } from '../../common/request-context.js';
import { UnauthorizedError } from '../../common/errors.js';
import { registerRoute } from '../../common/route-registry.js';
import { requireDevice } from '../../common/auth.middleware.js';
import { tenantDb, tenantMiddleware } from '../../db/tenant.middleware.js';

/**
 * The forwarding endpoints, and the ONLY place a device token is accepted.
 *
 * Deliberately minimal for M1-08: it exists so "a device token reaches forwarding and
 * nothing else" is a testable claim rather than a comment. The schedule logic itself is
 * a later ticket.
 */
/**
 * Registered once at import: the API surface is static, and the registry refuses a
 * duplicate path so that the generated OpenAPI can never describe only one of two.
 */
registerRoute({
  method: 'get',
  path: '/api/v1/forwarding/schedules',
  summary: 'The forwarding schedule for the paired device organisation',
  phiSensitive: false,
});

export const forwardingRouter = (): Router => {
  const router = Router();

  router.get('/schedules', requireDevice, tenantMiddleware, async (req: Request, res: Response) => {
    const context = getContext();

    if (context?.deviceId === undefined) {
      throw new UnauthorizedError('not a device principal', 'Device authentication required.');
    }

    const schedules = await tenantDb(req).forwardingSchedule.findMany({
      where: { active: true },
      orderBy: [{ weekday: 'asc' }, { startAtMinute: 'asc' }],
      select: {
        id: true,
        weekday: true,
        startAtMinute: true,
        endAtMinute: true,
        forwardingOn: true,
      },
    });

    res.status(200).json({ items: schedules });
  });

  return router;
};
