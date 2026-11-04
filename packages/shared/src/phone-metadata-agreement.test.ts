import { describe, expect, it } from 'vitest';
import { parsePhoneNumberFromString as parseWithMinimalMetadata } from 'libphonenumber-js/min';
import { createPhoneNormaliser, normalisePhone } from './phone.js';

/**
 * The server and the browser must not disagree about a number the server accepts.
 *
 * The API validates with libphonenumber's full metadata (`normalisePhone`, as it runs in Node).
 * The web apps alias that to the minimal metadata to stay inside their bundle budget, and
 * libphonenumber documents the minimal set as unsuitable for strict validation. That is safe
 * only in one direction: the browser may let through a number the server then refuses, which
 * the form shows as the server's field error, but it must never refuse a number the server
 * would accept, and when both accept they must store the same E.164. These tests run the same
 * rules on both metadata sets and hold them to exactly that.
 */

const inBrowser = createPhoneNormaliser(parseWithMinimalMetadata);
const onServer = normalisePhone;

/** The cases the review named, which both must answer identically. */
const NAMED: readonly (readonly [string, string | false])[] = [
  ['+91 22 2345 6789', '+912223456789'],
  ['011 2345 6789', '+911123456789'],
  ['1800 123 4567', '+9118001234567'],
  ['9876543210', '+919876543210'],
  ['+91 98765 43210', '+919876543210'],
  ['(022) 2345-6789', '+912223456789'],
  ['98765 43210', '+919876543210'],
  ['98765432101', false],
  ['987654321', false],
  ['+91 98765 4321O', false],
];

/**
 * A sweep wide enough to find a disagreement if one exists: Indian numbers across every STD
 * prefix from 1000 to 9999 in steps of 7 at five lengths, and a mobile-shaped and a
 * landline-shaped number under every country code from 1 to 999.
 */
const sweep = (): readonly string[] => {
  const inputs: string[] = [];
  for (let prefix = 1000; prefix <= 9999; prefix += 7) {
    for (const length of [6, 7, 8, 9, 10]) {
      inputs.push(
        `0${String(prefix)}${'5'.repeat(Math.max(length - 4, 0))}${String(prefix).slice(-2)}`,
      );
    }
  }
  for (let code = 1; code <= 999; code += 1) {
    inputs.push(`+${String(code)} 2345 6789`, `+${String(code)} 9123 45678`);
  }
  return inputs;
};

/**
 * Both answers for every swept number, worked out once when the file loads.
 *
 * Computed here rather than inside each test so the cost (about seventeen thousand parses)
 * lands outside every test's time limit. Inside the tests it timed out under the gate's
 * parallel load, which is the same mistake as a lazy import inside an assertion.
 */
const SWEPT = sweep().map((input) => ({
  input,
  server: onServer(input),
  browser: inBrowser(input),
}));

describe('the browser and the server on the same phone numbers', () => {
  for (const [input, expected] of NAMED) {
    it(`agree on ${JSON.stringify(input)}`, () => {
      const server = onServer(input);
      const browser = inBrowser(input);

      if (expected === false) {
        expect(server.ok).toBe(false);
        expect(browser.ok).toBe(false);
      } else {
        expect(server).toEqual({ ok: true, e164: expected });
        expect(browser).toEqual({ ok: true, e164: expected });
      }
    });
  }

  it('never has the browser refuse a number the server accepts', () => {
    const refusedOnlyByBrowser = SWEPT.filter(
      ({ server, browser }) => server.ok && !browser.ok,
    ).map(({ input }) => input);

    expect(refusedOnlyByBrowser).toEqual([]);
  });

  it('stores the same E.164 whichever side normalised it', () => {
    const different = SWEPT.filter(
      ({ server, browser }) => server.ok && browser.ok && server.e164 !== browser.e164,
    ).map(({ input }) => input);

    expect(different).toEqual([]);
  });

  it('has the server refuse some numbers the browser lets through, which is why it decides', () => {
    // Not a defect, and the reason this file exists: if the minimal set ever became as strict
    // as the full one this would fail, and the alias in the web apps could then be dropped.
    expect(SWEPT.some(({ server, browser }) => browser.ok && !server.ok)).toBe(true);
  });
});
