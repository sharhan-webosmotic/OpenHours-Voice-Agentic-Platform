import { parsePhoneNumberFromString } from 'libphonenumber-js/max';

/**
 * Phone number normalisation to E.164, with India as the default region.
 *
 * One function, used by the API, both web apps and the voice tools, because a number typed
 * into the admin console and a number matched against an inbound call have to agree exactly.
 * Two normalisers would differ on the first unusual input and the difference would show up as
 * a clinic whose agent number resolves to nothing.
 *
 * E.164 is the storage and transport form everywhere (root CLAUDE.md): `+` then country code
 * then subscriber digits, no spaces, no separators, 15 digits maximum.
 *
 * WHETHER A NUMBER EXISTS IS DECIDED BY libphonenumber, with its full metadata. The rule this
 * replaced was written by hand and said Indian numbers "never begin with 0 to 5", which is true
 * of mobiles and false of every landline in Mumbai, Delhi, Chennai, Kolkata and Hyderabad. It
 * also read an Indian `1800` helpline as a US number and an 11-digit typo as an Iranian one. A
 * country's numbering plan is data that changes, and the library is where that data is kept up
 * to date.
 *
 * THE SERVER DECIDES, WITH THE FULL METADATA. This module imports `libphonenumber-js/max`, and
 * that is what the API, its commands and its tests run. libphonenumber documents the `min` set
 * as unsuitable for strict validation, so the number a clinic is allowed to store must not
 * depend on it. The two web applications alias `libphonenumber-js/max` to `/min` in their
 * `vite.config.ts`, because they have an initial-JavaScript budget and the browser's answer is
 * only a convenience: it formats what was typed and catches the obvious mistakes, and the
 * server's 400 is the verdict. The minimal set is the more lenient of the two, so the browser
 * never refuses a number the server would accept. `phone-metadata-agreement.test.ts` holds both
 * to that.
 *
 * WHY A DEFAULT REGION AT ALL. Clinic staff type `98765 43210` or `022 2345 6789`, and refusing
 * those would push the normalisation into whoever is doing data entry. The default applies
 * ONLY to a number with no country code. A number written with `+` or `00` keeps its own.
 */

/** The country code assumed for a bare national number. */
export const DEFAULT_COUNTRY_CODE = '91';

const DEFAULT_REGION = 'IN';

/** E.164 allows at most 15 digits after the plus, and at least a country code plus one. */
const E164 = /^\+[1-9]\d{6,14}$/;

export type PhoneNormalisation =
  | { readonly ok: true; readonly e164: string }
  | { readonly ok: false; readonly reason: PhoneProblem };

export type PhoneProblem = 'empty' | 'contains-letters' | 'has-extension' | 'not-a-real-number';

/** The one libphonenumber function this needs, so the same rules can run on either metadata. */
export type PhoneParser = typeof parsePhoneNumberFromString;

/**
 * Builds the normaliser around a parser.
 *
 * Exported so the agreement test can run these exact rules on the minimal metadata beside the
 * full one. Product code uses `normalisePhone`, never this.
 */
export const createPhoneNormaliser =
  (parse: PhoneParser) =>
  (input: string): PhoneNormalisation => {
    const trimmed = input.trim();

    if (trimmed === '') {
      return { ok: false, reason: 'empty' };
    }

    /**
     * Letters are refused BEFORE parsing, because libphonenumber reads them as keypad digits
     * (`1-800-FLOWERS`). `+91 98765 4321O` with a capital O is a transcription error, and turning
     * the O into a 6 would store a wrong number that looks right. The one exception is an
     * extension marker, refused separately below with its own reason.
     */
    if (/[a-z]/i.test(trimmed.replace(/\b(?:ext|extn|x)\.?\s*\d+\s*$/i, ''))) {
      return { ok: false, reason: 'contains-letters' };
    }

    if (trimmed.replace(/[^\d]/g, '') === '') {
      return { ok: false, reason: 'empty' };
    }

    const parsed = parse(trimmed, DEFAULT_REGION);

    if (parsed === undefined || !parsed.isValid()) {
      return { ok: false, reason: 'not-a-real-number' };
    }

    // An extension cannot be dialled by the voice agent or stored in E.164, so it is refused
    // rather than silently dropped: the number left behind would reach a switchboard instead.
    if (parsed.ext !== undefined) {
      return { ok: false, reason: 'has-extension' };
    }

    return { ok: true, e164: parsed.number };
  };

/**
 * Normalises a typed phone number to E.164, or explains why it cannot be.
 *
 * Never throws: the caller decides whether a bad number is a validation error (a form) or a
 * value to drop (a provider payload or a number a caller spoke).
 */
export const normalisePhone = createPhoneNormaliser(parsePhoneNumberFromString);

/** True for a string already in E.164 form. Shape only: it does not ask whether it exists. */
export const isE164 = (value: string): boolean => E164.test(value);

/**
 * Normalises or throws, for call sites that have already validated the value through the
 * schema and would treat a failure here as a defect.
 */
export const toE164 = (input: string): string => {
  const result = normalisePhone(input);
  if (!result.ok) {
    throw new Error(`not a usable phone number: ${result.reason}`);
  }
  return result.e164;
};
