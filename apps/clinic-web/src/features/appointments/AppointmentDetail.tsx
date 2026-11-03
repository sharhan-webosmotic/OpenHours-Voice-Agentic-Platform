import { useState } from 'react';
import type { AppointmentView } from '@clinicai/api-client';
import { canTransition } from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Overlay } from '../../components/ui/Overlay';
import { Badge } from '../../components/ui/Table';
import { TextAreaField } from '../../components/ui/Input';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import { formatDate, formatDuration, formatTime } from '../../lib/clinicTime';
import { useCancelMutation, useChangeStatusMutation } from './api';
import { sourceLabel, statusBadge, statusLabel } from './status';

/**
 * One appointment, in the drawer from `docs/prototype/state-34-appointment-detail.png`.
 *
 * The capture's structure is kept: the patient's name as the title, a highlighted card with
 * the date chip, service and status, then the detail rows, then the actions stacked at full
 * width with the destructive one last.
 *
 * ─── DEVIATIONS, BOTH FROM THINGS THE SCHEMA DOES NOT HAVE ──────────────────────
 *
 * 1. NO EMAIL under "Patient contact". There is no email column on `patients`.
 * 2. NO NOTES ROW. There is no notes column on `appointments`, and a row saying "no notes"
 *    for every appointment ever booked would be worse than the row not being there. Both
 *    wait on the same additive migration.
 *
 * ─── WHICH ACTIONS APPEAR, AND WHY IT IS THE SHARED TABLE THAT DECIDES ──────────
 *
 * `canTransition` comes from `@clinicai/shared`, the same table the API enforces. A screen
 * that offered "Mark as completed" on a cancelled appointment would be asking the server a
 * question it is going to refuse, and the user would read the refusal as a bug. The buttons
 * are what the table permits, and nothing here restates the rules.
 */

export const AppointmentDetail = ({
  appointment,
  timeZone,
  onClose,
  onReschedule,
}: {
  readonly appointment: AppointmentView;
  readonly timeZone: string;
  readonly onClose: () => void;
  readonly onReschedule: () => void;
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

  const [day, month] = formatDate(appointment.startAt, timeZone).split(' ');

  return (
    <Overlay
      variant="drawer"
      eyebrow="APPOINTMENT DETAILS"
      title={appointment.patient.fullName ?? 'Name hidden'}
      onClose={onClose}
    >
      <div className="flex items-center gap-4 rounded-xl bg-accent-surface p-4">
        <span
          className="flex size-14 shrink-0 flex-col items-center justify-center rounded-lg bg-accent font-semibold text-inverse"
          aria-hidden="true"
        >
          <span className="text-md leading-none">{day}</span>
          <span className="text-[0.625rem] uppercase">{month}</span>
        </span>

        <span className="flex flex-col gap-1">
          <strong className="font-semibold text-default text-md">
            {appointment.service?.name ?? 'No service recorded'}
          </strong>
          <small className="text-muted text-xs">
            {formatDate(appointment.startAt, timeZone)} ·{' '}
            {formatTime(appointment.startAt, timeZone)}
          </small>
          <span>
            <Badge kind={statusBadge(appointment.status)}>
              {statusLabel(appointment.status, appointment.source)}
            </Badge>
          </span>
        </span>
      </div>

      <dl className="m-0 mt-5 flex flex-col">
        {[
          ['Patient contact', appointment.patient.phone ?? 'Hidden'],
          ['Assigned doctor', appointment.doctor.fullName],
          [
            'Duration',
            appointment.service === null
              ? '—'
              : formatDuration(appointment.service.durationMinutes),
          ],
          ['Booking source', sourceLabel(appointment.source)],
          ...(appointment.cancellationReason === null
            ? []
            : [['Cancellation reason', appointment.cancellationReason] as const]),
        ].map(([label, value]) => (
          <div
            key={label}
            className="flex items-baseline justify-between gap-6 border-border border-b py-3 last:border-b-0"
          >
            <dt className="font-semibold text-[0.6875rem] text-muted uppercase">{label}</dt>
            <dd className="m-0 text-right font-semibold text-default text-xs">{value}</dd>
          </div>
        ))}
      </dl>

      {problem !== undefined && (
        <div className="mt-4">
          <Alert kind="danger">{problem}</Alert>
        </div>
      )}

      {canWrite && (
        <div className="mt-6 flex flex-col gap-2">
          {canTransition(appointment.status, 'CONFIRMED') && (
            <Button
              loading={changing.isLoading}
              onClick={() => {
                void act(() =>
                  changeStatus({ appointmentId: appointment.id, status: 'CONFIRMED' }).unwrap(),
                );
              }}
            >
              Confirm appointment
            </Button>
          )}

          {canTransition(appointment.status, 'COMPLETED') && (
            <Button
              kind="secondary"
              disabled={busy}
              onClick={() => {
                void act(() =>
                  changeStatus({ appointmentId: appointment.id, status: 'COMPLETED' }).unwrap(),
                );
              }}
            >
              Mark as completed
            </Button>
          )}

          {canTransition(appointment.status, 'NO_SHOW') && (
            <Button
              kind="secondary"
              disabled={busy}
              onClick={() => {
                void act(() =>
                  changeStatus({ appointmentId: appointment.id, status: 'NO_SHOW' }).unwrap(),
                );
              }}
            >
              Mark as no show
            </Button>
          )}

          {canTransition(appointment.status, 'CANCELLED') && (
            <Button kind="secondary" disabled={busy} onClick={onReschedule}>
              Edit or reschedule
            </Button>
          )}

          {canTransition(appointment.status, 'CANCELLED') &&
            (confirming ? (
              /**
               * THE CONFIRMATION IS INLINE, as the prototype has it, not a second dialog.
               *
               * A dialog on top of a drawer is two overlays deep and a keyboard user has to
               * escape twice. The reason box sits where the button was.
               */
              <div className="flex flex-col gap-3 rounded-lg border border-danger/30 bg-danger-surface p-4">
                <strong className="font-semibold text-danger text-xs">
                  Cancel this appointment?
                </strong>
                <p className="m-0 text-muted text-xs">
                  The record stays in the patient&apos;s history and the slot becomes available
                  again.
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

                <div className="flex items-center gap-2">
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
                </div>
              </div>
            ) : (
              <Button
                kind="danger"
                disabled={busy}
                onClick={() => {
                  setConfirming(true);
                }}
              >
                Cancel appointment
              </Button>
            ))}
        </div>
      )}
    </Overlay>
  );
};
