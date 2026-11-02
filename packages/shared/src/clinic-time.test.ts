import { describe, expect, it } from 'vitest';
import {
  addDays,
  clinicDayOf,
  daysBetween,
  endOfClinicDay,
  formatMinuteOfDay,
  isClinicDay,
  startOfClinicDay,
  weekdayOf,
  zonedParts,
  zonedTimeToUtc,
} from './clinic-time.js';

/**
 * Worked examples, computed by hand, not captured from this module's output.
 *
 * India is UTC+05:30 with no daylight saving, so 09:00 in Kolkata is 03:30 UTC on every day
 * of the year. The two zones with transitions are here because the pilot's lack of them is
 * what would let an offset bug sit undetected until the product reaches a clinic that has
 * them.
 */

const KOLKATA = 'Asia/Kolkata';

describe('zonedTimeToUtc', () => {
  it('converts a Kolkata morning to UTC, 09:00 becoming 03:30 the same day', () => {
    // 09:00 is 540 minutes from midnight. 540 - 330 = 210 minutes past UTC midnight.
    expect(zonedTimeToUtc('2026-11-02', 540, KOLKATA).toISOString()).toBe(
      '2026-11-02T03:30:00.000Z',
    );
  });

  it('crosses back over UTC midnight for an early Kolkata appointment', () => {
    // 05:00 local is 300 minutes, which is before the 330-minute offset, so the UTC
    // instant lands on the PREVIOUS day. An implementation that formatted the local day
    // and kept it would be half an hour and a date out here.
    expect(zonedTimeToUtc('2026-11-02', 300, KOLKATA).toISOString()).toBe(
      '2026-11-01T23:30:00.000Z',
    );
  });

  it('handles a half-hour offset at the end of the day', () => {
    // 23:45 local, 1425 minutes. 1425 - 330 = 1095 minutes = 18:15 UTC.
    expect(zonedTimeToUtc('2026-11-02', 1425, KOLKATA).toISOString()).toBe(
      '2026-11-02T18:15:00.000Z',
    );
  });

  it('is the identity for UTC itself', () => {
    expect(zonedTimeToUtc('2026-11-02', 0, 'UTC').toISOString()).toBe('2026-11-02T00:00:00.000Z');
    expect(zonedTimeToUtc('2026-11-02', 1439, 'UTC').toISOString()).toBe(
      '2026-11-02T23:59:00.000Z',
    );
  });

  /**
   * The transition cases. These are the reason the conversion runs two passes.
   *
   * London moves to British Summer Time at 01:00 UTC on 2026-03-29, so 09:00 local that
   * morning is 08:00 UTC, while 09:00 local the day before is 09:00 UTC. A single-pass
   * conversion that read the offset at naive midnight would return 09:00 UTC for both.
   */
  it('applies the offset in force on the day, not the one in force at midnight UTC', () => {
    expect(zonedTimeToUtc('2026-03-28', 540, 'Europe/London').toISOString()).toBe(
      '2026-03-28T09:00:00.000Z',
    );
    expect(zonedTimeToUtc('2026-03-29', 540, 'Europe/London').toISOString()).toBe(
      '2026-03-29T08:00:00.000Z',
    );
  });

  it('resolves a local time the clocks jumped over to the instant the jump lands on', () => {
    // New York springs forward at 07:00 UTC on 2026-03-08: 02:30 local never happens.
    // The clinic's "we open at 02:30" on that morning is the moment the clock reaches it.
    const resolved = zonedTimeToUtc('2026-03-08', 150, 'America/New_York');

    expect(resolved.toISOString()).toBe('2026-03-08T07:30:00.000Z');
    // And it is still the same local day, which is what a day's slot list depends on.
    expect(clinicDayOf(resolved, 'America/New_York')).toBe('2026-03-08');
  });

  it('resolves a local time that happens twice to the first of the two', () => {
    // New York falls back at 06:00 UTC on 2026-11-01: 01:30 local happens at 05:30 UTC
    // and again at 06:30 UTC.
    expect(zonedTimeToUtc('2026-11-01', 90, 'America/New_York').toISOString()).toBe(
      '2026-11-01T05:30:00.000Z',
    );
  });
});

describe('zonedParts', () => {
  it('reads a UTC instant as the clinic sees it', () => {
    expect(zonedParts(new Date('2026-11-02T03:30:00.000Z'), KOLKATA)).toEqual({
      day: '2026-11-02',
      minuteOfDay: 540,
      weekday: 'MONDAY',
    });
  });

  it('reports local midnight as minute zero rather than 1440', () => {
    // Some runtimes format midnight as hour 24 with hour12: false. 18:30 UTC is 00:00
    // next day in Kolkata, and the day must advance with it.
    expect(zonedParts(new Date('2026-11-02T18:30:00.000Z'), KOLKATA)).toEqual({
      day: '2026-11-03',
      minuteOfDay: 0,
      weekday: 'TUESDAY',
    });
  });

  it('puts an instant on the previous clinic day when the offset pulls it back', () => {
    expect(zonedParts(new Date('2026-11-01T23:30:00.000Z'), KOLKATA)).toMatchObject({
      day: '2026-11-02',
      minuteOfDay: 300,
    });
  });
});

describe('startOfClinicDay and endOfClinicDay', () => {
  it('bounds a Kolkata day as 18:30 UTC the previous day to 18:30 UTC on the day', () => {
    expect(startOfClinicDay('2026-11-02', KOLKATA).toISOString()).toBe('2026-11-01T18:30:00.000Z');
    expect(endOfClinicDay('2026-11-02', KOLKATA).toISOString()).toBe('2026-11-02T18:30:00.000Z');
  });

  it('bounds a 23-hour day correctly where one exists', () => {
    // London on 2026-03-29 starts at 00:00 GMT and ends at 00:00 BST, which is 23 hours.
    const start = startOfClinicDay('2026-03-29', 'Europe/London');
    const end = endOfClinicDay('2026-03-29', 'Europe/London');

    expect(start.toISOString()).toBe('2026-03-29T00:00:00.000Z');
    expect(end.toISOString()).toBe('2026-03-29T23:00:00.000Z');
    expect((end.getTime() - start.getTime()) / 3_600_000).toBe(23);
  });
});

describe('addDays and weekdayOf', () => {
  it('crosses a month boundary', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-01', -1)).toBe('2026-11-30');
  });

  it('crosses a year boundary', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
  });

  it('handles a leap day', () => {
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
    expect(addDays('2028-02-29', 1)).toBe('2028-03-01');
  });

  it('names the weekday of a known date', () => {
    // 2026-11-02 is a Monday.
    expect(weekdayOf('2026-11-02')).toBe('MONDAY');
    expect(weekdayOf('2026-11-08')).toBe('SUNDAY');
  });

  it('covers every index the runtime can return', () => {
    // Seven consecutive days must produce seven distinct names, which is what proves the
    // Sunday-first lookup has no gap and no duplicate.
    const names = daysBetween('2026-11-02', '2026-11-08').map((day) => weekdayOf(day));

    expect(names).toEqual([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ]);
  });
});

describe('isClinicDay', () => {
  it('accepts a real day and refuses a shape that is not one', () => {
    expect(isClinicDay('2026-11-02')).toBe(true);
    expect(isClinicDay('2026-1-2')).toBe(false);
    expect(isClinicDay('02-11-2026')).toBe(false);
    expect(isClinicDay('2026-11-02T00:00:00Z')).toBe(false);
  });

  it('refuses a day that does not exist, which Date silently rolls over', () => {
    expect(isClinicDay('2026-02-30')).toBe(false);
    expect(isClinicDay('2026-13-01')).toBe(false);
    // 2026 is not a leap year.
    expect(isClinicDay('2026-02-29')).toBe(false);
    expect(isClinicDay('2028-02-29')).toBe(true);
  });
});

describe('daysBetween', () => {
  it('includes both ends', () => {
    expect(daysBetween('2026-11-02', '2026-11-04')).toEqual([
      '2026-11-02',
      '2026-11-03',
      '2026-11-04',
    ]);
  });

  it('returns a single day when the ends are the same', () => {
    expect(daysBetween('2026-11-02', '2026-11-02')).toEqual(['2026-11-02']);
  });

  it('returns nothing when the range is backwards, rather than looping', () => {
    expect(daysBetween('2026-11-04', '2026-11-02')).toEqual([]);
  });

  it('refuses a range wide enough to be a mistake', () => {
    expect(() => daysBetween('2026-01-01', '2028-01-01')).toThrow('too wide');
  });
});

describe('formatMinuteOfDay', () => {
  it('pads to a wall clock a person can read', () => {
    expect(formatMinuteOfDay(0)).toBe('00:00');
    expect(formatMinuteOfDay(540)).toBe('09:00');
    expect(formatMinuteOfDay(555)).toBe('09:15');
    expect(formatMinuteOfDay(1439)).toBe('23:59');
  });
});
