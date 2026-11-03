import { describe, expect, it } from 'vitest';
import { isE164, normalisePhone, toE164 } from './phone.js';

/**
 * These cases are the forms clinic staff actually type, and the expected answers come from the
 * Indian numbering plan, not from the implementation. The ones that matter most are the ones
 * the previous hand-written rule got wrong: a city landline with its STD code, which it
 * refused, and a `1800` helpline and an 11-digit typo, which it accepted as foreign numbers.
 */

describe('normalisePhone', () => {
  const accepted: readonly (readonly [string, string, string])[] = [
    // Mobiles, with and without the country code, and with what people put between digits.
    ['a ten-digit mobile', '9876543210', '+919876543210'],
    ['a ten-digit mobile with +91', '+91 98765 43210', '+919876543210'],
    ['a mobile with +91 and no spaces', '+919876543210', '+919876543210'],
    ['a mobile with 91 and no plus', '919876543210', '+919876543210'],
    ['a mobile with spaces', '98765 43210', '+919876543210'],
    ['a mobile with hyphens', '98765-43210', '+919876543210'],
    ['a mobile with brackets', '(98765) 43210', '+919876543210'],
    ['a mobile with a bracketed country code', '(+91) 98765-43210', '+919876543210'],
    ['a mobile with surrounding space', '  +91-98765-43210  ', '+919876543210'],
    // The trunk zero is dialling notation, not part of the number.
    ['a mobile with the trunk zero', '098765 43210', '+919876543210'],
    // The international access prefix written instead of a plus.
    ['a mobile with 0091', '0091 98765 43210', '+919876543210'],
    // Landlines, with the STD code.
    ['a Mumbai landline with +91', '+91 22 2345 6789', '+912223456789'],
    ['a Mumbai landline with the trunk zero', '022 2345 6789', '+912223456789'],
    ['a Mumbai landline with brackets', '(022) 2345-6789', '+912223456789'],
    ['a Delhi landline', '011 2345 6789', '+911123456789'],
    ['a Delhi landline with hyphens', '011-4123-4567', '+911141234567'],
    ['a Bengaluru landline', '080 2345 6789', '+918023456789'],
    // Toll-free numbers are Indian, not North American.
    ['a 1800 toll-free number', '1800 123 4567', '+9118001234567'],
    ['a short 1800 toll-free number', '1800-11-4000', '+911800114000'],
    // Another country keeps its own code: the default applies only to bare numbers.
    ['a US number', '+1 415 555 0100', '+14155550100'],
    ['a UK number', '+44 20 7946 0958', '+442079460958'],
  ];

  for (const [label, input, expected] of accepted) {
    it(`accepts ${label}: ${JSON.stringify(input)} is ${expected}`, () => {
      expect(normalisePhone(input)).toEqual({ ok: true, e164: expected });
    });
  }

  const rejected: readonly (readonly [string, string, string])[] = [
    ['nothing', '', 'empty'],
    ['only spaces', '   ', 'empty'],
    ['only punctuation', '( ) -', 'empty'],
    ['words', 'not a number', 'contains-letters'],
    // A capital O for a zero. Reading it as a keypad digit would store a wrong number.
    ['a capital O for a zero', '+91 98765 4321O', 'contains-letters'],
    ['an extension', '98765 43210 ext 2', 'has-extension'],
    // One digit too many: not a mobile, and not a number anywhere else either.
    ['an eleven-digit typo', '98765432101', 'not-a-real-number'],
    ['nine digits', '987654321', 'not-a-real-number'],
    ['a handful of digits', '12345', 'not-a-real-number'],
    ['too long for E.164', '+911234567890123456', 'not-a-real-number'],
    ['a country code that does not exist', '+999 1234 5678', 'not-a-real-number'],
  ];

  for (const [label, input, reason] of rejected) {
    it(`rejects ${label}: ${JSON.stringify(input)} as ${reason}`, () => {
      expect(normalisePhone(input)).toEqual({ ok: false, reason });
    });
  }

  it('never reads an Indian 1800 number as a North American one', () => {
    const result = normalisePhone('1800 123 4567');
    expect(result.ok && result.e164.startsWith('+1')).toBe(false);
  });

  it('never reads an eleven-digit Indian typo as a foreign number', () => {
    expect(normalisePhone('98765432101').ok).toBe(false);
  });

  it('is idempotent, so storing a stored number does not change it', () => {
    const once = toE164('98765 43210');
    expect(toE164(once)).toBe(once);
  });
});

describe('isE164', () => {
  it('accepts a normalised number', () => {
    expect(isE164('+919876543210')).toBe(true);
  });

  it('rejects anything a human typed', () => {
    expect(isE164('98765 43210')).toBe(false);
    expect(isE164('919876543210')).toBe(false);
    expect(isE164('+91 9876543210')).toBe(false);
  });
});

describe('toE164', () => {
  it('throws with the reason, for the call sites that have already validated', () => {
    expect(() => toE164('nonsense')).toThrow(/contains-letters/);
  });
});
