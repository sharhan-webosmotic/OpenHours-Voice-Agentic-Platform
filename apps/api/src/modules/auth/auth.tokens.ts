import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { isRole, type Role } from '@openhours/shared';
import { config } from '../../config.js';
import { UnauthorizedError } from '../../common/errors.js';

/**
 * Access tokens.
 *
 * Short-lived and self-contained: nothing is looked up to validate one, which is what
 * makes them fast and also what makes them impossible to revoke. Anything that must take
 * effect immediately (deactivation, role change) is enforced at refresh time instead,
 * which is why the access lifetime is minutes rather than hours.
 */

const ISSUER = 'openhours';
const AUDIENCE = 'openhours-api';

export type AccessTokenClaims = {
  readonly userId: string;
  /** NULL for the two platform roles, which belong to no organisation. */
  readonly organisationId: string | null;
  /**
   * One of the six roles, checked against the matrix at verification time rather than
   * carried as an arbitrary string. Narrowing it here is what stops an unrecognised role
   * reaching the permission matrix.
   */
  readonly role: Role;
};

const secret = (): Uint8Array => new TextEncoder().encode(config.JWT_SECRET);

export const signAccessToken = async (claims: AccessTokenClaims): Promise<string> =>
  new SignJWT({
    org: claims.organisationId,
    role: claims.role,
  } satisfies JWTPayload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(claims.userId)
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${config.ACCESS_TOKEN_TTL_SECONDS}s`)
    .sign(secret());

/**
 * Verifies signature, issuer, audience and expiry, then shape.
 *
 * Every failure returns the same error: a token that is expired, tampered with or signed
 * by someone else must be indistinguishable to the caller.
 */
export const verifyAccessToken = async (token: string): Promise<AccessTokenClaims> => {
  try {
    const { payload } = await jwtVerify(token, secret(), {
      issuer: ISSUER,
      audience: AUDIENCE,
      algorithms: ['HS256'],
    });

    const { sub, org, role } = payload;

    if (typeof sub !== 'string') {
      throw new Error('missing claims');
    }
    /**
     * The role must be one the matrix knows, not merely a string.
     *
     * Only our own signing key can mint a token and `signAccessToken` takes the role from
     * a database enum, so this needs the JWT secret to exploit and the practical risk is
     * low. It is still the difference between denying an unknown role and throwing on it.
     * Review finding I13.
     */
    if (!isRole(role)) {
      throw new Error('invalid role claim');
    }
    if (org !== null && typeof org !== 'string') {
      throw new Error('invalid org claim');
    }

    return { userId: sub, organisationId: org, role };
  } catch {
    throw new UnauthorizedError('invalid access token', 'Authentication failed.');
  }
};
