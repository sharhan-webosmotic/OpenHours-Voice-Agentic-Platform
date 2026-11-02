import { describe, expect, it } from 'vitest';
import { internals } from './tool-secret.js';

const { digestsMatch, DECOY_HASH } = internals;

/**
 * The constant-time comparison behind the voice tool secret.
 *
 * WHAT A TEST CAN AND CANNOT SHOW HERE. It cannot measure timing reliably in a test
 * runner, so it does not pretend to: it asserts the three behaviours that a `===` would
 * also satisfy, plus the one it would not, which is that a length mismatch neither throws
 * nor short-circuits. `timingSafeEqual` throws on unequal lengths, so an unguarded call
 * would turn a malformed credential into a 500 and leak the length through the error.
 */

const DIGEST = 'a'.repeat(64);

describe('digestsMatch', () => {
  it('accepts two identical digests', () => {
    expect(digestsMatch(DIGEST, DIGEST)).toBe(true);
  });

  it('refuses two digests that differ in the last character', () => {
    expect(digestsMatch(DIGEST, `${'a'.repeat(63)}b`)).toBe(false);
  });

  it('refuses two digests that differ in the first character', () => {
    // The pair a `===` would separate fastest, and the pair this must take as long over as
    // the pair above.
    expect(digestsMatch(DIGEST, `b${'a'.repeat(63)}`)).toBe(false);
  });

  it('refuses a shorter value without throwing', () => {
    expect(() => digestsMatch(DIGEST, 'abc')).not.toThrow();
    expect(digestsMatch(DIGEST, 'abc')).toBe(false);
  });

  it('refuses a longer value without throwing', () => {
    expect(() => digestsMatch(DIGEST, 'a'.repeat(128))).not.toThrow();
    expect(digestsMatch(DIGEST, 'a'.repeat(128))).toBe(false);
  });

  it('refuses the decoy it compares against on the not-found path', () => {
    // The decoy exists so that an unknown secret costs the same as a known one. It must
    // never be a value that matches a real digest.
    expect(digestsMatch(DIGEST, DECOY_HASH)).toBe(false);
    expect(DECOY_HASH).toHaveLength(64);
  });

  it('refuses an empty value', () => {
    expect(digestsMatch(DIGEST, '')).toBe(false);
  });
});
