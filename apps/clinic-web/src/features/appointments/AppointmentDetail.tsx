import { useState } from 'react';
import { Check, UserX } from 'lucide-react';
import type { AppointmentView } from '@clinicai/api-client';
import { canTransition } from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Overlay } from '../../components/ui/Overlay';
import { Badge } from '../../components/ui/Table';
import { cn } from '../../components/ui/cn';
import { TextAreaField } from '../../components/ui/Input';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import { formatIsoDay, formatTime24 } from '../../lib/clinicTime';
import { useCancelMutation, useChangeStatusMutation } from './api';
import { sourceLabel, statusBadge, statusLabel } from './status';

/**
 * One appointment, in the drawer from `docs/prototype/state-34-appointment-detail.png`.
 *
 * The capture's structure is kept: the patient's name as the title, a highlighted card with
 * the date chip, service and status, then the detail rows, then the actions stacked at full
 * width with the destructive one last.
 *
 * ─── A DEVIATION, FROM SOMETHING THE SCHEMA DOES NOT HAVE ───────────────────────
 *
 * NO EMAIL under "Patient contact". There is no email column on `patients`.
 *
 * The notes row the capture shows is here: the column was added with the clinic's approval
 * on 2026-11-03. It appears only when a note was written, so an appointment booked without
 * one does not carry a row saying "no notes".
 *
 * ─── WHICH ACTIONS APPEAR, AND WHY IT IS THE SHARED TABLE THAT DECIDES ──────────
 *
 * `canTransition` comes from `@clinicai/shared`, the same table the API enforces. A screen
 * that offered "Mark as completed" on a cancelled appointment would be asking the server a
 * question it is going to refuse, and the user would read the refusal as a bug. The buttons
 * are what the table permits, and nothing here restates the rules.
 *
 * ─── EACH ACTION WHERE IT BELONGS, AND ONLY WHEN IT MAKES SENSE ─────────────────
 *
 * The first version stacked every permitted move as an identical full-width button, so a
 * routine reschedule, a one-off confirmation and an irreversible cancellation all looked
 * the same, and "Mark as completed" was offered for a visit next week. Now:
 *
 *   - the footer holds the two everyday actions, Edit or reschedule as the primary on the
 *     right and Cancel as a quieter red text button on the left, set apart from the safe one
 *   - confirming is a callout in the body, shown only while the booking awaits it
 *   - the visit's outcome, completed or no-show, is a compact pair shown only once the
 *     visit's start time has passed. The shared table would allow it earlier, but recording
 *     that a patient attended an appointment that has not happened is not a thing to offer
 */

export const AppointmentDetail = ({
  appointment,
  timeZone,
  onClose,
  onReschedule,
  now = new Date(),
}: {
  readonly appointment: AppointmentView;
  readonly timeZone: string;
  readonly onClose: () => void;
  readonly onReschedule: () => void;
  /** The moment the drawer judges "has this visit started" against. A prop, for tests. */
  readonly now?: Date | undefined;
}) => {
  const canWrite = useCan('appointments', 'write');
  const [cancel, cancelling] = useCancelMutation();
  const [changeStatus, changing] = useChangeStatusMutation();

  const [confirming, setConfirming] = useState(false);
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);

  const busy = cancelling.isLoading || changing.isLoading;

  const act = async (action: () => Promise<unknown>): Promise<void> => {
    setProblem(undefined);

    try {
      await action();
      onClose();
    } catch (error) {
      /**
       * The drawer stays OPEN on failure, showing why.
       *
       * A 409 here means somebody else moved this appointment while it was on screen, and
       * closing the panel would leave the user with no idea what happened to their click.
       */
      setProblem(errorMessage(error, 'That did not work. Reload and try again.'));
    }
  };

  const offersCompleted = canTransition(appointment.status, 'COMPLETED');
  const offersNoShow = canTransition(appointment.status, 'NO_SHOW');
  const offersCancel = canWrite && canTransition(appointment.status, 'CANCELLED');
  const started = new Date(appointment.startAt).getTime() <= now.getTime();

  /**
   * The pinned footer: the everyday actions, the destructive one on the far side of the safe
   * one so a hurried click lands on the right thing. While a cancellation is being
   * confirmed, the footer IS that confirmation.
   */
  const footer = !offersCancel ? undefined : confirming ? (
    <>
      <Button
        kind="secondary"
        disabled={busy}
        onClick={() => {
          setConfirming(false);
        }}
      >
        Keep appointment
      </Button>
      <Button
        kind="danger"
        loading={cancelling.isLoading}
        onClick={() => {
          void act(() =>
            cancel({
              appointmentId: appointment.id,
              input: { reason: reason.trim() === '' ? null : reason.trim() },
            }).unwrap(),
          );
        }}
      >
        Confirm cancellation
      </Button>
    </>
  ) : (
    <>
      <button
        type="button"
        disabled={busy}
        onClick={() => {
          setConfirming(true);
        }}
        className="mr-auto rounded-control px-3 py-2 font-semibold text-danger text-sm hover:bg-danger-surface disabled:opacity-60"
      >
        Cancel appointment
      </button>
      <Button disabled={busy} onClick={onReschedule}>
        Edit or reschedule
      </Button>
    </>
  );

  const isoDay = formatIsoDay(appointment.startAt, timeZone);
  const dayOfMonth = Number(isoDay.slice(-2));
  const month = new Intl.DateTimeFormat('en-GB', { month: 'short', timeZone }).format(
    new Date(appointment.startAt),
  );

  return (
    <Overlay
      variant="drawer"
      size="wide"
      eyebrow="APPOINTMENT DETAILS"
      footer={footer}
      title={appointment.patient.fullName ?? 'Name hidden'}
      onClose={onClose}
    >
      {/*
       * The reference's highlighted card: a 56px date tile in the accent, the service, the
       * clinic's date and 24-hour time, and the status, on the accent's own pale tint.
       */}
      <div className="flex items-start gap-4 rounded-card bg-accent-surface p-[18px]">
        <span
          className="flex size-14 shrink-0 flex-col items-center justify-center rounded-xl bg-accent text-inverse shadow-accent"
          aria-hidden="true"
        >
          <span className="font-bold text-[1.375rem] leading-none">{dayOfMonth}</span>
          <span className="mt-1 font-semibold text-[0.6875rem] uppercase leading-none">
            {month}
          </span>
        </span>

        <span className="flex flex-col gap-1.5">
          <strong className="font-medium text-default text-md">
            {appointment.service?.name ?? 'No service recorded'}
          </strong>
          <small className="text-muted text-xs">
            {isoDay} · {formatTime24(appointment.startAt, timeZone)}
          </small>
          <span>
            <Badge kind={statusBadge(appointment.status, appointment.source)}>
              {statusLabel(appointment.status, appointment.source)}
            </Badge>
          </span>
        </span>
      </div>

      <dl className="m-0 mt-3 flex flex-col">
        {[
          ['Patient contact', appointment.patient.phone ?? 'Hidden'],
          ['Assigned doctor', appointment.doctor.fullName],
          [
            'Duration',
            appointment.service === null
              ? '—'
              : `${String(appointment.service.durationMinutes)} minutes`,
          ],
          ['Booking source', sourceLabel(appointment.source)],
          ...(appointment.cancellationReason === null
            ? []
            : [['Cancellation reason', appointment.cancellationReason] as const]),
          ...(appointment.notes === null ? [] : [['Notes', appointment.notes] as const]),
        ].map(([label, value]) => (
          /*
           * A fixed label column with the value beside it, left-aligned, as the reference
           * lays the rows out: a long note then wraps under itself rather than across.
           */
          <div
            key={label}
            className="grid grid-cols-[135px_minmax(0,1fr)] gap-4 border-border-chrome border-b py-4"
          >
            <dt className="text-muted text-xs uppercase tracking-[0.4px]">{label}</dt>
            <dd className="m-0 whitespace-pre-line break-words font-semibold text-default text-[0.8125rem]">
              {value}
            </dd>
          </div>
        ))}
      </dl>

      {canWrite &&
        !confirming &&
        appointment.status === 'SCHEDULED' &&
        canTransition('SCHEDULED', 'CONFIRMED') && (
          <div
            className={cn(
              'mt-5 flex items-center justify-between gap-4 rounded-lg border px-4 py-3.5',
              appointment.source === 'VOICE_AGENT'
                ? 'border-accent/20 bg-accent-surface'
                : 'border-warning/25 bg-warning-surface',
            )}
          >
            <div className="flex flex-col gap-0.5">
              <strong className="font-semibold text-default text-sm">Awaiting confirmation</strong>
              <span className="text-muted text-xs">
                {appointment.source === 'VOICE_AGENT'
                  ? 'Booked by the AI receptionist. Confirm once the clinic is happy with it.'
                  : 'Confirm once the time is agreed with the patient.'}
              </span>
            </div>
            <div className="shrink-0 whitespace-nowrap">
              <Button
                loading={changing.isLoading}
                disabled={busy}
                onClick={() => {
                  void act(() =>
                    changeStatus({ appointmentId: appointment.id, status: 'CONFIRMED' }).unwrap(),
                  );
                }}
              >
                Confirm appointment
              </Button>
            </div>
          </div>
        )}

      {canWrite && !confirming && started && (offersCompleted || offersNoShow) && (
        <section className="mt-6" aria-labelledby="visit-outcome">
          <h3
            id="visit-outcome"
            className="m-0 mb-2.5 font-normal text-muted text-xs uppercase tracking-[0.4px]"
          >
            Visit outcome
          </h3>
          <div className="grid grid-cols-2 gap-2.5">
            {offersCompleted && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void act(() =>
                    changeStatus({ appointmentId: appointment.id, status: 'COMPLETED' }).unwrap(),
                  );
                }}
                className="flex h-10 items-center justify-center gap-2 rounded-control border border-border-chrome bg-surface font-semibold text-default text-sm hover:border-success/40 hover:bg-success-surface disabled:opacity-60"
              >
                <Check size={16} aria-hidden="true" className="text-success" />
                Mark as completed
              </button>
            )}
            {offersNoShow && (
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  void act(() =>
                    changeStatus({ appointmentId: appointment.id, status: 'NO_SHOW' }).unwrap(),
                  );
                }}
                className="flex h-10 items-center justify-center gap-2 rounded-control border border-border-chrome bg-surface font-semibold text-default text-sm hover:border-danger/30 hover:bg-danger-surface disabled:opacity-60"
              >
                <UserX size={16} aria-hidden="true" className="text-danger" />
                Mark as no show
              </button>
            )}
          </div>
        </section>
      )}

      {confirming && (
        /**
         * THE CONFIRMATION IS INLINE, not a second dialog. A dialog on top of a drawer is two
         * overlays deep and a keyboard user has to escape twice. Its two buttons are in the
         * footer, where the action that opened it was.
         */
        <div className="mt-6 flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-surface p-4">
          <strong className="font-semibold text-danger text-sm">Cancel this appointment?</strong>
          <p className="m-0 text-muted text-xs">
            The record stays in the patient&apos;s history and the slot becomes available again.
          </p>
          <TextAreaField
            label="Reason"
            hint="Optional, and read by the clinic rather than the patient. Not a clinical note."
            rows={2}
            value={reason}
            onChange={(event) => {
              setReason(event.target.value);
            }}
          />
        </div>
      )}

      {problem !== undefined && (
        <div className="mt-4">
          <Alert kind="danger">{problem}</Alert>
        </div>
      )}
    </Overlay>
  );
};
