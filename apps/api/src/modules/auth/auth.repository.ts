import type { TenantDb } from '../../db/tenant-client.js';
import { uuidV7 } from '../../common/uuid.js';

/**
 * The only place in the auth module that touches the database.
 *
 * Every method here runs under `asSystem`, because login and refresh have no tenant yet:
 * the organisation is a RESULT of authenticating, not an input to it.
 */

export type AuthUser = {
  readonly id: string;
  readonly organisationId: string | null;
  readonly email: string;
  readonly passwordHash: string;
  readonly role: string;
  readonly status: string;
  readonly mustChangePassword: boolean;
  readonly failedLoginCount: number;
  readonly lockedUntil: Date | null;
};

export type StoredRefreshToken = {
  readonly id: string;
  readonly userId: string;
  readonly familyId: string;
  readonly expiresAt: Date;
  readonly revokedAt: Date | null;
};

export const findUserByEmail = async (db: TenantDb, email: string): Promise<AuthUser | null> =>
  db.user.findUnique({
    where: { email },
    select: {
      id: true,
      organisationId: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
      mustChangePassword: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

export const findUserById = async (db: TenantDb, id: string): Promise<AuthUser | null> =>
  db.user.findUnique({
    where: { id },
    select: {
      id: true,
      organisationId: true,
      email: true,
      passwordHash: true,
      role: true,
      status: true,
      mustChangePassword: true,
      failedLoginCount: true,
      lockedUntil: true,
    },
  });

export const recordFailedLogin = async (
  db: TenantDb,
  userId: string,
  maxFailures: number,
  lockoutMinutes: number,
): Promise<void> => {
  const user = await db.user.update({
    where: { id: userId },
    data: { failedLoginCount: { increment: 1 } },
    select: { failedLoginCount: true },
  });

  if (user.failedLoginCount >= maxFailures) {
    await db.user.update({
      where: { id: userId },
      data: { lockedUntil: new Date(Date.now() + lockoutMinutes * 60_000) },
    });
  }
};

export const recordSuccessfulLogin = async (db: TenantDb, userId: string): Promise<void> => {
  await db.user.update({
    where: { id: userId },
    data: { failedLoginCount: 0, lockedUntil: null, lastLoginAt: new Date() },
  });
};

export const createRefreshToken = async (
  db: TenantDb,
  input: {
    readonly userId: string;
    readonly tokenHash: string;
    readonly familyId: string;
    readonly expiresAt: Date;
  },
): Promise<void> => {
  await db.refreshToken.create({ data: { id: uuidV7(), ...input } });
};

export const findRefreshTokenByHash = async (
  db: TenantDb,
  tokenHash: string,
): Promise<StoredRefreshToken | null> =>
  db.refreshToken.findUnique({
    where: { tokenHash },
    select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true },
  });

export const revokeRefreshToken = async (db: TenantDb, id: string): Promise<void> => {
  await db.refreshToken.update({ where: { id }, data: { revokedAt: new Date() } });
};

/**
 * Revokes every token in a rotation family.
 *
 * Called when an already-used token is presented again: either the token was stolen, or
 * the legitimate client is replaying. Neither can be distinguished, so the whole family
 * dies and the user re-authenticates.
 */
export const revokeTokenFamily = async (db: TenantDb, familyId: string): Promise<number> => {
  const { count } = await db.refreshToken.updateMany({
    where: { familyId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
};

/**
 * Revokes every live token for a user, across all families.
 *
 * Distinct from revokeTokenFamily: ending ONE session (logout, reuse detection) is a
 * family operation, while ending EVERY session (password change, deactivation) is a user
 * operation. Passing a user id to the family version silently matches nothing.
 */
export const revokeAllTokensForUser = async (db: TenantDb, userId: string): Promise<number> => {
  const { count } = await db.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
  return count;
};

export const updatePassword = async (
  db: TenantDb,
  userId: string,
  passwordHash: string,
): Promise<void> => {
  await db.user.update({
    where: { id: userId },
    data: { passwordHash, mustChangePassword: false },
  });
};
