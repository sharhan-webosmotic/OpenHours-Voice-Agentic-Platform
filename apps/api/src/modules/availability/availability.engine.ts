import {
  MAX_PER_SLOT_SUPPORTED,
  formatMinuteOfDay,
  weekdayOf,
  zonedParts,
  zonedTimeToUtc,
  type ClinicDay,
  type Weekday,
} from '@clinicai/shared';

/**
 * Which slots a doctor can actually be booked into on one day.
 *
 * A PURE FUNCTION over data someone else loaded. That is the whole design: this is the most
 * rule-dense piece of logic in the product, it is what the voice agent asks before it offers
 * a patient a time, and it is the thing that must be testable from worked examples rather
 * than from its own output. Nothing here reads a database, a clock or a configuration file.
 * `now` is a parameter for the same reason.
 *
 * ─── THE RULES, IN THE ORDER THEY ARE APPLIED ───────────────────────────────────
 *
 *  1. The clinic has to have told us its hours at all. D-013: a clinic with no hours
 *     recorded is not a clinic that is closed, it is a clinic nobody has asked, and
 *     offering slots from an assumption is how a patient is given a time the door is locked.
 *  2. The day has to be inside the booking window: not in the past, not before the minimum
 *     notice, not beyond the maximum advance.
 *  3. The clinic is open on that weekday, in one or more segments. A BREAK IS THE GAP
 *     BETWEEN TWO SEGMENTS (D-013), so nothing in here knows what a break is: 09:00-13:00
 *     and 14:00-18:00 is a clinic with a lunch break, and the hour between them is simply
 *     not open.
 *  4. The doctor is working inside those segments. A doctor with no working hours recorded
 *     for a weekday is not working that day. The bookable windows are the INTERSECTION of
 *     the clinic's segments and the doctor's.
 *  5. Time off is subtracted from the windows.
 *  6. Candidate starts step across each window on the granularity grid, and a slot must fit
 *     entirely inside its window: a 30-minute service cannot start 20 minutes before close.
 *  7. An existing appointment blocks a candidate, with the buffer counted on both sides.
 *  8. A clinic that deliberately overbooks allows `maxPerSlot` appointments at one start,
 *     capped at MAX_PER_SLOT_SUPPORTED: the database's no-overlap constraint allows one, and
 *     offering a time it will refuse is the failure a patient remembers (review I5).
 *
 * ─── WHAT A NULL POLICY FIELD MEANS ─────────────────────────────────────────────
 *
 * Every policy field is nullable (D-013), because a clinic is configured over several
 * conversations. Each default below is chosen so that an unconfigured clinic is SAFE rather
 * than permissive, and `clinic-readiness.ts` is what stops such a clinic going live:
 *
 *   slotGranularityMinutes  the service's own duration, so slots sit back to back
 *   minimumNoticeMinutes    0, meaning a slot is bookable up to its start
 *   maximumAdvanceDays      the hard ceiling below, never unbounded
 *   defaultBufferMinutes    0
 *   maxPerSlot              1, which is the only safe reading of "not configured", and
 *                           never more than MAX_PER_SLOT_SUPPORTED whatever is stored
 */

/** The furthest ahead anything may be booked, whatever the policy says. */
export const MAXIMUM_ADVANCE_DAYS_CEILING = 365;

export type HoursSegment = {
  readonly weekday: Weekday;
  readonly startAtMinute: number;
  readonly endAtMinute: number;
};

export type Interval = {
  readonly startAt: Date;
  readonly endAt: Date;
};

export type BookingPolicyInputs = {
  readonly slotGranularityMinutes: number | null;
  readonly minimumNoticeMinutes: number | null;
  readonly maximumAdvanceDays: number | null;
  readonly defaultBufferMinutes: number | null;
  readonly maxPerSlot: number | null;
};

export type SlotEngineInput = {
  readonly day: ClinicDay;
  readonly timeZone: string;
  /** The instant the request is being answered at. A parameter, never `new Date()` inside. */
  readonly now: Date;
  readonly serviceDurationMinutes: number;
  readonly policy: BookingPolicyInputs;
  /** The doctor's own buffer, which overrides the clinic default when it is non-zero. */
  readonly doctorBufferMinutes: number;
  /** Whether the clinic has ever had its opening hours collected. */
  readonly hoursCollected: boolean;
  /** The clinic's opening segments, for the whole week. */
  readonly clinicHours: readonly HoursSegment[];
  /** The doctor's working segments, for the whole week. */
  readonly doctorWorkingHours: readonly HoursSegment[];
  /** Time off overlapping the day, as instants. */
  readonly timeOff: readonly Interval[];
  /** Appointments that still hold their slot, as instants. Cancelled ones are not here. */
  readonly appointments: readonly Interval[];
};

export type Slot = {
  readonly startAt: Date;
  readonly endAt: Date;
  /** Minutes from clinic-local midnight, so a caller can label it without re-converting. */
  readonly startMinute: number;
  /** `09:30`, for the agent to read out and the dashboard to render. */
  readonly label: string;
};

/** Why a day has no slots. Returned rather than logged: the agent says this to a caller. */
export type NoSlotsReason =
  | 'HOURS_NOT_COLLECTED'
  | 'DAY_IN_THE_PAST'
  | 'BEYOND_MAXIMUM_ADVANCE'
  | 'CLINIC_CLOSED'
  | 'DOCTOR_NOT_WORKING'
  | 'FULLY_BOOKED';

export type AvailabilityResult = {
  readonly slots: readonly Slot[];
  /** Set when `slots` is empty, so the caller never has to guess which empty it is. */
  readonly reason?: NoSlotsReason;
};

type MinuteRange = { start: number; end: number };

/** Clamps the segments of one weekday into minute ranges, ignoring malformed rows. */
const segmentsFor = (segments: readonly HoursSegment[], weekday: Weekday): readonly MinuteRange[] =>
  segments
    .filter((segment) => segment.weekday === weekday && segment.endAtMinute > segment.startAtMinute)
    .map((segment) => ({ start: segment.startAtMinute, end: segment.endAtMinute }))
    .sort((a, b) => a.start - b.start);

/** The overlap of two sets of ranges. Both sides are already sorted by start. */
const intersect = (
  left: readonly MinuteRange[],
  right: readonly MinuteRange[],
): readonly MinuteRange[] => {
  const result: MinuteRange[] = [];

  for (const a of left) {
    for (const b of right) {
      const start = Math.max(a.start, b.start);
      const end = Math.min(a.end, b.end);

      if (end > start) {
        result.push({ start, end });
      }
    }
  }

  return result.sort((a, b) => a.start - b.start);
};

/** Removes `holes` from `ranges`, splitting a range a hole lands in the middle of. */
const subtract = (
  ranges: readonly MinuteRange[],
  holes: readonly MinuteRange[],
): readonly MinuteRange[] => {
  let remaining = [...ranges];

  for (const hole of holes) {
    const next: MinuteRange[] = [];

    for (const range of remaining) {
      if (hole.end <= range.start || hole.start >= range.end) {
        next.push(range);
        continue;
      }

      if (hole.start > range.start) {
        next.push({ start: range.start, end: hole.start });
      }
      if (hole.end < range.end) {
        next.push({ start: hole.end, end: range.end });
      }
    }

    remaining = next;
  }

  return remaining.sort((a, b) => a.start - b.start);
};

/**
 * An instant interval as minutes on the clinic's clock for `day`.
 *
 * Intervals that start before the day or end after it are clamped to the day's bounds, which
 * is what makes a multi-day block of time off subtract correctly from the middle day.
 */
const toMinuteRange = (
  interval: Interval,
  day: ClinicDay,
  timeZone: string,
): MinuteRange | undefined => {
  const dayStart = zonedTimeToUtc(day, 0, timeZone).getTime();
  const dayEnd = zonedTimeToUtc(day, 0, timeZone).getTime() + 24 * 60 * 60_000;

  const start = interval.startAt.getTime();
  const end = interval.endAt.getTime();

  if (end <= dayStart || start >= dayEnd) {
    return undefined;
  }

  const clampedStart = Math.max(start, dayStart);
  const clampedEnd = Math.min(end, dayEnd);

  return {
    start: Math.round((clampedStart - dayStart) / 60_000),
    end: Math.round((clampedEnd - dayStart) / 60_000),
  };
};

export const bookableSlots = (input: SlotEngineInput): AvailabilityResult => {
  const {
    day,
    timeZone,
    now,
    serviceDurationMinutes,
    policy,
    doctorBufferMinutes,
    hoursCollected,
    clinicHours,
    doctorWorkingHours,
    timeOff,
    appointments,
  } = input;

  if (!hoursCollected) {
    return { slots: [], reason: 'HOURS_NOT_COLLECTED' };
  }

  const granularity =
    policy.slotGranularityMinutes !== null && policy.slotGranularityMinutes > 0
      ? policy.slotGranularityMinutes
      : serviceDurationMinutes;
  const minimumNotice = policy.minimumNoticeMinutes ?? 0;
  const maximumAdvance = Math.min(
    policy.maximumAdvanceDays ?? MAXIMUM_ADVANCE_DAYS_CEILING,
    MAXIMUM_ADVANCE_DAYS_CEILING,
  );
  const buffer = doctorBufferMinutes > 0 ? doctorBufferMinutes : (policy.defaultBufferMinutes ?? 0);
  const maxPerSlot = Math.min(
    policy.maxPerSlot !== null && policy.maxPerSlot > 0 ? policy.maxPerSlot : 1,
    MAX_PER_SLOT_SUPPORTED,
  );

  if (granularity <= 0 || serviceDurationMinutes <= 0) {
    return { slots: [], reason: 'FULLY_BOOKED' };
  }

  // The day's bounds on the clinic's own calendar, which is the only calendar that can
  // answer "is this day in the past" for a clinic five and a half hours from UTC.
  const today = zonedParts(now, timeZone).day;

  if (day < today) {
    return { slots: [], reason: 'DAY_IN_THE_PAST' };
  }

  const advanceDays = Math.round(
    (zonedTimeToUtc(day, 0, timeZone).getTime() - zonedTimeToUtc(today, 0, timeZone).getTime()) /
      (24 * 60 * 60_000),
  );

  if (advanceDays > maximumAdvance) {
    return { slots: [], reason: 'BEYOND_MAXIMUM_ADVANCE' };
  }

  const weekday = weekdayOf(day);
  const clinicSegments = segmentsFor(clinicHours, weekday);

  if (clinicSegments.length === 0) {
    return { slots: [], reason: 'CLINIC_CLOSED' };
  }

  const doctorSegments = segmentsFor(doctorWorkingHours, weekday);

  if (doctorSegments.length === 0) {
    return { slots: [], reason: 'DOCTOR_NOT_WORKING' };
  }

  const holes = timeOff
    .map((interval) => toMinuteRange(interval, day, timeZone))
    .filter((range): range is MinuteRange => range !== undefined);

  const windows = subtract(intersect(clinicSegments, doctorSegments), holes);

  if (windows.length === 0) {
    return { slots: [], reason: 'DOCTOR_NOT_WORKING' };
  }

  /**
   * Existing appointments as minute ranges, each widened by the buffer on both sides.
   *
   * Widening HERE rather than at the comparison is what makes the buffer symmetric: a
   * 15-minute buffer means 15 minutes clear after an appointment and 15 minutes clear before
   * the next one, which is the same requirement stated from either side. The alternative,
   * adding the buffer only to the existing appointment's end, lets a new appointment be
   * booked to finish exactly as the next one starts.
   */
  const busy = appointments
    .map((interval) => toMinuteRange(interval, day, timeZone))
    .filter((range): range is MinuteRange => range !== undefined);

  const earliestStartMinute = (() => {
    const notBefore = new Date(now.getTime() + minimumNotice * 60_000);
    const parts = zonedParts(notBefore, timeZone);

    if (parts.day < day) {
      return 0;
    }
    if (parts.day > day) {
      // The notice period runs past the whole day, so nothing on it is bookable.
      return Number.POSITIVE_INFINITY;
    }
    return parts.minuteOfDay;
  })();

  const slots: Slot[] = [];

  for (const window of windows) {
    /**
     * Candidates sit on the grid from MIDNIGHT, not from the window's start.
     *
     * A clinic with a 15-minute grid that opens at 09:10 offers 09:15, not 09:10, and the
     * afternoon segment after a lunch break lines up with the morning one. Aligning to the
     * window instead would give one clinic two different grids either side of its break.
     */
    const firstAligned = Math.ceil(window.start / granularity) * granularity;

    for (
      let start = firstAligned;
      start + serviceDurationMinutes <= window.end;
      start += granularity
    ) {
      if (start < earliestStartMinute) {
        continue;
      }

      const candidate = { start, end: start + serviceDurationMinutes };

      const overlapping = busy.filter(
        (taken) => candidate.start < taken.end + buffer && taken.start < candidate.end + buffer,
      );

      /**
       * `maxPerSlot` counts appointments AT THIS START, not overlapping ones.
       *
       * An overbooking clinic means "two patients at 09:00", not "two appointments
       * overlapping 09:00 from anywhere", and counting the latter would let a 09:30 booking
       * through because a 09:00 appointment was already using up the allowance.
       */
      if (overlapping.length > 0) {
        const sameStart = overlapping.filter((taken) => taken.start === candidate.start);

        if (sameStart.length !== overlapping.length || sameStart.length >= maxPerSlot) {
          continue;
        }
      }

      slots.push({
        startAt: zonedTimeToUtc(day, start, timeZone),
        endAt: zonedTimeToUtc(day, start + serviceDurationMinutes, timeZone),
        startMinute: start,
        label: formatMinuteOfDay(start),
      });
    }
  }

  if (slots.length === 0) {
    return { slots: [], reason: 'FULLY_BOOKED' };
  }

  return { slots };
};
