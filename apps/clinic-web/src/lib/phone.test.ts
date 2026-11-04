import { describe, expect, it } from 'vitest';
import { ageOn } from './clinicTime';
import { formatPhone } from './phone';

describe('formatPhone', () => {
  it('groups an Indian mobile number the way it is read aloud', () => {
    expect(formatPhone('+919876543210')).toBe('+91 98765 43210');
  });

  it('leaves any other number exactly as stored', () => {
    expect(formatPhone('+14155550142')).toBe('+14155550142');
  });
});

describe('ageOn', () => {
  it('counts a birthday reached today as a year passed', () => {
    expect(ageOn('1988-06-14', '2026-06-14')).toBe(38);
  });

  it('does not count a birthday still to come this year', () => {
    expect(ageOn('1988-06-14', '2026-06-13')).toBe(37);
  });
});
