import argon2 from 'argon2';

/**
 * Password hashing. argon2id, which resists both GPU and side-channel attacks, per the
 * tenant-security-phi skill.
 */

const OPTIONS = { type: argon2.argon2id } as const;

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
