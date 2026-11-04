import type { CallStatus, CallView } from '@clinicai/api-client';
import type { BadgeKind } from '../../components/ui/Table';

/**
 * How a call is described, in one place.
 *
 * ─── THE PROTOTYPE'S COLUMNS ARE NOT THE API'S FIELDS ───────────────────────────
 *
 * `docs/prototype/laptop-14-calls-list.png` shows CALL TYPE (New patient, Reschedule,
 * Cancellation, General enquiry) and OUTCOME (Booked, Updated, Resolved, Follow-up). The
 * platform has neither of those vocabularies:
 *
 *   - what it has is DIRECTION (inbound or outbound) and STATUS (how the call ended)
 *   - `calls.outcome` exists as an enum (BOOKED, RESCHEDULED, CANCELLED, INFORMATION,
 *     TRANSFERRED, NONE) and NOTHING WRITES IT YET. Deciding that a call resulted in a
 *     booking means reading what the agent did during it, which is the outcome work that
 *     has not landed. So it is shown when it is set and reads "Not classified" when it is
 *     not, rather than being guessed from the status.
 *
 * Inventing a call type from the transcript is exactly the sort of inference this product
 * must not make quietly: "New patient" on a call where the agent could not place the caller
 * would be a fact the clinic would act on.
 */

export const statusLabel = (status: CallStatus): string => {
  switch (status) {
    case 'RINGING':
      return 'Ringing';
    case 'IN_PROGRESS':
      return 'In progress';
    case 'COMPLETED':
      return 'Completed';
    case 'MISSED':
      return 'Missed';
    case 'ABANDONED':
      return 'Abandoned';
    case 'FAILED':
      return 'Failed';
  }
};

/**
 * Colour reinforces the text and never replaces it.
 *
 * A missed call is the one a clinic has to act on, so it is the one that is marked. Nothing
 * here is RED for an ordinary completed call: a call history is a log, not a list of
 * problems.
 */
export const statusBadge = (status: CallStatus): BadgeKind => {
  switch (status) {
    case 'COMPLETED':
      return 'success';
    case 'IN_PROGRESS':
    case 'RINGING':
      // Neutral rather than a colour of its own: the badge vocabulary is four kinds, and a
      // call in progress is a state that resolves on its own in a minute.
      return 'neutral';
    case 'MISSED':
      return 'warning';
    case 'ABANDONED':
    case 'FAILED':
      return 'danger';
  }
};

export const outcomeLabel = (outcome: string): string => {
  switch (outcome) {
    case 'BOOKED':
      return 'Booked';
    case 'RESCHEDULED':
      return 'Rescheduled';
    case 'CANCELLED':
      return 'Cancelled';
    case 'INFORMATION':
      return 'Information';
    case 'TRANSFERRED':
      return 'Transferred';
    default:
      // `NONE` is the default on every row today. Said plainly, because "none" reads as
      // "nothing came of the call" and what is true is that nobody has classified it.
      return 'Not classified';
  }
};

export const directionLabel = (direction: CallView['direction']): string =>
  direction === 'INBOUND' ? 'Incoming' : 'Outgoing';

/** `4m 18s`, as the prototype's duration column reads. */
export const durationLabel = (seconds: number | null): string => {
  if (seconds === null) {
    return '—';
  }

  const minutes = Math.floor(seconds / 60);
  const remainder = seconds % 60;

  return minutes === 0
    ? `${String(remainder)}s`
    : `${String(minutes)}m ${String(remainder).padStart(2, '0')}s`;
};

/** The caller, as a clinic reads one: their name if we know it, else their number. */
export const callerLabel = (call: CallView): string =>
  call.patient?.fullName ?? (call.fromE164 === null ? 'Number hidden' : call.fromE164);
