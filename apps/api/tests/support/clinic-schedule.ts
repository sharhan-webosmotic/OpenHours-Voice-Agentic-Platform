import {
  addDays,
  formatMinuteOfDay,
  weekdayOf,
  zonedParts,
  zonedTimeToUtc,
} from '@clinicai/shared';
import type { Tx } from './db.js';

/**
 * Helpers for tests that need a clinic a booking can actually succeed against.
 *
 * `createOrganisationGraph` creates one row in every table, which is what the isolation
 * suite needs, and that is deliberately not the same thing as a BOOKABLE clinic: it leaves
 * `opening_hours_collected_at` null, and D-013 says a clinic with no hours recorded is one
 * nobody has asked rather than one that is closed, so the slot engine correctly offers
 * nothing. These two functions turn that fixture into a clinic with a real Monday.
 */

/** The fixture's clinic and doctor are both open 09:00 to 17:00 on Monday, Asia/Kolkata. */
const TIME_ZONE = 'Asia/Kolkata';
const OPENS_AT_MINUTE = 9 * 60;
const CLOSES_AT_MINUTE = 17 * 60;
/**
 * The stride between two bookings is the SERVICE DURATION, not the booking grid.
 *
 * The fixture's clinic has a 15-minute grid and a 30-minute consultation, so consecutive
 * grid slots OVERLAP: booking 09:00 makes 09:15 unavailable, and a helper that stepped by
 * the grid handed the second caller a slot the first had just blocked. The exclusion
 * constraint then refused it with a 409, which in a permission guard reads as a pass and in
 * an audit guard reads as a missing audit row. Stepping by the duration gives back-to-back
 * bookings that all succeed.
 */
const SERVICE_DURATION_MINUTES = 30;
const SLOTS_PER_DAY = (CLOSES_AT_MINUTE - OPENS_AT_MINUTE) / SERVICE_DURATION_MINUTES;

/**
 * Marks the clinic's opening hours as collected, so the slot engine will offer slots.
 *
 * Separate from the fixture rather than folded into it, because the isolation suite depends
 * on the fixture's current shape and because "hours exist" and "somebody confirmed the
 * hours" are genuinely different states that D-013 exists to keep apart.
 */
export const markHoursCollected = async (tx: Tx, organisationId: string): Promise<void> => {
  await tx.organisation.update({
    where: { id: organisationId },
    data: { openingHoursCollectedAt: new Date() },
  });
};

/**
 * A distinct bookable instant per call, as an ISO string.
 *
 * COMPUTED FROM TODAY, NOT HARDCODED. A fixed date passes until it is in the past, and then
 * fails with "that date has already passed" in a suite nobody changed. The target is the
 * first Monday at least eight days away, which is inside the fixture's 60-day maximum
 * advance and far enough ahead that no minimum notice can reach it.
 *
 * `index` walks the day in service-length steps and rolls onto the following Monday after a
 * day is used up, so a caller that books thirty times never collides with itself. Collisions matter here:
 * the exclusion constraint would refuse the second booking with a 409, and a recipe that
 * silently returned 409 instead of 201 would make a permission test pass while proving
 * nothing.
 */
export const bookableStart = (index: number, now: Date = new Date()): string => {
  const today = zonedParts(now, TIME_ZONE).day;

  let day = addDays(today, 8);
  while (weekdayOf(day) !== 'MONDAY') {
    day = addDays(day, 1);
  }

  const week = Math.floor(index / SLOTS_PER_DAY);
  const slot = index % SLOTS_PER_DAY;

  return zonedTimeToUtc(
    addDays(day, week * 7),
    OPENS_AT_MINUTE + slot * SERVICE_DURATION_MINUTES,
    TIME_ZONE,
  ).toISOString();
};

/**
 * A counter shared by every recipe in a test file.
 *
 * Module-level on purpose: the recipes in one file all book against the SAME fixture doctor,
 * so a per-recipe counter would hand two of them the same slot.
 */
let cursor = 0;

export const nextBookableStart = (now?: Date): string => bookableStart(cursor++, now);

/** Resets the counter, for a file that wants deterministic slots. */
export const resetBookableCursor = (): void => {
  cursor = 0;
};

/**
 * The same instant as `nextBookableStart`, as the clinic's own date and time.
 *
 * The voice tools take `date` and `time` in the clinic's zone rather than a UTC instant,
 * because that is what a patient says out loud, so a recipe driving them needs the local
 * pair. Derived from the same counter, so a voice recipe and an HTTP recipe in one file
 * cannot be handed the same slot.
 */
export const nextBookableLocal = (now?: Date): { readonly date: string; readonly time: string } => {
  const parts = zonedParts(new Date(nextBookableStart(now)), TIME_ZONE);

  return { date: parts.day, time: formatMinuteOfDay(parts.minuteOfDay) };
};
