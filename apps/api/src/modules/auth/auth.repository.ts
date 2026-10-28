import type { Role } from '@openhours/shared';
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
  /**
   * The database enum, not a string. Declaring it `string` here is what let the token
   * signer accept an unconstrained role, and narrowing the signer for review finding I13
   * turned that into a compile error rather than a silent widening.
   *
   * This is also the guard against the other half of I13, a value added to the schema's
   * `Role` enum without a matching row in the matrix: Prisma's generated union would then
   * be wider than the shared `Role`, and this assignment would not compile. So the two
   * cannot drift apart unnoticed, and no runtime test is needed to say so.
   */
  readonly role: Role;
  readonly status: string;
  /**
   * The owning organisation's status, or null for the two platform roles, which belong to
   * no organisation.
   *
   * Null therefore means "not applicable", NOT "unknown": a clinic user always has one,
   * enforced by a CHECK constraint on `organisation_id`. The service must not treat null
   * as a refusal or every platform login would fail, and must not treat it as permission
   * either. Both directions have a test.
   */
  readonly organisationStatus: string | null;
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

/**
 * Shapes a user row, flattening the organisation relation to the one field auth needs.
 *
 * The relation is not returned as-is because `AuthUser` is consumed by the service and a
 * nested object there invites reading more of the organisation than authentication should
 * care about.
 */
const toAuthUser = (
  row: {
    readonly organisation: { readonly status: string } | null;
  } & Omit<AuthUser, 'organisationStatus'>,
): AuthUser => {
  const { organisation, ...user } = row;
  return { ...user, organisationStatus: organisation?.status ?? null };
};

export const findUserByEmail = async (db: TenantDb, email: string): Promise<AuthUser | null> => {
  const row = await db.user.findUnique({
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
      // Joined rather than fetched separately: a second query would be a second round
      // trip on the login path, and this runs under platform scope where the join is
      // not restricted by row-level security.
      organisation: { select: { status: true } },
    },
  });

  return row === null ? null : toAuthUser(row);
};

export const findUserById = async (db: TenantDb, id: string): Promise<AuthUser | null> => {
  const row = await db.user.findUnique({
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
      // Joined rather than fetched separately: a second query would be a second round
      // trip on the login path, and this runs under platform scope where the join is
      // not restricted by row-level security.
      organisation: { select: { status: true } },
    },
  });

  return row === null ? null : toAuthUser(row);
};

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

/**
 * Clears an EXPIRED lock and its counter, so the next attempt starts from zero.
 *
 * Without this, `failedLoginCount` was reset only by a successful login. After five
 * failures it sat at 5 for ever, so one wrong password took it to 6, which is still at or
 * above the limit, and re-locked the account for another window. Anyone who knew a
 * clinic owner's email could keep them locked out permanently at four requests an hour,
 * from any address, and the per-email throttle did not interfere.
 *
 * `updateMany` with the expiry in the `where`, not `update`: a concurrent attempt that
 * has just set a fresh lock must not have it cleared by this call.
 */
export const clearExpiredLockout = async (db: TenantDb, userId: string): Promise<void> => {
  await db.user.updateMany({
    where: { id: userId, lockedUntil: { lte: new Date() } },
    data: { failedLoginCount: 0, lockedUntil: null },
  });
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
