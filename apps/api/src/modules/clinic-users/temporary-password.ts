import { randomInt } from 'node:crypto';

/**
 * The temporary password every new login is handed (D-003).
 *
 * Shared by `pnpm provision:clinic`, `pnpm bootstrap:super-admin` and the admin console's
 * "create clinic owner", rather than each holding a copy: a second generator would be a second
 * opinion about how much entropy a handover password has, and one of them would eventually use
 * `Math.random`. The row those callers write is shared the same way, in
 * `clinic-users.repository.ts`.
 */

/**
 * A readable temporary password with roughly 77 bits of entropy.
 *
 * Readable because a human reads it off a terminal and types it into a login form, and a
 * password that invites transcription errors gets written on a note instead. Six groups of
 * four from a 32-character alphabet is 120 bits of alphabet space; the alphabet omits
 * characters that are misread aloud or on screen (0/O, 1/l/I).
 *
 * `randomInt` is used rather than `Math.random`, which is not a CSPRNG. These passwords
 * are live credentials for as long as it takes someone to change them.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const temporaryPassword = (): string => {
  const groups = Array.from({ length: 6 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''),
  );

  return groups.join('-');
};
