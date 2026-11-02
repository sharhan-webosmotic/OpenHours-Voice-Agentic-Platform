/**
 * Converting between a clinic's wall clock and UTC instants.
 *
 * Every instant in this product is stored and transmitted as UTC (root CLAUDE.md), and
 * every opening hour, working hour and break is stored as MINUTES FROM LOCAL MIDNIGHT on a
 * weekday (D-013). Something has to join the two, and this is the only place that does it:
 * a second implementation is a second set of DST rules, and the failure mode is an
 * appointment an hour away from where the patient thinks it is.
 *
 * WHY MINUTES AND A WEEKDAY RATHER THAN A STORED TIMESTAMP. A clinic that opens at 09:00
 * opens at 09:00 on both sides of a daylight-saving transition. Storing the opening as an
 * instant freezes an offset that the calendar then invalidates. India has no DST today, and
 * that is exactly the kind of fact that makes a latent bug invisible until the product
 * reaches a clinic somewhere that does.
 *
 * The weekday type is the shared `Weekday`, so there is one set of names in the product.
 *
 * NO DATE LIBRARY. `date-fns` appears in `docs/STACK.md` but is not installed in the API,
 * and adding a dependency needs asking (root CLAUDE.md). `Intl.DateTimeFormat` resolves the
 * offset from the runtime's own zone database, which is the same source a library would
 * read, so the only thing a library would add here is convenience.
 */

import { type Weekday } from './clinic.js';

/**
 * The weekday names, indexed the way `Date.getUTCDay` returns them.
 *
 * A SECOND ORDERING OF THE SAME SEVEN NAMES, kept private to this module. `WEEKDAYS` in
 * `clinic.ts` is Monday-first because it matches the Prisma enum and is what a week of
 * opening hours is rendered in; `getUTCDay` is Sunday-first. Exporting a second public list
 * would be two orderings a caller has to choose between, which is how a schedule ends up a
 * day out, so the conversion lives here and the type is the shared one.
 */
const BY_UTC_DAY_INDEX: readonly Weekday[] = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
];

/** A clinic-local calendar day, `yyyy-MM-dd`. Never an instant: a day has no time zone. */
export type ClinicDay = string;

const DAY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

export const isClinicDay = (value: string): value is ClinicDay => {
  if (!DAY_PATTERN.test(value)) {
    return false;
  }

  // Rejects 2026-02-30 and friends: `Date.UTC` rolls them over rather than failing, so the
  // round trip is what proves the day exists.
  const [year, month, day] = value.split('-').map(Number) as [number, number, number];
  const asUtc = new Date(Date.UTC(year, month - 1, day));

  return (
    asUtc.getUTCFullYear() === year &&
    asUtc.getUTCMonth() === month - 1 &&
    asUtc.getUTCDate() === day
  );
};

/**
 * One formatter per zone, built once.
 *
 * `Intl.DateTimeFormat` construction is the expensive part of this file, and the voice tool
 * endpoints have a 400 ms budget at the 95th percentile with a slot search inside it. The
 * cache is keyed by zone and holds one small object per clinic.
 */
const formatters = new Map<string, Intl.DateTimeFormat>();

const formatterFor = (timeZone: string): Intl.DateTimeFormat => {
  const existing = formatters.get(timeZone);
  if (existing !== undefined) {
    return existing;
  }

  const created = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    weekday: 'short',
  });

  formatters.set(timeZone, created);
  return created;
};

const WEEKDAY_BY_SHORT_NAME: Readonly<Record<string, Weekday>> = {
  Sun: 'SUNDAY',
  Mon: 'MONDAY',
  Tue: 'TUESDAY',
  Wed: 'WEDNESDAY',
  Thu: 'THURSDAY',
  Fri: 'FRIDAY',
  Sat: 'SATURDAY',
};

/** What an instant looks like on a clinic's wall clock. */
export type ZonedParts = {
  readonly day: ClinicDay;
  /** Minutes from local midnight, 0 to 1439. */
  readonly minuteOfDay: number;
  readonly weekday: Weekday;
};

/**
 * Reads an instant as the clinic sees it.
 *
 * Built from `formatToParts` rather than by parsing a formatted string, because the string
 * layout is a locale's business and the parts are not.
 */
export const zonedParts = (instant: Date, timeZone: string): ZonedParts => {
  const parts = formatterFor(timeZone).formatToParts(instant);
  const value = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((part) => part.type === type)?.value ?? '';

  // 24:00 rather than 00:00 is how `hour12: false` reports local midnight on some
  // runtimes, so it is normalised rather than trusted.
  const hour = Number(value('hour')) % 24;
  const weekday = WEEKDAY_BY_SHORT_NAME[value('weekday')];

  if (weekday === undefined) {
    throw new Error(`unrecognised weekday from the runtime for zone ${timeZone}`);
  }

  return {
    day: `${value('year')}-${value('month')}-${value('day')}`,
    minuteOfDay: hour * 60 + Number(value('minute')),
    weekday,
  };
};

/**
 * The offset of a zone at a given instant, in minutes east of UTC.
 *
 * Asia/Kolkata is +330. The sign convention is the one `Date.getTimezoneOffset` inverts, so
 * it is stated rather than assumed: adding this to a UTC instant gives the local clock.
 */
const offsetMinutesAt = (instant: Date, timeZone: string): number => {
  const { day, minuteOfDay } = zonedParts(instant, timeZone);
  const [year, month, dayOfMonth] = day.split('-').map(Number) as [number, number, number];

  const localAsUtc = Date.UTC(year, month - 1, dayOfMonth, 0, minuteOfDay);

  // Seconds and milliseconds are dropped from both sides: zone offsets are whole minutes
  // in every zone still in use, and keeping them would make this a subtraction of unequal
  // precisions.
  const instantMinutes = Math.floor(instant.getTime() / 60_000) * 60_000;

  return (localAsUtc - instantMinutes) / 60_000;
};

/**
 * The UTC instant of a clinic-local wall-clock time.
 *
 * TWO PASSES, AND THE SECOND ONE IS NOT OPTIONAL. The offset depends on the instant, and
 * the instant is what is being computed, so the first pass guesses with the offset at the
 * naive instant and the second corrects it. One pass is wrong for any local time within an
 * offset's distance of a transition, which is every clinic that opens on the morning the
 * clocks change.
 *
 * A local time that does not exist, because the clocks jumped over it, resolves forward to
 * the instant the jump lands on, which is what a clinic means by "we open at 09:00" on that
 * morning. A local time that happens twice resolves to the first of the two.
 */
export const zonedTimeToUtc = (day: ClinicDay, minuteOfDay: number, timeZone: string): Date => {
  const [year, month, dayOfMonth] = day.split('-').map(Number) as [number, number, number];
  const naive = Date.UTC(year, month - 1, dayOfMonth, 0, minuteOfDay);

  /**
   * Each candidate is CHECKED by reading it back, rather than trusted.
   *
   * A blind two-pass returns whichever offset the second pass happened to see, and for a
   * local time the clocks jumped over that is the offset from AFTER the gap, which lands an
   * hour before the time that was asked for. Reading the candidate back on the clinic's own
   * clock is the only way to know whether it is the requested wall time.
   */
  const usingOffsetAt = (reference: Date): Date =>
    new Date(naive - offsetMinutesAt(reference, timeZone) * 60_000);

  const beforeTransition = usingOffsetAt(new Date(naive));
  const afterTransition = usingOffsetAt(beforeTransition);

  for (const candidate of [beforeTransition, afterTransition]) {
    const read = zonedParts(candidate, timeZone);
    if (read.day === day && read.minuteOfDay === minuteOfDay) {
      return candidate;
    }
  }

  /**
   * Neither candidate reads back, so this local time does not exist: the clocks jumped
   * over it. `beforeTransition` uses the offset in force up to the gap, which puts the
   * result at the instant the clock reaches the requested time, the gap's width later.
   * That is what a clinic means by "we open at 09:00" on the morning the clocks change,
   * and it is never earlier than the time asked for, which matters when the value is a
   * minimum notice or an opening time rather than a label.
   */
  return beforeTransition;
};

/** The UTC instant of clinic-local midnight that starts `day`. */
export const startOfClinicDay = (day: ClinicDay, timeZone: string): Date =>
  zonedTimeToUtc(day, 0, timeZone);

/** The UTC instant of clinic-local midnight that ENDS `day`, exclusive. */
export const endOfClinicDay = (day: ClinicDay, timeZone: string): Date =>
  zonedTimeToUtc(addDays(day, 1), 0, timeZone);

/** The clinic-local day `count` days after `day`. Calendar arithmetic, never 86,400,000. */
export const addDays = (day: ClinicDay, count: number): ClinicDay => {
  const [year, month, dayOfMonth] = day.split('-').map(Number) as [number, number, number];
  const moved = new Date(Date.UTC(year, month - 1, dayOfMonth + count));

  return toDayString(moved);
};

/** Formats a UTC date's calendar fields as `yyyy-MM-dd`. */
const toDayString = (utc: Date): ClinicDay =>
  [
    String(utc.getUTCFullYear()).padStart(4, '0'),
    String(utc.getUTCMonth() + 1).padStart(2, '0'),
    String(utc.getUTCDate()).padStart(2, '0'),
  ].join('-');

/** Which weekday a clinic-local day falls on. */
export const weekdayOf = (day: ClinicDay): Weekday => {
  const [year, month, dayOfMonth] = day.split('-').map(Number) as [number, number, number];
  const index = new Date(Date.UTC(year, month - 1, dayOfMonth)).getUTCDay();

  // Safe by construction: getUTCDay returns 0 to 6 and the lookup has seven entries in that
  // order, which the test "covers every index the runtime can return" asserts.
  return BY_UTC_DAY_INDEX[index] ?? 'SUNDAY';
};

/** The clinic-local day an instant falls on. */
export const clinicDayOf = (instant: Date, timeZone: string): ClinicDay =>
  zonedParts(instant, timeZone).day;

/**
 * Every day in `[from, to]`, inclusive of both ends.
 *
 * Bounded at 400 days, which is above any range a screen asks for (a month view asks for
 * about 42) and below the point at which a mistyped range becomes a query that scans a
 * clinic's whole history.
 */
export const daysBetween = (from: ClinicDay, to: ClinicDay): readonly ClinicDay[] => {
  const days: ClinicDay[] = [];

  for (let day = from; day <= to; day = addDays(day, 1)) {
    days.push(day);

    if (days.length > 400) {
      throw new Error('day range is too wide');
    }
  }

  return days;
};

/** `540` as `09:00`, for a message the agent reads out or a label on a screen. */
export const formatMinuteOfDay = (minuteOfDay: number): string => {
  const hours = Math.floor(minuteOfDay / 60);
  const minutes = minuteOfDay % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};
