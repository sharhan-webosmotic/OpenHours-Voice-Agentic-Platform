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
      title={appointment.patient.fullName ?? 'Name hidden'}
      onClose={onClose}
    >
      {/*
       * The reference's highlighted card: a 56px date tile in the accent, the service, the
       * clinic's date and 24-hour time, and the status, on the accent's own pale tint.
       */}
      <div className="flex items-start gap-4 rounded-2xl bg-accent-surface p-[18px]">
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

      {problem !== undefined && (
        <div className="mt-4">
          <Alert kind="danger">{problem}</Alert>
        </div>
      )}

      {canWrite && (
        <div className="mt-6 flex flex-col gap-2.5">
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
            <button
              type="button"
              disabled={busy}
              onClick={onReschedule}
              className="h-10 w-full rounded-control border border-border-chrome bg-surface font-semibold text-default text-sm hover:bg-background disabled:opacity-60"
            >
              Edit or reschedule
            </button>
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
              <button
                type="button"
                disabled={busy}
                onClick={() => {
                  setConfirming(true);
                }}
                className="h-10 w-full rounded-control border border-danger/20 bg-danger-surface font-semibold text-danger text-sm hover:border-danger/40 disabled:opacity-60"
              >
                Cancel appointment
              </button>
            ))}
        </div>
      )}
    </Overlay>
  );
};
