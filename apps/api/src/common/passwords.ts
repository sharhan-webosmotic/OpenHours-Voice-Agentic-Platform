import argon2 from 'argon2';

/**
 * Password hashing. argon2id, which resists both GPU and side-channel attacks, per the
 * tenant-security-phi skill.
 */

/**
 * Pinned, not inherited.
 *
 * These were the library's defaults and nothing asserted them, so a dependency bump could
 * have lowered the work factor silently and every password hashed afterwards would have
 * been cheaper to crack, with no test and no review noticing. Review finding I12.
 *
 * The values are the ones argon2 0.45.1 chose, measured from an encoded hash
 * (`$argon2id$v=19$m=65536,p=4,t=3`), so writing them down changes nothing about today's
 * behaviour. They are above the OWASP argon2id minimum of m=19456, t=2, p=1.
 *
 * Raising them later is safe for existing users: argon2 reads the parameters from each
 * stored hash, so old hashes keep verifying. Nothing re-hashes on login yet, so a raise
 * applies to new and changed passwords only.
 *
 * `passwords.test.ts` asserts the EFFECTIVE parameters by reading them back out of a
 * hash, rather than asserting this constant, which would only prove the constant exists.
 */
const OPTIONS = {
  type: argon2.argon2id,
  memoryCost: 65_536,
  timeCost: 3,
  parallelism: 4,
} as const;

/** Minimum length. Length beats composition rules for resisting guessing. */
export const MINIMUM_PASSWORD_LENGTH = 12;

/**
 * A hash of a value no one knows, used to spend the same work on an unknown email as on
 * a real one. Without it, login answers "does this address exist?" through its timing.
 */
let decoyHash: string | undefined;

export const hashPassword = (password: string): Promise<string> => argon2.hash(password, OPTIONS);

export const verifyPassword = (hash: string, password: string): Promise<boolean> =>
  argon2.verify(hash, password).catch(() => false);

/**
 * Verifies against a decoy hash and always returns false.
 *
 * Called when the email is unknown or the account is unusable, so every login path does
 * one argon2 verification and takes comparable time.
 */
export const spendVerificationWork = async (password: string): Promise<false> => {
  decoyHash ??= await argon2.hash('decoy-password-never-matches', OPTIONS);
  await argon2.verify(decoyHash, password).catch(() => false);
  return false;
};
