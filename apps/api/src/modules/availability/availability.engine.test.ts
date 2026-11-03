import { describe, expect, it } from 'vitest';
import { bookableSlots, type SlotEngineInput } from './availability.engine.js';

/**
 * The slot engine, driven from worked examples.
 *
 * EVERY EXPECTED LIST IN THIS FILE WAS WRITTEN OUT BY HAND from the clinic described in the
 * test, before the engine was run, and none of it was pasted back from the engine's output.
 * That is the instruction for this suite and it is not ceremony: a slot list captured from
 * the implementation asserts that the code still does what it did, which is exactly the
 * property that stays true when the rules are wrong.
 *
 * The clinic in most of these is deliberately dull: Asia/Kolkata, open 09:00 to 13:00 and
 * 14:00 to 18:00 on weekdays, one doctor working the same hours, a 30-minute consultation on
 * a 30-minute grid. 2026-11-02 is a Monday, 2026-11-08 is a Sunday.
 */

const KOLKATA = 'Asia/Kolkata';
const MONDAY = '2026-11-02';
const SUNDAY = '2026-11-08';

/** 08:00 Kolkata on the Monday, so "now" is before the clinic opens. */
const NOW = new Date('2026-11-02T02:30:00.000Z');

const WEEKDAY_NAMES = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY'] as const;

/** 09:00-13:00 and 14:00-18:00, so the hour between them is a break (D-013). */
const openingHours = WEEKDAY_NAMES.flatMap((weekday) => [
  { weekday, startAtMinute: 540, endAtMinute: 780 },
  { weekday, startAtMinute: 840, endAtMinute: 1080 },
]);

const input = (overrides: Partial<SlotEngineInput> = {}): SlotEngineInput => ({
  day: MONDAY,
  timeZone: KOLKATA,
  now: NOW,
  serviceDurationMinutes: 30,
  policy: {
    slotGranularityMinutes: 30,
    minimumNoticeMinutes: 0,
    maximumAdvanceDays: 30,
    defaultBufferMinutes: 0,
    maxPerSlot: 1,
  },
  doctorBufferMinutes: 0,
  hoursCollected: true,
  clinicHours: openingHours,
  doctorWorkingHours: openingHours,
  timeOff: [],
  appointments: [],
  ...overrides,
});

const labels = (result: ReturnType<typeof bookableSlots>): readonly string[] =>
  result.slots.map((slot) => slot.label);

/** 09:00-13:00 and 14:00-18:00 on a 30-minute grid, with a 30-minute service. */
const FULL_DAY = [
  '09:00',
  '09:30',
  '10:00',
  '10:30',
  '11:00',
  '11:30',
  '12:00',
  '12:30',
  '14:00',
  '14:30',
  '15:00',
  '15:30',
  '16:00',
  '16:30',
  '17:00',
  '17:30',
];

describe('bookableSlots, the ordinary day', () => {
  it('offers every half hour the clinic is open, and nothing during the break', () => {
    // 09:00 to 13:00 gives eight starts, the last at 12:30 finishing exactly at 13:00.
    // 13:00 and 13:30 are not offered: the clinic is shut between 13:00 and 14:00.
    expect(labels(bookableSlots(input()))).toEqual(FULL_DAY);
  });

  it('returns the first and last slot at the right instants in UTC', () => {
    const result = bookableSlots(input());
    const first = result.slots[0];
    const last = result.slots.at(-1);

    // 09:00 Kolkata is 03:30 UTC. 17:30 Kolkata is 12:00 UTC, ending 12:30 UTC.
    expect(first?.startAt.toISOString()).toBe('2026-11-02T03:30:00.000Z');
    expect(first?.endAt.toISOString()).toBe('2026-11-02T04:00:00.000Z');
    expect(last?.startAt.toISOString()).toBe('2026-11-02T12:00:00.000Z');
    expect(last?.endAt.toISOString()).toBe('2026-11-02T12:30:00.000Z');
  });

  it('refuses the whole day when the clinic is closed on that weekday', () => {
    const result = bookableSlots(input({ day: SUNDAY }));

    expect(result.slots).toEqual([]);
    expect(result.reason).toBe('CLINIC_CLOSED');
  });

  it('offers nothing when the clinic has never had its hours collected', () => {
    // D-013: no hours is not a closed clinic, it is a clinic nobody has asked. Offering
    // slots from an assumption is how a patient is given a time the door is locked.
    const result = bookableSlots(input({ hoursCollected: false, clinicHours: [] }));

    expect(result.slots).toEqual([]);
    expect(result.reason).toBe('HOURS_NOT_COLLECTED');
  });
});

describe('bookableSlots, the service and the grid', () => {
  it('fits a 45-minute service onto a 15-minute grid only where it has room', () => {
    /**
     * Morning window 09:00 to 13:00 on a 15-minute grid, service 45 minutes. Starts run
     * 09:00, 09:15 ... up to the last one that still ends by 13:00, which is 12:15.
     * Afternoon 14:00 to 18:00 ends at 17:15.
     */
    const result = bookableSlots(
      input({
        serviceDurationMinutes: 45,
        policy: { ...input().policy, slotGranularityMinutes: 15 },
      }),
    );

    expect(labels(result).slice(0, 4)).toEqual(['09:00', '09:15', '09:30', '09:45']);
    expect(labels(result).filter((label) => label.startsWith('12:'))).toEqual(['12:00', '12:15']);
    expect(labels(result).at(-1)).toBe('17:15');
  });

  it('offers nothing when the service is longer than any window', () => {
    // Four-hour windows, a five-hour service. Nothing fits anywhere.
    const result = bookableSlots(input({ serviceDurationMinutes: 300 }));

    expect(result.slots).toEqual([]);
    expect(result.reason).toBe('FULLY_BOOKED');
  });

  it('keeps one grid across a break rather than restarting it at each window', () => {
    /**
     * The clinic opens at 09:10 with a 15-minute grid, so the morning starts at 09:15, not
     * 09:10. The afternoon segment then lines up with the same grid. A grid anchored to
     * each window's start would give 09:10 and 14:00, which is two different grids in one
     * day and two different sets of times to read out.
     */
    const result = bookableSlots(
      input({
        policy: { ...input().policy, slotGranularityMinutes: 15 },
        clinicHours: [
          { weekday: 'MONDAY', startAtMinute: 550, endAtMinute: 660 },
          { weekday: 'MONDAY', startAtMinute: 850, endAtMinute: 960 },
        ],
        doctorWorkingHours: [
          { weekday: 'MONDAY', startAtMinute: 550, endAtMinute: 660 },
          { weekday: 'MONDAY', startAtMinute: 850, endAtMinute: 960 },
        ],
      }),
    );

    // 09:10-11:00 with a 30-minute service: 09:15, 09:30, 09:45, 10:00, 10:15, 10:30.
    // 14:10-16:00: 14:15, 14:30, 14:45, 15:00, 15:15, 15:30.
    expect(labels(result)).toEqual([
      '09:15',
      '09:30',
      '09:45',
      '10:00',
      '10:15',
      '10:30',
      '14:15',
      '14:30',
      '14:45',
      '15:00',
      '15:15',
      '15:30',
    ]);
  });
});

describe('bookableSlots, the doctor', () => {
  it('intersects the doctor hours with the clinic hours', () => {
    /**
     * Clinic open 09:00-13:00 and 14:00-18:00; doctor works 11:00-16:00. The bookable
     * windows are 11:00-13:00 and 14:00-16:00, because the doctor is not there before 11:00
     * and the clinic is shut after 16:00 for this doctor's purposes.
     */
    const result = bookableSlots(
      input({
        doctorWorkingHours: [{ weekday: 'MONDAY', startAtMinute: 660, endAtMinute: 960 }],
      }),
    );

    expect(labels(result)).toEqual([
      '11:00',
      '11:30',
      '12:00',
      '12:30',
      '14:00',
      '14:30',
      '15:00',
      '15:30',
    ]);
  });

  it('offers nothing when the doctor has no hours recorded for that weekday', () => {
    const result = bookableSlots(
      input({
        doctorWorkingHours: [{ weekday: 'TUESDAY', startAtMinute: 540, endAtMinute: 1080 }],
      }),
    );

    expect(result.slots).toEqual([]);
    expect(result.reason).toBe('DOCTOR_NOT_WORKING');
  });

  it('subtracts time off, splitting the window it falls inside', () => {
    /**
     * Time off 10:00 to 11:30 Kolkata, which is 04:30 to 06:00 UTC. The morning window
     * becomes 09:00-10:00 and 11:30-13:00. On a 30-minute grid that is 09:00 and 09:30 in
     * the first part, then 11:30, 12:00 and 12:30 in the second. 11:00 is gone because the
     * doctor is away until 11:30.
     */
    const result = bookableSlots(
      input({
        timeOff: [
          {
            startAt: new Date('2026-11-02T04:30:00.000Z'),
            endAt: new Date('2026-11-02T06:00:00.000Z'),
          },
        ],
      }),
    );

    expect(labels(result).filter((label) => label < '14:00')).toEqual([
      '09:00',
      '09:30',
      '11:30',
      '12:00',
      '12:30',
    ]);
  });

  it('subtracts a whole day of time off that starts before the day and ends after it', () => {
    const result = bookableSlots(
      input({
        timeOff: [
          {
            startAt: new Date('2026-11-01T00:00:00.000Z'),
            endAt: new Date('2026-11-04T00:00:00.000Z'),
          },
        ],
      }),
    );

    expect(result.slots).toEqual([]);
    expect(result.reason).toBe('DOCTOR_NOT_WORKING');
  });
});

describe('bookableSlots, existing appointments', () => {
  it('removes a taken slot and leaves its neighbours', () => {
    // 10:00 to 10:30 Kolkata is 04:30 to 05:00 UTC.
    const result = bookableSlots(
      input({
        appointments: [
          {
            startAt: new Date('2026-11-02T04:30:00.000Z'),
            endAt: new Date('2026-11-02T05:00:00.000Z'),
          },
        ],
      }),
    );

    expect(labels(result)).toEqual(FULL_DAY.filter((label) => label !== '10:00'));
  });

  it('allows a back-to-back booking when there is no buffer', () => {
    // 09:00-09:30 taken, so 09:30 is still free: the end instant is exclusive, which is
    // the same rule the appointments_no_overlap constraint uses.
    const result = bookableSlots(
      input({
        appointments: [
          {
            startAt: new Date('2026-11-02T03:30:00.000Z'),
            endAt: new Date('2026-11-02T04:00:00.000Z'),
          },
        ],
      }),
    );

    expect(labels(result)[0]).toBe('09:30');
  });

  it('keeps the buffer clear on BOTH sides of an existing appointment', () => {
    /**
     * A 15-minute clinic buffer and a 10:00-10:30 appointment. 09:30 would finish at 10:00
     * with no gap, and 10:30 would start as the appointment ends, so both go. 09:00 (ends
     * 09:30, a 30-minute gap) and 11:00 (starts 30 minutes after) survive.
     */
    const result = bookableSlots(
      input({
        policy: { ...input().policy, defaultBufferMinutes: 15 },
        appointments: [
          {
            startAt: new Date('2026-11-02T04:30:00.000Z'),
            endAt: new Date('2026-11-02T05:00:00.000Z'),
          },
        ],
      }),
    );

    expect(labels(result).filter((label) => label < '12:00')).toEqual(['09:00', '11:00', '11:30']);
  });

  it("prefers the doctor's own buffer over the clinic default", () => {
    /**
     * A 15-minute grid is needed to tell the two buffers apart, which is the point of the
     * example: on a 30-minute grid a 15-minute and a 30-minute buffer remove exactly the
     * same slots, so a test on that grid would pass whichever buffer the engine used.
     *
     * The appointment is 10:00 to 10:30 and the service is 30 minutes.
     *
     * Clinic default of 15 alone: a candidate needs 15 clear minutes either side, so the
     * last one before is 09:15 (ends 09:45, 15 minutes clear) and the first one after is
     * 10:45 (starts 15 minutes after the end).
     *
     * Doctor's own 30: the last one before is 09:00 (ends 09:30, 30 clear) and the first
     * one after is 11:00.
     */
    const appointments = [
      {
        startAt: new Date('2026-11-02T04:30:00.000Z'),
        endAt: new Date('2026-11-02T05:00:00.000Z'),
      },
    ];
    const fineGrid = { ...input().policy, slotGranularityMinutes: 15, defaultBufferMinutes: 15 };

    const clinicDefault = bookableSlots(input({ policy: fineGrid, appointments }));
    const doctorOverride = bookableSlots(
      input({ doctorBufferMinutes: 30, policy: fineGrid, appointments }),
    );

    expect(labels(clinicDefault).filter((label) => label < '11:15')).toEqual([
      '09:00',
      '09:15',
      '10:45',
      '11:00',
    ]);
    expect(labels(doctorOverride).filter((label) => label < '11:15')).toEqual(['09:00', '11:00']);
  });

  it('does not offer a taken start even when the stored policy asks for two per slot', () => {
    /**
     * The database allows one live appointment per doctor at a time, so a second patient at
     * 09:00 would be offered the time and then refused it (review I5). A clinic that saved
     * "two per slot" before the cap existed still has 2 stored, which is why the engine
     * clamps rather than relying on the settings form alone.
     */
    const taken = {
      startAt: new Date('2026-11-02T03:30:00.000Z'),
      endAt: new Date('2026-11-02T04:00:00.000Z'),
    };

    const storedTwo = bookableSlots(
      input({ policy: { ...input().policy, maxPerSlot: 2 }, appointments: [taken] }),
    );
    const storedTen = bookableSlots(
      input({ policy: { ...input().policy, maxPerSlot: 10 }, appointments: [taken] }),
    );

    expect(labels(storedTwo)).toEqual(FULL_DAY.filter((label) => label !== '09:00'));
    expect(labels(storedTen)).not.toContain('09:00');
  });

  it('does not let an overlapping appointment from elsewhere use up the allowance', () => {
    /**
     * `maxPerSlot: 2` and a 45-minute appointment at 09:15 that runs over 09:30. The 09:30
     * slot is NOT offered: the clinic overbooks by taking two patients at the same time,
     * not by stacking appointments that happen to overlap, and the exclusion constraint
     * would refuse this write anyway.
     */
    const result = bookableSlots(
      input({
        policy: { ...input().policy, maxPerSlot: 2 },
        appointments: [
          {
            startAt: new Date('2026-11-02T03:45:00.000Z'),
            endAt: new Date('2026-11-02T04:30:00.000Z'),
          },
        ],
      }),
    );

    expect(labels(result)).not.toContain('09:30');
  });

  it('reports a fully booked day rather than an empty list with no reason', () => {
    // Every 30 minutes of both windows taken: 09:00 to 13:00 and 14:00 to 18:00.
    const appointments = [
      ...Array.from({ length: 8 }, (_, index) => ({
        startAt: new Date(Date.UTC(2026, 10, 2, 3, 30 + index * 30)),
        endAt: new Date(Date.UTC(2026, 10, 2, 4, index * 30)),
      })),
      ...Array.from({ length: 8 }, (_, index) => ({
        startAt: new Date(Date.UTC(2026, 10, 2, 8, 30 + index * 30)),
        endAt: new Date(Date.UTC(2026, 10, 2, 9, index * 30)),
      })),
    ];

    const result = bookableSlots(input({ appointments }));

    expect(result.slots).toEqual([]);
    expect(result.reason).toBe('FULLY_BOOKED');
  });
});

describe('bookableSlots, the booking window', () => {
  it('refuses a day that has already passed on the clinic calendar', () => {
    const result = bookableSlots(input({ day: '2026-11-01' }));

    expect(result.slots).toEqual([]);
    expect(result.reason).toBe('DAY_IN_THE_PAST');
  });

  it('uses the clinic calendar for "today", not the UTC one', () => {
    /**
     * 2026-11-02T19:00Z is 00:30 on 2026-11-03 in Kolkata. So the 3rd is today for this
     * clinic and still bookable, while 02:00Z the same morning, which is 07:30 on the 2nd
     * locally, has the 2nd as today. A UTC reading of "today" would call the 3rd tomorrow at
     * one instant and today at the other, and refuse a day the clinic is open.
     */
    const afterLocalMidnight = bookableSlots(
      input({ day: '2026-11-03', now: new Date('2026-11-02T19:00:00.000Z') }),
    );

    expect(afterLocalMidnight.slots.length).toBeGreaterThan(0);

    const previousDayLocally = bookableSlots(
      input({ day: '2026-11-02', now: new Date('2026-11-02T19:00:00.000Z') }),
    );

    expect(previousDayLocally.reason).toBe('DAY_IN_THE_PAST');
  });

  it('applies the minimum notice within the day', () => {
    /**
     * Now is 10:10 Kolkata (04:40 UTC) and the clinic needs two hours of notice, so the
     * earliest bookable start is 12:10, which on a 30-minute grid is 12:30. The morning then
     * offers 12:30 alone and the afternoon is untouched.
     */
    const result = bookableSlots(
      input({
        now: new Date('2026-11-02T04:40:00.000Z'),
        policy: { ...input().policy, minimumNoticeMinutes: 120 },
      }),
    );

    expect(labels(result).filter((label) => label < '14:00')).toEqual(['12:30']);
  });

  it('offers nothing when the notice period runs past the end of the day', () => {
    // 17:00 Kolkata with 24 hours of notice: nothing left today.
    const result = bookableSlots(
      input({
        now: new Date('2026-11-02T11:30:00.000Z'),
        policy: { ...input().policy, minimumNoticeMinutes: 1440 },
      }),
    );

    expect(result.slots).toEqual([]);
    expect(result.reason).toBe('FULLY_BOOKED');
  });

  it('refuses a day beyond the maximum advance, counted in clinic days', () => {
    // Policy allows 30 days from the Monday, so 2026-12-02 is the last day and the 3rd is
    // one too far.
    expect(bookableSlots(input({ day: '2026-12-02' })).slots.length).toBeGreaterThan(0);

    const tooFar = bookableSlots(input({ day: '2026-12-03' }));
    expect(tooFar.slots).toEqual([]);
    expect(tooFar.reason).toBe('BEYOND_MAXIMUM_ADVANCE');
  });

  it('caps the advance at a year even when the policy says more', () => {
    const result = bookableSlots(
      input({ day: '2028-01-03', policy: { ...input().policy, maximumAdvanceDays: 5000 } }),
    );

    expect(result.reason).toBe('BEYOND_MAXIMUM_ADVANCE');
  });
});

describe('bookableSlots, an unconfigured clinic', () => {
  it('falls back to the service duration when no grid is configured', () => {
    // No granularity and a 60-minute service: slots sit back to back on the hour.
    const result = bookableSlots(
      input({
        serviceDurationMinutes: 60,
        policy: {
          slotGranularityMinutes: null,
          minimumNoticeMinutes: null,
          maximumAdvanceDays: null,
          defaultBufferMinutes: null,
          maxPerSlot: null,
        },
      }),
    );

    expect(labels(result)).toEqual([
      '09:00',
      '10:00',
      '11:00',
      '12:00',
      '14:00',
      '15:00',
      '16:00',
      '17:00',
    ]);
  });

  it('treats an absent maxPerSlot as one, never as unlimited', () => {
    const result = bookableSlots(
      input({
        policy: { ...input().policy, maxPerSlot: null },
        appointments: [
          {
            startAt: new Date('2026-11-02T03:30:00.000Z'),
            endAt: new Date('2026-11-02T04:00:00.000Z'),
          },
        ],
      }),
    );

    expect(labels(result)).not.toContain('09:00');
  });
});

describe('bookableSlots, a clinic in a zone with daylight saving', () => {
  it('still offers 09:00 local on the morning the clocks go forward', () => {
    /**
     * Europe/London, 2026-03-29, the morning BST starts. The clinic opens at 09:00 local,
     * which is 08:00 UTC that day and 09:00 UTC the day before. An engine that converted
     * with a fixed offset would offer slots an hour out, and the patient would arrive to a
     * locked door or a doctor who had already left.
     */
    const londonHours = [{ weekday: 'SUNDAY' as const, startAtMinute: 540, endAtMinute: 720 }];

    const result = bookableSlots(
      input({
        day: '2026-03-29',
        timeZone: 'Europe/London',
        now: new Date('2026-03-28T12:00:00.000Z'),
        clinicHours: londonHours,
        doctorWorkingHours: londonHours,
      }),
    );

    expect(labels(result)[0]).toBe('09:00');
    expect(result.slots[0]?.startAt.toISOString()).toBe('2026-03-29T08:00:00.000Z');
  });
});
