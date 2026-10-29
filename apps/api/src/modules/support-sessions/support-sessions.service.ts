import { logger } from '../../common/logger.js';
import { ForbiddenError } from '../../common/errors.js';
import { uuidV7 } from '../../common/uuid.js';
import { asSystem } from '../../db/tenant-client.js';
import * as audit from '../audit/audit.service.js';
import { isPlatformRole, type Role } from '@clinicai/shared';

/**
 * Support sessions: a time-boxed, audited grant that unmasks patient fields for ONE
 * organisation.
 *
 * Without one, a platform role reads patient data masked. The session is the record of
 * why someone looked, which is what makes casual browsing visible rather than merely
 * discouraged (tenant-security-phi: "platform staff must not browse patient data
 * casually").
 */

/** Fixed at 60 minutes. Long enough to diagnose a problem, short enough to expire. */
const DURATION_MINUTES = 60;

export type SupportSession = {
  readonly id: string;
  readonly organisationId: string;
  readonly expiresAt: Date;
};

export const openSupportSession = async (input: {
  readonly actorUserId: string;
  readonly actorRole: Role;
  readonly organisationId: string;
  readonly reason: string;
}): Promise<SupportSession> => {
  if (!isPlatformRole(input.actorRole)) {
    // A clinic role already sees its own patients unmasked; a session would be
    // meaningless, and allowing one would create a path to another organisation.
    throw new ForbiddenError(
      'only a platform role may open a support session',
      'You do not have permission to do that.',
    );
  }

  return asSystem('support-session.open', async (db) => {
    const organisation = await db.organisation.findUnique({
      where: { id: input.organisationId },
      select: { id: true },
    });

    if (organisation === null) {
      // NotFound would be the tenant rule, but this IS the cross-tenant path and the
      // organisation id is supplied deliberately, so a plain refusal is correct.
      throw new ForbiddenError('organisation not found', 'That organisation does not exist.');
    }

    const expiresAt = new Date(Date.now() + DURATION_MINUTES * 60_000);
    const id = uuidV7();

    await db.supportSession.create({
      data: {
        id,
        organisationId: input.organisationId,
        platformUserId: input.actorUserId,
        reason: input.reason,
        expiresAt,
      },
    });

    /**
     * Through the audit module rather than a direct insert, so this row carries the
     * request id, ip and user agent like every other entry. An earlier version wrote it
     * by hand and silently lacked all three, which left no way to tie an unmasking back
     * to the request that caused it.
     *
     * The target organisation is named explicitly: a platform role has none in context.
     */
    await audit.record(db, {
      action: 'support_session.opened',
      entityType: 'support_session',
      entityId: id,
      organisationId: input.organisationId,
      metadata: { reason: input.reason, expiresAt: expiresAt.toISOString() },
    });

    logger.info(
      { organisationId: input.organisationId, actorUserId: input.actorUserId, expiresAt },
      'support session opened',
    );

    return { id, organisationId: input.organisationId, expiresAt };
  });
};

/**
 * Whether `actorUserId` currently has an unexpired, unrevoked session for the
 * organisation.
 *
 * Checked per request rather than cached: a revoked session must stop working at once,
 * and the lookup is one indexed row.
 */
export const hasActiveSupportSession = async (
  actorUserId: string,
  organisationId: string,
): Promise<boolean> =>
  asSystem('support-session.check', async (db) => {
    const found = await db.supportSession.findFirst({
      where: {
        platformUserId: actorUserId,
        organisationId,
        revokedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: { id: true },
    });

    return found !== null;
  });
