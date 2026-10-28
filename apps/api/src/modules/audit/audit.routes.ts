import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { registerRoute } from '../../common/route-registry.js';
import { validate, validatedData } from '../../common/validate.js';
import { isPlatformRole } from '@openhours/shared';
import {
  requireAuth,
  requirePasswordChangeComplete,
  requireUser,
} from '../../common/auth.middleware.js';
import { currentPrincipal, requirePermission } from '../../common/permissions.js';
import { withPrincipalScope } from '../../db/principal-scope.js';
import { organisationIdsWithSessionFor } from '../support-sessions/support-sessions.repository.js';
import {
  MAX_PAGE_SIZE,
  list,
  record,
  type AuditListFilters,
  type AuditPage,
} from './audit.service.js';

export const auditQuerySchema = z.object({
  actorUserId: z.string().uuid().optional(),
  action: z.string().min(1).max(120).optional(),
  entityType: z.string().min(1).max(120).optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(50),
});

/** Declared on the descriptor and written by the handler. One constant, so they agree. */
const AUDIT_READ_ACTION = 'audit_log.read';

registerRoute({
  method: 'get',
  path: '/api/v1/audit-logs',
  summary: 'List audit entries, newest first',
  query: auditQuerySchema,
  permission: 'audit_log:read',
  // The rows describe PHI access without containing PHI, so reading the trail is itself
  // worth recording.
  phiSensitive: true,
  auditAction: AUDIT_READ_ACTION,
});

export const auditRouter = (): Router => {
  const router = Router();

  router.get(
    '/',
    requireAuth,
    requireUser,
    requirePasswordChangeComplete,
    /**
     * No tenantMiddleware here, deliberately.
     *
     * That middleware requires an organisation in context, and a platform role has
     * none, so gating this route on it refused SUPER_ADMIN and INTERNAL_ADMIN outright
     * even though the matrix grants them read on audit_log. The scope is therefore
     * resolved per principal below: a clinic role reads inside its own tenant
     * transaction, a platform role reads cross-tenant through asSystem, which audits
     * the use of that scope.
     */
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

      const baseFilters: AuditListFilters = {
        ...(query.action === undefined ? {} : { action: query.action }),
        ...(query.entityType === undefined ? {} : { entityType: query.entityType }),
        ...(query.from === undefined ? {} : { from: query.from }),
        ...(query.to === undefined ? {} : { to: query.to }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        limit: query.limit,
      };

      const page = await readPage(principal, scope, baseFilters, query.actorUserId);

      res.status(200).json({ items: page.items, nextCursor: page.nextCursor });
    },
  );

  return router;
};

/**
 * Reads the page under whichever scope the principal's role grants, and records the read.
 *
 * Reading the whole audit trail for an organisation is itself a sensitive act, so root
 * CLAUDE.md rule 5 applies to it. This call used to be missing: the route declared
 * `auditAction: 'audit_log.read'` and wrote nothing, and the guard that was supposed to
 * catch that inspected the route descriptor rather than the route's behaviour, so it
 * reported green. The guard now drives real requests (tests/phi-routes-are-audited.test.ts).
 */
const readPage = async (
  principal: ReturnType<typeof currentPrincipal>,
  scope: ReturnType<typeof requirePermission>,
  baseFilters: AuditListFilters,
  requestedActorUserId: string | undefined,
): Promise<AuditPage> =>
  withPrincipalScope(principal, 'audit.read', async (db) => {
    const page = await readUnderScope(db, principal, scope, baseFilters, requestedActorUserId);

    // Written AFTER the read, so this request's own entry is not inside its own result,
    // and inside the same transaction, so a failed read records nothing. Counts only:
    // the filters could name an actor, and an audit row never carries the values it
    // describes.
    await record(db, {
      action: AUDIT_READ_ACTION,
      entityType: 'audit_log',
      metadata: { returned: page.items.length, limit: baseFilters.limit ?? 0, scope },
    });

    return page;
  });

/** The scope resolution, split out so the audit write above cannot be skipped on a branch. */
const readUnderScope = async (
  db: Parameters<typeof list>[0],
  principal: ReturnType<typeof currentPrincipal>,
  scope: ReturnType<typeof requirePermission>,
  baseFilters: AuditListFilters,
  requestedActorUserId: string | undefined,
): Promise<AuditPage> => {
  if (!isPlatformRole(principal.role) || scope === 'all') {
    /**
     * A clinic role is already confined to its own organisation by the scope, so no
     * organisation filter is needed or wanted. SUPER_ADMIN has `all`, meaning the
     * whole platform. Both therefore take the filters as given.
     */
    return list(db, {
      ...baseFilters,
      ...(requestedActorUserId === undefined ? {} : { actorUserId: requestedActorUserId }),
    });
  }

  /**
   * INTERNAL_ADMIN (`audit_scope`): the organisations they have opened a support
   * session for, plus their own actions. That is the agreed table's definition with
   * one part missing: it also says "assigned organisations", and no assignment
   * mechanism exists yet, so an organisation this admin has never opened a session
   * for is not visible. Recorded in docs/FOUNDATION-REPORT.md.
   */
  const organisationIds = await organisationIdsWithSessionFor(db, principal.userId);

  return list(db, {
    ...baseFilters,
    scopedTo: { organisationIds, orActorUserId: principal.userId },
  });
};
