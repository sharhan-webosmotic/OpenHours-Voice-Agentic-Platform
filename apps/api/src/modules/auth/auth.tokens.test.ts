import { describe, expect, it } from 'vitest';
import { SignJWT } from 'jose';
import { config } from '../../config.js';
import { UnauthorizedError } from '../../common/errors.js';
import { signAccessToken, verifyAccessToken } from './auth.tokens.js';

/**
 * The claim-shape checks that run AFTER the signature has verified.
 *
 * These were the uncovered lines in this file, and they are the only thing standing
 * between a validly signed token with the wrong payload and a request that proceeds with
 * an undefined actor. A token signed by us is not automatically a token we should trust:
 * the shape is a separate question from the signature, and a future code path that mints
 * one without a subject would otherwise reach the middleware.
 *
 * The tokens below are signed with the real secret, issuer and audience, so `jwtVerify`
 * succeeds and the shape check is genuinely what refuses them.
 */

const ISSUER = 'openhours';
const AUDIENCE = 'openhours-api';

const secret = (): Uint8Array => new TextEncoder().encode(config.JWT_SECRET);

/** Signs an arbitrary payload exactly as the application would, bypassing its typing. */
const signRaw = async (
  payload: Record<string, unknown>,
  options: { readonly subject?: string } = {},
): Promise<string> => {
  let builder = new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('5m');

  if (options.subject !== undefined) {
    builder = builder.setSubject(options.subject);
  }

  return builder.sign(secret());
};

describe('verifyAccessToken claim shape', () => {
  it('accepts a token this module signed', async () => {
    const token = await signAccessToken({
      userId: 'usr-1',
      organisationId: 'org-1',
      role: 'CLINIC_OWNER',
    });

    await expect(verifyAccessToken(token)).resolves.toEqual({
      userId: 'usr-1',
      organisationId: 'org-1',
      role: 'CLINIC_OWNER',
    });
  });

  it('accepts a null organisation, which is what a platform role carries', async () => {
    const token = await signAccessToken({
      userId: 'usr-2',
      organisationId: null,
      role: 'SUPER_ADMIN',
    });

    const claims = await verifyAccessToken(token);

    // Null, not undefined and not the string "null": requireAuth branches on it.
    expect(claims.organisationId).toBeNull();
  });

  it('refuses a validly signed token with no subject', async () => {
    const token = await signRaw({ org: 'org-1', role: 'CLINIC_OWNER' });

    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('refuses a validly signed token with no role', async () => {
    const token = await signRaw({ org: 'org-1' }, { subject: 'usr-1' });

    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('refuses a validly signed token whose role is not in the matrix', async () => {
    /**
     * The claim used to be accepted as any string, cast to Role downstream, and then used
     * to index the matrix, where an unknown value threw a TypeError rather than denying.
     * Review finding I13. A role the matrix does not list is refused here instead.
     */
    const token = await signRaw({ org: 'org-1', role: 'ADMIN' }, { subject: 'usr-1' });

    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('refuses a role that differs only by case, because the matrix is exact', async () => {
    const token = await signRaw({ org: 'org-1', role: 'clinic_owner' }, { subject: 'usr-1' });

    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('refuses a role claim that is not a string', async () => {
    const token = await signRaw({ org: 'org-1', role: 42 }, { subject: 'usr-1' });

    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('refuses an organisation claim that is neither a string nor null', async () => {
    // A number here would become the organisation id in the request context and reach
    // set_config, where it would either fail or scope the request to nothing.
    const token = await signRaw({ org: 7, role: 'CLINIC_OWNER' }, { subject: 'usr-1' });

    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('refuses a missing organisation claim, which is not the same as null', async () => {
    const token = await signRaw({ role: 'CLINIC_OWNER' }, { subject: 'usr-1' });

    await expect(verifyAccessToken(token)).rejects.toBeInstanceOf(UnauthorizedError);
  });

  it('gives every shape failure the same message as a bad signature', async () => {
    const noSubject = await signRaw({ org: 'org-1', role: 'CLINIC_OWNER' })
      .then(verifyAccessToken)
      .catch((error: unknown) => error);
    const garbage = await verifyAccessToken('not-a-jwt').catch((error: unknown) => error);

    // A caller must not be able to tell a malformed token from a wrongly shaped one.
    expect((noSubject as UnauthorizedError).message).toBe((garbage as UnauthorizedError).message);
  });
});
