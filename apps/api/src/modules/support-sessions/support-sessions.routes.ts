import { Router, type Request, type Response } from 'express';
import { z } from 'zod';
import { registerRoute } from '../../common/route-registry.js';
import { validate, validatedData } from '../../common/validate.js';
import { requireAuth, requireUser } from '../../common/auth.middleware.js';
import { currentPrincipal } from '../../common/permissions.js';
import * as service from './support-sessions.service.js';

export const supportSessionBodySchema = z.object({
  organisationId: z.string().uuid(),
  // Required and non-trivial: an unexplained unmasking is not auditable.
  reason: z.string().trim().min(10).max(500),
});

registerRoute({
  method: 'post',
  path: '/api/v1/support-sessions',
  summary: 'Open a 60-minute audited grant to unmask one organisation',
  body: supportSessionBodySchema,
  // No `permission`: this route is NOT gated by a matrix cell. It declared
  // `patients:read` and nothing checked it. The real control is the isPlatformRole test
  // in openSupportSession, which refuses every clinic role.
  // The session itself holds no patient data, but it governs access to it, so it is
  // flagged: every call must be audited.
  phiSensitive: true,
  auditAction: 'support_session.opened',
});

export const supportSessionsRouter = (): Router => {
  const router = Router();

  router.post(
    '/',
    requireAuth,
    requireUser,
    validate({ body: supportSessionBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, { organisationId: string; reason: string }>(
        req,
      );
      const principal = currentPrincipal();

      const session = await service.openSupportSession({
        actorUserId: principal.userId,
        actorRole: principal.role,
        organisationId: body.organisationId,
        reason: body.reason,
      });

      res.status(201).json({
        id: session.id,
        organisationId: session.organisationId,
        expiresAt: session.expiresAt.toISOString(),
      });
    },
  );

  return router;
};
