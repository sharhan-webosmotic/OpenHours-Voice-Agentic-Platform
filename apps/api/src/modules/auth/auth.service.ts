import { config } from '../../config.js';
import { logger } from '../../common/logger.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../../common/errors.js';
import { uuidV7 } from '../../common/uuid.js';
import {
  MINIMUM_PASSWORD_LENGTH,
  hashPassword,
  spendVerificationWork,
  verifyPassword,
} from '../../common/passwords.js';
import { generateOpaqueToken, hashToken } from '../../common/tokens.js';
import { asSystem } from '../../db/tenant-client.js';
import { signAccessToken } from './auth.tokens.js';
import * as repository from './auth.repository.js';

/**
 * Authentication.
 *
 * Everything here runs through `asSystem`, because the organisation is a RESULT of
 * authenticating rather than an input to it: there is no tenant to scope to until the
 * user is known.
 *
 * Nothing in this module logs an email, a password or a token. Failures are logged by
 * user id where one is known, and by reason otherwise.
 */

export type LoginResult = {
  readonly accessToken: string;
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: Date;
  readonly mustChangePassword: boolean;
  readonly user: {
    readonly id: string;
    readonly organisationId: string | null;
    readonly role: string;
  };
};

/** One error for every failure mode, so login never reveals which accounts exist. */
const loginFailed = (): UnauthorizedError =>
  new UnauthorizedError('login failed', 'Email or password is incorrect.');

const refreshTtl = (): Date =>
  new Date(Date.now() + config.REFRESH_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000);

const issueTokens = async (
  db: Parameters<Parameters<typeof asSystem>[1]>[0],
  user: { id: string; organisationId: string | null; role: string },
  familyId: string,
): Promise<{ accessToken: string; refreshToken: string; expiresAt: Date }> => {
  const accessToken = await signAccessToken({
    userId: user.id,
    organisationId: user.organisationId,
    role: user.role,
  });

  const refreshToken = generateOpaqueToken();
  const expiresAt = refreshTtl();

  await repository.createRefreshToken(db, {
    userId: user.id,
    tokenHash: hashToken(refreshToken),
    familyId,
    expiresAt,
  });

  return { accessToken, refreshToken, expiresAt };
};

/**
 * Why these functions return an outcome instead of throwing inside `asSystem`:
 *
 * asSystem opens a transaction. Throwing inside it ROLLS BACK everything written in
 * that transaction, including the failed-login counter and any family revocation. An
 * earlier version did exactly that, so lockout never incremented and a reused refresh
 * token was never actually revoked: both looked correct in the code and did nothing.
 *
 * So the transaction records what happened and returns; the error is thrown after it
 * has committed.
 */
type LoginOutcome =
  | { readonly kind: 'ok'; readonly result: LoginResult }
  | { readonly kind: 'failed'; readonly reason: string; readonly userId?: string };

export const login = async (email: string, password: string): Promise<LoginResult> => {
  const outcome = await asSystem('auth.login', async (db): Promise<LoginOutcome> => {
    const user = await repository.findUserByEmail(db, email);

    if (user === null) {
      // Spend the same argon2 work as a real verification: otherwise the response time
      // answers "does this address exist?".
      await spendVerificationWork(password);
      return { kind: 'failed', reason: 'unknown-email' };
    }

    if (user.lockedUntil !== null && user.lockedUntil > new Date()) {
      await spendVerificationWork(password);
      return { kind: 'failed', reason: 'locked', userId: user.id };
    }

    if (user.lockedUntil !== null) {
      // Reached only when a lock has EXPIRED, because the branch above returns while it
      // is live. Clearing the counter here, before this attempt is counted, is what stops
      // an unauthenticated attacker holding an account locked for ever with one wrong
      // password per window.
      await repository.clearExpiredLockout(db, user.id);
    }

    if (user.status !== 'ACTIVE') {
      await spendVerificationWork(password);
      return { kind: 'failed', reason: 'inactive', userId: user.id };
    }

    if (!(await verifyPassword(user.passwordHash, password))) {
      await repository.recordFailedLogin(
        db,
        user.id,
        config.LOGIN_MAX_FAILURES,
        config.LOCKOUT_MINUTES,
      );
      return { kind: 'failed', reason: 'bad-password', userId: user.id };
    }

    await repository.recordSuccessfulLogin(db, user.id);

    // A fresh family per login, so revoking one session does not end the others.
    const tokens = await issueTokens(db, user, uuidV7());

    return {
      kind: 'ok',
      result: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresAt: tokens.expiresAt,
        mustChangePassword: user.mustChangePassword,
        user: { id: user.id, organisationId: user.organisationId, role: user.role },
      },
    };
  });

  if (outcome.kind === 'failed') {
    logger.warn({ reason: outcome.reason, userId: outcome.userId }, 'login failed');
    // One error for every failure mode, including lockout: saying "locked" would
    // confirm the account exists.
    throw loginFailed();
  }

  logger.info(
    { userId: outcome.result.user.id, role: outcome.result.user.role },
    'login succeeded',
  );
  return outcome.result;
};

/**
 * Rotates a refresh token.
 *
 * Presenting a token that was already used or revoked kills the whole family. A stolen
 * token and a replaying client are indistinguishable, so the safe response to either is
 * to end every session in that lineage.
 *
 * Deactivation and role changes take effect here, which is the only place they can:
 * an access token is self-contained and cannot be revoked once issued.
 */
type RefreshOutcome =
  | { readonly kind: 'ok'; readonly result: LoginResult }
  | {
      readonly kind: 'rejected';
      readonly reason: 'unknown' | 'reuse' | 'expired' | 'inactive';
      readonly userId?: string;
      readonly revoked?: number;
    };

export const refresh = async (presentedToken: string): Promise<LoginResult> => {
  const outcome = await asSystem('auth.refresh', async (db): Promise<RefreshOutcome> => {
    const stored = await repository.findRefreshTokenByHash(db, hashToken(presentedToken));

    if (stored === null) {
      return { kind: 'rejected', reason: 'unknown' };
    }

    if (stored.revokedAt !== null) {
      // A stolen token and a replaying client cannot be told apart, so the whole
      // lineage dies. This revocation MUST survive, which is why it is not followed by
      // a throw inside this transaction.
      const revoked = await repository.revokeTokenFamily(db, stored.familyId);
      return { kind: 'rejected', reason: 'reuse', userId: stored.userId, revoked };
    }

    if (stored.expiresAt <= new Date()) {
      await repository.revokeRefreshToken(db, stored.id);
      return { kind: 'rejected', reason: 'expired', userId: stored.userId };
    }

    const user = await repository.findUserById(db, stored.userId);

    if (user === null || user.status !== 'ACTIVE') {
      const revoked = await repository.revokeTokenFamily(db, stored.familyId);
      return { kind: 'rejected', reason: 'inactive', userId: stored.userId, revoked };
    }

    // Rotate: the presented token dies as its replacement is issued, in one
    // transaction, so there is never a moment where both are valid.
    await repository.revokeRefreshToken(db, stored.id);
    const tokens = await issueTokens(db, user, stored.familyId);

    return {
      kind: 'ok',
      result: {
        accessToken: tokens.accessToken,
        refreshToken: tokens.refreshToken,
        refreshTokenExpiresAt: tokens.expiresAt,
        mustChangePassword: user.mustChangePassword,
        user: { id: user.id, organisationId: user.organisationId, role: user.role },
      },
    };
  });

  if (outcome.kind === 'rejected') {
    logger.warn(
      { reason: outcome.reason, userId: outcome.userId, revoked: outcome.revoked },
      'refresh rejected',
    );
    throw new UnauthorizedError(`refresh rejected: ${outcome.reason}`, 'Please sign in again.');
  }

  return outcome.result;
};

export const logout = async (presentedToken: string | undefined): Promise<void> =>
  asSystem('auth.logout', async (db) => {
    if (presentedToken === undefined) {
      return;
    }

    const stored = await repository.findRefreshTokenByHash(db, hashToken(presentedToken));
    if (stored === null) {
      // Logging out with an unknown token is not an error: the goal is reached.
      return;
    }

    // The whole family, so logging out ends the session rather than just this one hop.
    const revoked = await repository.revokeTokenFamily(db, stored.familyId);
    logger.info({ userId: stored.userId, revoked }, 'logout');
  });

export const changePassword = async (
  userId: string,
  currentPassword: string,
  newPassword: string,
): Promise<void> =>
  asSystem('auth.change-password', async (db) => {
    if (newPassword.length < MINIMUM_PASSWORD_LENGTH) {
      throw new ValidationError('password too short', 'The new password is too short.', [
        {
          field: 'body.newPassword',
          message: `Must be at least ${MINIMUM_PASSWORD_LENGTH} characters`,
        },
      ]);
    }

    const user = await repository.findUserById(db, userId);
    if (user === null) {
      throw new UnauthorizedError('user not found', 'Please sign in again.');
    }

    if (!(await verifyPassword(user.passwordHash, currentPassword))) {
      logger.warn({ userId }, 'password change rejected: current password incorrect');
      throw new ForbiddenError('current password incorrect', 'Current password is incorrect.');
    }

    await repository.updatePassword(db, userId, await hashPassword(newPassword));

    // Changing a password ends every session for this user, not just this family: if
    // the reason for the change was a compromise, leaving other sessions alive defeats
    // it. (An earlier version passed the user id to the family revoker, which matches
    // no family and would have revoked nothing.)
    const revoked = await repository.revokeAllTokensForUser(db, userId);
    logger.info({ userId, revoked }, 'password changed');
  });

export const currentUser = async (userId: string) =>
  asSystem('auth.me', async (db) => {
    const user = await repository.findUserById(db, userId);
    if (user === null) {
      throw new UnauthorizedError('user not found', 'Please sign in again.');
    }
    return {
      id: user.id,
      organisationId: user.organisationId,
      role: user.role,
      mustChangePassword: user.mustChangePassword,
    };
  });
