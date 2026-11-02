import { describe, expect, it } from 'vitest';
import { CSRF_HEADER_NAME } from './session.js';

/**
 * Pins the header name to the decision rather than to whatever the code currently says.
 *
 * This is the assertion that was missing. Both sides now import one constant, so they
 * cannot disagree with each other, but they could still be renamed together and silently
 * stop matching D-011. The literal is written out here so a rename has to come through
 * this file, which is where someone will read why the name is fixed.
 */
describe('the CSRF header name', () => {
  it('is the name D-011 fixes', () => {
    expect(CSRF_HEADER_NAME).toBe('x-clinicai-csrf');
  });

  it('is lower-cased, because that is how Node presents an incoming header', () => {
    expect(CSRF_HEADER_NAME).toBe(CSRF_HEADER_NAME.toLowerCase());
  });
});
