import { clinicDayOf, formatMinuteOfDay, zonedParts, type ClinicDay } from '@clinicai/shared';

/**
 * Every date and time on every screen, rendered in the CLINIC's time zone.
 *
 * ─── WHY THE ZONE IS A PARAMETER AND NOT A DEFAULT ──────────────────────────────
 *
 * The browser's zone is the receptionist's laptop, which is usually the clinic's and is not
 * the same thing. A clinic in Kolkata whose owner is travelling would otherwise see every
 * appointment shifted by hours, with nothing on the screen admitting it. So the zone comes
 * from the organisation and is threaded through: a formatter with a default would be used
 * without one by the first screen in a hurry.
 *
 * The API sends UTC instants (root CLAUDE.md), so these are the only place the conversion
 * happens on this side, and `@clinicai/shared/clinic-time` is where the arithmetic lives.
 */

const dateFormatter = (timeZone: string, options: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat('en-IN', { timeZone, ...options });

/** `2:00 PM`, which is what the prototype shows beside an appointment. */
export const formatTime = (instant: string, timeZone: string): string =>
  dateFormatter(timeZone, { hour: 'numeric', minute: '2-digit', hour12: true }).format(
    new Date(instant),
  );

/** `19 May 2025`. */
export const formatDate = (instant: string, timeZone: string): string =>
  dateFormatter(timeZone, { day: 'numeric', month: 'short', year: 'numeric' }).format(
    new Date(instant),
  );

/** `Mon, 19 May`, for a calendar heading. */
export const formatDayHeading = (instant: string, timeZone: string): string =>
  dateFormatter(timeZone, { weekday: 'short', day: 'numeric', month: 'short' }).format(
    new Date(instant),
  );

/** `19 May 2025, 2:00 PM`, for a detail panel. */
export const formatDateTime = (instant: string, timeZone: string): string =>
  `${formatDate(instant, timeZone)}, ${formatTime(instant, timeZone)}`;

/** The clinic-local calendar day an instant falls on, as `yyyy-MM-dd`. */
export const clinicDay = (instant: string, timeZone: string): ClinicDay =>
  clinicDayOf(new Date(instant), timeZone);

/** Today, on the clinic's calendar rather than the browser's. */
export const clinicToday = (timeZone: string): ClinicDay => clinicDayOf(new Date(), timeZone);

/**
 * A stored date of birth, rendered as the day it is.
 *
 * NOT through `Intl` with a zone, deliberately. A date of birth has no time and no zone: the
 * API sends `1988-06-14` and parsing it as an instant to reformat it is how a birthday
 * becomes the 13th for anyone west of the clinic.
 */
export const formatDateOfBirth = (day: string | null): string => {
  if (day === null) {
    return 'Not recorded';
  }

  const [year, month, dayOfMonth] = day.split('-');
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];

  const monthIndex = Number(month) - 1;
  const monthName = months[monthIndex];

  return monthName === undefined || year === undefined || dayOfMonth === undefined
    ? day
    : `${Number(dayOfMonth)} ${monthName} ${year}`;
};

/** `09:00`, from minutes past clinic-local midnight. Re-exported so screens import one module. */
export const formatOpeningMinute = formatMinuteOfDay;

/**
 * Integer minor units as rupees.
 *
 * Money is stored in paise (root CLAUDE.md) and divided only here, at the edge. `null` is a
 * price nobody has set, which is a different thing from free.
 */
export const formatMoney = (minorUnits: number | null): string =>
  minorUnits === null
    ? 'Not set'
    : new Intl.NumberFormat('en-IN', {
        style: 'currency',
        currency: 'INR',
        maximumFractionDigits: minorUnits % 100 === 0 ? 0 : 2,
      }).format(minorUnits / 100);

/** `30 min`, or `1 hr 30 min`. */
export const formatDuration = (minutes: number): string => {
  if (minutes < 60) {
    return `${String(minutes)} min`;
  }

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest === 0 ? `${String(hours)} hr` : `${String(hours)} hr ${String(rest)} min`;
};

/**
 * `09:00`, on the clinic's 24-hour clock.
 *
 * The appointments reference writes times this way in its list, its week and its day views,
 * where `formatTime` writes `9:00 am` for the dashboard's sentences. Both read the clinic's
 * own zone; only the clock differs.
 */
export const formatTime24 = (instant: string, timeZone: string): string =>
  formatMinuteOfDay(zonedParts(new Date(instant), timeZone).minuteOfDay);

/** `2025-05-19`, the clinic's calendar day, as the reference's list and drawer write a date. */
export const formatIsoDay = (instant: string, timeZone: string): string =>
  clinicDayOf(new Date(instant), timeZone);
