import type { AppointmentSource, AppointmentStatus } from '@clinicai/shared';
import type { BadgeKind } from '../../components/ui/Table';

/**
 * How an appointment's status is shown, in one place.
 *
 * ─── THE PROTOTYPE'S LABELS ARE NOT THE API'S STATUSES, AND THAT IS DELIBERATE ──
 *
 * The prototype shows "AI Booking" as though it were a status. It is not: it is the SOURCE
 * of a booking whose status is `SCHEDULED`, and conflating them would mean an appointment
 * stopped being an AI booking the moment somebody confirmed it. So the label is derived from
 * both fields, which keeps the prototype's wording and the API's model intact:
 *
 *   SCHEDULED + VOICE_AGENT  ->  "AI Booking"
 *   SCHEDULED + anything else ->  "Pending"
 *   CONFIRMED                 ->  "Confirmed"
 *   COMPLETED                 ->  "Completed"
 *   CANCELLED                 ->  "Cancelled"
 *   NO_SHOW                   ->  "No show"
 *
 * The prototype's "Reschedule Requested" has no equivalent and is not shown: nothing in the
 * platform can produce it, because a reschedule is a request a patient makes to the agent
 * and the agent either moves the appointment or does not.
 *
 * COLOUR ONLY REINFORCES THE TEXT. Every badge says what it means in words, because a green
 * dot and a red dot are the same dot to a colour-blind reader, and the status of a clinical
 * appointment is not something to guess at.
 */

export const statusLabel = (status: AppointmentStatus, source: AppointmentSource): string => {
  switch (status) {
    case 'SCHEDULED':
      return source === 'VOICE_AGENT' ? 'AI Booking' : 'Pending';
    case 'CONFIRMED':
      return 'Confirmed';
    case 'COMPLETED':
      return 'Completed';
    case 'CANCELLED':
      return 'Cancelled';
    case 'NO_SHOW':
      return 'No show';
  }
};

export const statusBadge = (status: AppointmentStatus): BadgeKind => {
  switch (status) {
    case 'CONFIRMED':
    case 'COMPLETED':
      return 'success';
    case 'SCHEDULED':
      return 'warning';
    case 'CANCELLED':
    case 'NO_SHOW':
      return 'danger';
  }
};

/** Where a booking came from, for the detail panel's "Booking source" row. */
export const sourceLabel = (source: AppointmentSource): string => {
  switch (source) {
    case 'VOICE_AGENT':
      return 'AI receptionist';
    case 'DASHBOARD':
      return 'Clinic dashboard';
    case 'IMPORT':
      return 'Imported';
  }
};
