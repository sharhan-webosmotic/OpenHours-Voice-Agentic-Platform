/**
 * Phone number normalisation to E.164, with an Indian default.
 *
 * One function, used by the API, both web apps and the prompt renderer, because a number
 * typed into the admin console and a number matched against an inbound call have to agree
 * exactly. Two normalisers would differ on the first unusual input and the difference
 * would show up as a clinic whose agent number resolves to nothing.
 *
 * E.164 is the storage and transport form everywhere (root CLAUDE.md): `+` then country
 * code then subscriber digits, no spaces, no separators, 15 digits maximum.
 *
 * WHY A DEFAULT COUNTRY AT ALL. Clinic staff type `98765 43210`, and refusing that would
 * push the normalisation into whoever is doing data entry. The default is applied ONLY to
 * a number with no country code, and it is `+91` because every pilot clinic is in India.
 * A number that already carries `+` keeps its own country code.
 */

/** The country code assumed for a bare national number. */
export const DEFAULT_COUNTRY_CODE = '91';

/** India's national subscriber numbers are ten digits and never begin with 0 to 5. */
const INDIAN_NATIONAL = /^[6-9]\d{9}$/;

/** E.164 allows at most 15 digits after the plus, and at least a country code plus one. */
const E164 = /^\+[1-9]\d{6,14}$/;

export type PhoneNormalisation =
  | { readonly ok: true; readonly e164: string }
  | { readonly ok: false; readonly reason: PhoneProblem };

export type PhoneProblem =
  | 'empty'
  | 'contains-letters'
  | 'too-short'
  | 'too-long'
  | 'not-a-valid-indian-number'
  | 'leading-zero';

/**
 * Normalises a typed phone number to E.164, or explains why it cannot be.
 *
 * Accepts, in order of how often a human types them:
 *   `98765 43210`, `9876543210`          bare national, gets +91
 *   `098765 43210`                        national with a trunk 0, which is stripped
 *   `+91 98765 43210`, `+919876543210`    already international, kept as given
 *   `0091 98765 43210`, `91 9876543210`   an international prefix without the plus
 *
 * Returns a result rather than throwing, because every caller wants to report the problem
 * against a form field rather than catch an exception.
 */
export const normalisePhone = (input: string): PhoneNormalisation => {
  const trimmed = input.trim();

  if (trimmed === '') {
    return { ok: false, reason: 'empty' };
  }

  // Letters are rejected rather than stripped: `+91 98765 4321O` with a capital O is a
  // transcription error, and silently dropping the character would store a wrong number
  // that looks right.
  if (/[a-z]/i.test(trimmed)) {
    return { ok: false, reason: 'contains-letters' };
  }

  const hadPlus = trimmed.startsWith('+');
  // Everything a human puts between digits: spaces, hyphens, brackets, dots.
  const digits = trimmed.replace(/[^\d]/g, '');

  if (digits === '') {
    return { ok: false, reason: 'empty' };
  }

  const international = hadPlus ? digits : interpretWithoutPlus(digits);

  if (international === undefined) {
    // Too short to be a national number and with nothing marking it as international.
    // Guessing here is what turned a nine-digit typo into `+987654321`, a number that
    // satisfies E.164 and reaches nobody.
    return { ok: false, reason: 'too-short' };
  }

  const candidate = `+${international}`;

  if (!E164.test(candidate)) {
    return { ok: false, reason: international.length < 7 ? 'too-short' : 'too-long' };
  }

  // An Indian number is checked properly, because that is the country this product
  // operates in and a ten-digit number starting with 5 is not reachable. Other country
  // codes are accepted on E.164 shape alone: inventing per-country rules we cannot test
  // would reject real numbers.
  if (international.startsWith(DEFAULT_COUNTRY_CODE)) {
    const national = international.slice(DEFAULT_COUNTRY_CODE.length);
    if (!INDIAN_NATIONAL.test(national)) {
      return { ok: false, reason: 'not-a-valid-indian-number' };
    }
  }

  return { ok: true, e164: candidate };
};

/**
 * Turns a digit string with no `+` into an international number, or `undefined` when it
 * cannot be read as one.
 *
 * The trunk zero is the case that matters: `09876543210` is how an Indian number is dialled
 * domestically, and the leading 0 is not part of the number. Keeping it would produce
 * `+9109876543210`, which is both too long and wrong.
 *
 * SHORTER THAN A NATIONAL NUMBER IS A REFUSAL, not a country code. Nine digits cannot be a
 * national number, and reading it as "country code plus subscriber" produced `+987654321`,
 * which is a valid E.164 string pointing at nothing. The only inputs treated as already
 * carrying a country code are ones long enough that they cannot be anything else.
 */
const interpretWithoutPlus = (digits: string): string | undefined => {
  if (digits.startsWith('00')) {
    return digits.slice(2);
  }

  // A bare national number, with or without the trunk prefix.
  if (digits.length === 10) {
    return `${DEFAULT_COUNTRY_CODE}${digits}`;
  }

  if (digits.length === 11 && digits.startsWith('0')) {
    return `${DEFAULT_COUNTRY_CODE}${digits.slice(1)}`;
  }

  if (digits.length >= 11) {
    // Longer than a national number and no access prefix: it already carries one.
    return digits;
  }

  return undefined;
};

/** Whether a stored value is in E.164 form. Used by the zod schemas and by tests. */
export const isE164 = (value: string): boolean => E164.test(value);

/**
 * Normalises or throws. For the small number of call sites that have already validated,
 * such as a renderer reading a stored number back.
 */
export const toE164 = (input: string): string => {
  const result = normalisePhone(input);
  if (!result.ok) {
    throw new Error(`not a usable phone number: ${result.reason}`);
  }
  return result.e164;
};
