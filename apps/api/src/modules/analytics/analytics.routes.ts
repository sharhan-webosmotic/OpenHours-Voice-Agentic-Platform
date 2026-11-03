import { Router, type Request, type RequestHandler, type Response } from 'express';
import { registerRoute } from '../../common/route-registry.js';
import { validate, validatedData } from '../../common/validate.js';
import {
  requireAuth,
  requirePasswordChangeComplete,
  requireUser,
} from '../../common/auth.middleware.js';
import { currentPrincipal } from '../../common/permissions.js';
import * as schemas from './analytics.schemas.js';
import * as service from './analytics.service.js';

const AUTHENTICATED: readonly RequestHandler[] = [
  requireAuth,
  requireUser,
  requirePasswordChangeComplete,
];

registerRoute({
  method: 'get',
  path: '/api/v1/analytics/overview',
  summary: 'The overview cards: calls, AI bookings, requests, attention, revenue estimate',
  query: schemas.overviewQuerySchema,
  response: schemas.overviewResponseSchema,
  permission: 'analytics:read',
  // Counts and sums only. It names nobody, which is also why the matrix lets a platform
  // role read it at scope `usage`.
  phiSensitive: false,
});

export const analyticsRouter = (): Router => {
  const router = Router();

  router.get(
    '/overview',
    ...AUTHENTICATED,
    validate({ query: schemas.overviewQuerySchema }),
    async (req: Request, res: Response) => {
      const { query } = validatedData<unknown, schemas.OverviewQuery>(req);
      const result = await service.overview(currentPrincipal(), query.organisationId, query.range);

      res.status(200).json(result);
    },
  );

  return router;
};
