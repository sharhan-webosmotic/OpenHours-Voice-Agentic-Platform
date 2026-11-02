import { z } from 'zod';
import { isClinicDay } from './clinic-time.js';

/**
 * The appointment contract: statuses, sources, and the rules for moving between statuses.
 *
 * THE TRANSITION TABLE IS THE IMPORTANT PART OF THIS FILE. It is here rather than in the
 * API because it is a rule about the domain, not about a route, and because the dashboard
 * has to know which buttons to offer: a screen that offers "mark as completed" on a
 * cancelled appointment is a screen that asks the server a question it will refuse.
 */

export const APPOINTMENT_STATUSES = [
  'SCHEDULED',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
] as const;

export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];

/**
 * Where a booking came from. Matches the Prisma `AppointmentSource` enum.
 *
 * A WALK-IN IS RECORDED AS `DASHBOARD` FOR NOW, which is a known gap: the feature brief asks
 * for manual, walk-in and AI as three distinguishable sources, and the enum has three values
 * that do not line up with them. Adding `WALK_IN` is an additive migration and a schema
 * change, so it waits for sign-off rather than arriving inside this feature.
 * `docs/features/clinic-dashboard.md` records it.
 */
export const APPOINTMENT_SOURCES = ['VOICE_AGENT', 'DASHBOARD', 'IMPORT'] as const;

export type AppointmentSource = (typeof APPOINTMENT_SOURCES)[number];

/**
 * Which statuses each status may move to.
 *
 * ─── WHY EACH ROW IS WHAT IT IS ─────────────────────────────────────────────────
 *
 * SCHEDULED   a booking that exists. It can be confirmed, cancelled, completed if the
 *             patient simply turned up, or marked a no-show.
 * CONFIRMED   the patient has acknowledged it. The same onward moves, minus going back to
 *             SCHEDULED: un-confirming is not a thing a clinic does, and allowing it would
 *             mean a reminder could be sent twice.
 * COMPLETED   terminal. The visit happened. Reversing it would mean a prescription and a
 *             follow-up hanging off an appointment that no longer took place.
 * CANCELLED   terminal. A cancelled appointment is not reinstated, it is rebooked, so that
 *             the cancellation stays in the history the clinic can read.
 * NO_SHOW     terminal, and deliberately NOT reversible to COMPLETED. A no-show recorded in
 *             error is corrected by the clinic's own notes, not by rewriting what happened.
 *
 * The two terminal rules are the ones that will be argued with, so the reason is stated: an
 * appointment's status is a record of events, and a record you can rewrite is not a record.
 */
export const APPOINTMENT_TRANSITIONS: Readonly<
  Record<AppointmentStatus, readonly AppointmentStatus[]>
> = {
  SCHEDULED: ['CONFIRMED', 'CANCELLED', 'COMPLETED', 'NO_SHOW'],
  CONFIRMED: ['COMPLETED', 'CANCELLED', 'NO_SHOW'],
  COMPLETED: [],
  CANCELLED: [],
  NO_SHOW: [],
};

/** Whether a status change is allowed. The service enforces it; the UI reads it. */
export const canTransition = (from: AppointmentStatus, to: AppointmentStatus): boolean =>
  APPOINTMENT_TRANSITIONS[from].includes(to);

/**
 * The statuses that still hold their slot.
 *
 * Used in three places that must agree: the exclusion constraint's `WHERE` clause, the slot
 * engine's view of what is taken, and the agenda's counts. The constraint is the one that
 * cannot be changed from here, so this list follows it rather than the other way round.
 */
export const SLOT_HOLDING_STATUSES: readonly AppointmentStatus[] = ['SCHEDULED', 'CONFIRMED'];

export const holdsSlot = (status: AppointmentStatus): boolean =>
  SLOT_HOLDING_STATUSES.includes(status);

const clinicDay = z
  .string()
  .refine((value) => isClinicDay(value), { message: 'must be a date as yyyy-MM-dd' });

/** A UTC instant on the wire, always ISO-8601 with an offset (root CLAUDE.md). */
const instant = z.string().datetime({
  offset: true,
  message: 'must be an ISO-8601 instant, for example 2026-11-02T03:30:00Z',
});

/**
 * Booking a new appointment.
 *
 * THE CLIENT SENDS AN INSTANT, NOT A DAY AND A TIME. The slot list it chose from was
 * returned as instants by the availability endpoint, so sending one back is sending the
 * slot that was offered. A day plus a wall-clock time would have to be converted again, by a
 * second implementation of the zone arithmetic, and the two would eventually disagree.
 *
 * THERE IS NO `endAt`. The end is the service's duration from the start, computed by the
 * server. A client-supplied end is a client-supplied appointment length, which is how a
 * 30-minute consultation becomes a 5-minute one that blocks nothing.
 */
/**
 * THERE IS NO `notes` FIELD, although the prototype's booking form has one.
 *
 * `appointments` has no notes column, so a field here would be accepted and silently
 * dropped, which is worse than not offering it: a receptionist would type a note, see the
 * booking succeed, and never see the note again. Adding the column is an additive migration
 * awaiting sign-off, recorded in `docs/features/clinic-dashboard.md`.
 */
export const createAppointmentSchema = z.object({
  patientId: z.uuid(),
  doctorId: z.uuid(),
  serviceId: z.uuid(),
  startAt: instant,
});

export type CreateAppointmentInput = z.infer<typeof createAppointmentSchema>;

/** Moving an appointment to another time, which may also change the service or doctor. */
export const rescheduleAppointmentSchema = z.object({
  startAt: instant,
  doctorId: z.uuid().optional(),
  serviceId: z.uuid().optional(),
  reason: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(500).nullable(),
  ),
});

export type RescheduleAppointmentInput = z.infer<typeof rescheduleAppointmentSchema>;

export const cancelAppointmentSchema = z.object({
  /**
   * Free text, and it is NOT patient data by intention.
   *
   * "Patient called to cancel" is a reason; a symptom is not. The field is bounded and the
   * API never logs it, which is the control, because no schema can stop someone typing a
   * diagnosis into a text box.
   */
  reason: z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(500).nullable(),
  ),
});

export type CancelAppointmentInput = z.infer<typeof cancelAppointmentSchema>;

export const changeAppointmentStatusSchema = z.object({
  status: z.enum(APPOINTMENT_STATUSES),
});

export type ChangeAppointmentStatusInput = z.infer<typeof changeAppointmentStatusSchema>;

/**
 * There is no general-purpose appointment update, because there is nothing to update.
 *
 * The time moves through `reschedule`, the status through its own transition, and the only
 * other field the prototype shows is the notes column that does not exist yet. An
 * `updateAppointmentSchema` with no fields in it would be a contract that cannot be
 * satisfied, so it is absent until the column lands.
 */

/** The agenda's three shapes. A week starts on Monday, matching the clinic's own week. */
export const AGENDA_RANGES = ['day', 'week', 'month'] as const;

export type AgendaRange = (typeof AGENDA_RANGES)[number];

export const agendaQuerySchema = z.object({
  range: z.enum(AGENDA_RANGES),
  /** The day the range is anchored on: the day itself, a day in the week, or in the month. */
  on: clinicDay,
  doctorId: z.uuid().optional(),
});

export type AgendaQuery = z.infer<typeof agendaQuerySchema>;

export const availabilityQuerySchema = z.object({
  doctorId: z.uuid(),
  serviceId: z.uuid(),
  date: clinicDay,
});

export type AvailabilityQuery = z.infer<typeof availabilityQuerySchema>;
