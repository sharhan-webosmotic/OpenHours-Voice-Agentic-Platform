import type { TenantDb } from '../../db/tenant-client.js';

/** The only place in the support-session module that touches Prisma. */

/**
 * Organisations this platform user has opened a support session for, ever.
 *
 * Expired and revoked sessions are included on purpose. The question being answered is
 * "which clinics has this admin been involved with", which is what decides whether they
 * may see that clinic's audit entries. Excluding expired ones would hide the trail of
 * an admin's own past access from them an hour after they used it.
 */
export const organisationIdsWithSessionFor = async (
  db: TenantDb,
  platformUserId: string,
): Promise<readonly string[]> => {
  const rows = await db.supportSession.findMany({
    where: { platformUserId },
    select: { organisationId: true },
    distinct: ['organisationId'],
  });

  return rows.map((row) => row.organisationId);
};
