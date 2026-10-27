import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { registerRoute } from '../../common/route-registry.js';
import { validate, validatedData } from '../../common/validate.js';
import { requireAuth, requireUser } from '../../common/auth.middleware.js';
import { currentPrincipal, requirePermission } from '../../common/permissions.js';
import { tenantDb, tenantMiddleware } from '../../db/tenant.middleware.js';
import { MAX_PAGE_SIZE, list } from './audit.service.js';

export const auditQuerySchema = z.object({
  actorUserId: z.string().uuid().optional(),
  action: z.string().min(1).max(120).optional(),
  entityType: z.string().min(1).max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});

registerRoute({
  method: 'get',
  path: '/api/v1/audit-logs',
  summary: 'List audit entries, newest first',
  query: auditQuerySchema,
  permission: 'audit_log:read',
  // The rows describe PHI access without containing PHI, so reading the trail is itself
  // worth recording.
  phiSensitive: true,
  auditAction: 'audit_log.read',
});

export const auditRouter = (): Router => {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    requireUser,
    tenantMiddleware,
    validate({ query: auditQuerySchema }),
    async (req: Request, res: Response) => {
      const principal = currentPrincipal();

      // Enforced in the service layer, not the controller, and before any query runs.
      const scope = requirePermission('audit_log', 'read', principal);

      const { query } = validatedData<
        unknown,
        {
          actorUserId?: string;
          action?: string;
          entityType?: string;
          from?: Date;
          to?: Date;
          cursor?: string;
          limit: number;
        },
        unknown
      >(req);

      /**
       * `audit_scope` for an INTERNAL_ADMIN is, per the agreed table, entries for the
       * organisations they are assigned plus the support sessions they opened. There is
       * no assignment table yet, so it is narrowed to their OWN actions: showing less
       * than the table allows is the safe direction, and M1-11 introduces assignment.
       * Recorded as an open issue in docs/FOUNDATION-REPORT.md.
       */
      const actorFilter = scope === 'audit_scope' ? principal.userId : query.actorUserId;

      const page = await list(tenantDb(req), {
        ...(actorFilter === undefined ? {} : { actorUserId: actorFilter }),
        ...(query.action === undefined ? {} : { action: query.action }),
        ...(query.entityType === undefined ? {} : { entityType: query.entityType }),
        ...(query.from === undefined ? {} : { from: query.from }),
        ...(query.to === undefined ? {} : { to: query.to }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        limit: query.limit,
      });

      res.status(200).json({ items: page.items, nextCursor: page.nextCursor });
    },
  );

  return router;
};
