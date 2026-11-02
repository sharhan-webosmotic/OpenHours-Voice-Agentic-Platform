import { describe, expect, it } from 'vitest';
import { isIanaTimeZone } from './timezone.js';

/**
 * The rejections are the point. Every one of these is accepted by
 * `Intl.DateTimeFormat` and would be stored as a clinic's zone, and the `EST` case is
 * the one that would actually hurt: the runtime resolves it to `America/Panama`, which
 * observes no daylight saving, so every appointment time for a clinic stored that way
 * would be an hour out for most of the year.
 */

describe('isIanaTimeZone', () => {
  for (const zone of [
    'Asia/Kolkata',
    'Asia/Calcutta',
    'UTC',
    'America/New_York',
    'Europe/London',
  ]) {
    it(`accepts ${zone}`, () => {
      expect(isIanaTimeZone(zone)).toBe(true);
    });
  }

  for (const value of [
    'IST',
    'EST',
    'GMT',
    'Zulu',
    'Egypt',
    '+05:30',
    '-0800',
    'Asia/Bengaluru',
    'Mars/Olympus',
    '',
    '  ',
    ' Asia/Kolkata',
    'Asia/Kolkata ',
  ]) {
    it(`rejects ${JSON.stringify(value)}`, () => {
      expect(isIanaTimeZone(value)).toBe(false);
    });
  }
});
