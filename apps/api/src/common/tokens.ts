import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';

/**
 * Opaque secret tokens: refresh tokens, device tokens and pairing codes.
 *
 * All are stored as a SHA-256 hash and never in plaintext, so a database dump cannot be
 * replayed as a credential. SHA-256 rather than argon2 on purpose: these are 256 bits of
 * machine-generated randomness, so there is nothing to brute-force and the lookup has to
 * be fast enough to run on every refresh.
 */

/** 256 bits, base64url. Collision and guessing are both infeasible at this size. */
export const generateOpaqueToken = (): string => randomBytes(32).toString('base64url');

export const hashToken = (token: string): string =>
  createHash('sha256').update(token).digest('hex');

/**
 * Human-typable pairing code.
 *
 * Crockford-style alphabet with I, L, O, U and 0/1 removed, because the code is read off
 * one screen and typed into a phone. 6 characters over 30 symbols is ~29 bits, which is
 * safe only because the code expires in minutes and is single use; the attempt limit is
 * what actually bounds guessing.
 */
const PAIRING_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';

export const generatePairingCode = (): string => {
  const bytes = randomBytes(6);
  let code = '';
  for (let i = 0; i < 6; i += 1) {
    // Modulo bias across 30 symbols from 256 values is negligible for a code whose real
    // protection is its lifetime and single use.
    code += PAIRING_ALPHABET[(bytes[i] ?? 0) % PAIRING_ALPHABET.length];
  }
  return code;
};

/** Constant-time comparison, so a hash is never leaked by how long a mismatch takes. */
export const tokenHashesMatch = (a: string, b: string): boolean => {
  const left = Buffer.from(a, 'utf8');
  const right = Buffer.from(b, 'utf8');
  if (left.length !== right.length) {
    return false;
  }
  return timingSafeEqual(left, right);
};
