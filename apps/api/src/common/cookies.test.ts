import { describe, expect, it } from 'vitest';
import { readCookie } from './cookies.js';

/**
 * The refresh-cookie reader, which had no test file at all and sat at 75 percent lines
 * through incidental coverage from the auth suite. It is the only parser standing between
 * a raw header and a refresh token, so its refusals matter more than its happy path.
 */

const NAME = 'refresh_token';

describe('readCookie', () => {
  it('returns undefined when there is no header', () => {
    // req.headers.cookie is absent on most requests, and typed unknown for that reason.
    expect(readCookie(undefined, NAME)).toBeUndefined();
    expect(readCookie(null, NAME)).toBeUndefined();
    expect(readCookie(['a=1'], NAME)).toBeUndefined();
  });

  it('reads the named cookie from among several', () => {
    expect(readCookie(`a=1; ${NAME}=the-token; b=2`, NAME)).toBe('the-token');
  });

  it('tolerates whitespace around the name and the value', () => {
    expect(readCookie(`  ${NAME}  =  the-token  `, NAME)).toBe('the-token');
  });

  it('skips a segment with no equals sign', () => {
    // A bare flag in the header must not swallow the rest of it.
    expect(readCookie(`HttpOnly; ${NAME}=the-token`, NAME)).toBe('the-token');
  });

  it('percent-decodes the value', () => {
    expect(readCookie(`${NAME}=a%2Bb%3Dc`, NAME)).toBe('a+b=c');
  });

  it('returns undefined for a malformed percent-encoding', () => {
    // decodeURIComponent throws on this. A half-decoded token is not a usable token, and
    // throwing out of a cookie read would turn a bad header into a 500.
    expect(readCookie(`${NAME}=%E0%A4%A`, NAME)).toBeUndefined();
  });

  it('returns undefined when the cookie is absent', () => {
    expect(readCookie('a=1; b=2', NAME)).toBeUndefined();
  });

  it('returns an empty string for a present but empty cookie', () => {
    // Distinguishable from absent, which matters: an empty refresh cookie is a cleared
    // session rather than a request that never had one.
    expect(readCookie(`${NAME}=`, NAME)).toBe('');
  });

  it('does not match a cookie whose name merely contains the target', () => {
    expect(readCookie(`not_${NAME}=wrong`, NAME)).toBeUndefined();
  });
});
