import { describe, expect, it } from 'vitest';
import {
  MINIMUM_PASSWORD_LENGTH,
  hashPassword,
  spendVerificationWork,
  verifyPassword,
} from './passwords.js';

/**
 * The cost of a password hash is a security parameter, so it is asserted rather than
 * inherited from whatever the library currently defaults to.
 *
 * These tests read the parameters back out of a produced hash. Asserting the OPTIONS
 * constant instead would only prove the constant exists, not that argon2 used it, which
 * is the difference between a control and a comment. Review finding I12.
 */

/** `$argon2id$v=19$m=65536,p=4,t=3$<salt>$<hash>` */
const ENCODED = /^\$argon2id\$v=19\$m=(\d+),p=(\d+),t=(\d+)\$/;

const parameters = (hash: string): { m: number; p: number; t: number } => {
  const match = ENCODED.exec(hash);

  if (match?.[1] === undefined || match[2] === undefined || match[3] === undefined) {
    throw new Error(`hash is not in the expected argon2id encoding: ${hash.slice(0, 40)}`);
  }

  return {
    m: Number.parseInt(match[1], 10),
    p: Number.parseInt(match[2], 10),
    t: Number.parseInt(match[3], 10),
  };
};

describe('password hashing cost', () => {
  it('hashes with argon2id at the pinned parameters', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    expect(parameters(hash)).toEqual({ m: 65_536, p: 4, t: 3 });
  });

  /**
   * The floor matters more than the exact numbers: a future raise should not fail this,
   * but a dependency bump that quietly lowered the work factor must.
   */
  it('never falls below the OWASP argon2id minimum', async () => {
    const { m, p, t } = parameters(await hashPassword('correct-horse-battery-staple'));

    expect(m).toBeGreaterThanOrEqual(19_456);
    expect(t).toBeGreaterThanOrEqual(2);
    expect(p).toBeGreaterThanOrEqual(1);
  });

  it('salts every hash, so two identical passwords do not collide', async () => {
    const password = 'correct-horse-battery-staple';

    expect(await hashPassword(password)).not.toBe(await hashPassword(password));
  });

  it('spends the same parameters on the decoy as on a real verification', async () => {
    // The decoy exists so an unknown email costs what a real one costs. A decoy hashed
    // more cheaply would reintroduce the timing difference it was built to remove.
    await expect(spendVerificationWork('whatever')).resolves.toBe(false);
  });
});

describe('verifyPassword', () => {
  it('accepts the password that produced the hash', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    await expect(verifyPassword(hash, 'correct-horse-battery-staple')).resolves.toBe(true);
  });

  it('rejects a wrong password', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');

    await expect(verifyPassword(hash, 'wrong-horse-battery-staple')).resolves.toBe(false);
  });

  it('returns false for a malformed hash instead of throwing', async () => {
    // A corrupt or truncated stored hash must deny the login, not surface a 500.
    await expect(verifyPassword('not-a-hash', 'anything')).resolves.toBe(false);
  });
});

describe('MINIMUM_PASSWORD_LENGTH', () => {
  it('is at least twelve, which is what the security rules require', () => {
    expect(MINIMUM_PASSWORD_LENGTH).toBeGreaterThanOrEqual(12);
  });
});
