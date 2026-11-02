import { describe, expect, it } from 'vitest';
import { isE164, normalisePhone, toE164 } from './phone.js';

/**
 * These cases are the forms clinic staff actually type, not a sweep of the E.164 grammar.
 * The ones that matter are the trunk zero and the international prefix without a plus,
 * because both produce a number that looks plausible and is unreachable.
 */

describe('normalisePhone', () => {
  const accepted: readonly [string, string][] = [
    ['9876543210', '+919876543210'],
    ['98765 43210', '+919876543210'],
    ['98765-43210', '+919876543210'],
    ['(98765) 43210', '+919876543210'],
    ['+919876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['  +91-98765-43210  ', '+919876543210'],
    ['919876543210', '+919876543210'],
    // The trunk zero is dialling notation, not part of the number.
    ['09876543210', '+919876543210'],
    ['098765 43210', '+919876543210'],
    // The ITU international access prefix.
    ['00919876543210', '+919876543210'],
    ['0091 98765 43210', '+919876543210'],
    // Another country keeps its own code: the default applies only to bare numbers.
    ['+14155552671', '+14155552671'],
    ['+442071838750', '+442071838750'],
  ];

  for (const [input, expected] of accepted) {
    it(`normalises ${JSON.stringify(input)} to ${expected}`, () => {
      const result = normalisePhone(input);
      expect(result).toEqual({ ok: true, e164: expected });
    });
  }

  const rejected: readonly [string, string][] = [
    ['', 'empty'],
    ['   ', 'empty'],
    ['not a number', 'contains-letters'],
    // A capital O for a zero. Stripping it would store a wrong number that looks right.
    ['+91 98765 4321O', 'contains-letters'],
    ['12345', 'too-short'],
    ['+911234567890123456', 'too-long'],
    // Indian subscriber numbers never begin with 0 to 5.
    ['1234567890', 'not-a-valid-indian-number'],
    ['5876543210', 'not-a-valid-indian-number'],
    ['+91 587654 3210', 'not-a-valid-indian-number'],
    // Nine digits is one short, so it is not a national number and not long enough to
    // carry a country code.
    ['987654321', 'too-short'],
  ];

  for (const [input, reason] of rejected) {
    it(`rejects ${JSON.stringify(input)} as ${reason}`, () => {
      expect(normalisePhone(input)).toEqual({ ok: false, reason });
    });
  }

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
