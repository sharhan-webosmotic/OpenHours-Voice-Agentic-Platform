import { useEffect, useState } from 'react';
import type { AppointmentView } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Overlay } from '../../components/ui/Overlay';
import { Spinner } from '../../components/ui/Spinner';
import { TextAreaField } from '../../components/ui/Input';
import { DateInput } from '../../components/ui/Toolbar';
import { cn } from '../../components/ui/cn';
import { errorMessage } from '../../lib/problem';
import { clinicDay, clinicToday, formatDateTime } from '../../lib/clinicTime';
import { useAvailabilityQuery, useRescheduleMutation } from './api';

/**
 * Moving an appointment to another time.
 *
 * The prototype reaches this through "Edit or reschedule" in the detail drawer, which
 * reopens the booking wizard with the appointment's values. This is that wizard reduced to
 * the one step that can actually change: the patient, the service and the doctor are the
 * same appointment, so offering them again would invite a receptionist to change three
 * things while meaning to change one.
 *
 * THE OLD TIME IS STILL OFFERED, and that is not a bug. The server excludes the appointment
 * being moved from its own availability check, so 09:00 to 09:15 is a legitimate reschedule;
 * without the exclusion the appointment would block its own new time and the clinic would be
 * told the slot was taken by itself.
 *
 * A RESCHEDULE MAKES A NEW APPOINTMENT and cancels this one, which the API does in one
 * transaction and the wording here reflects: the patient's history keeps both rows.
 */

export const RescheduleForm = ({
  appointment,
  timeZone,
  onClose,
  onMoved,
}: {
  readonly appointment: AppointmentView;
  readonly timeZone: string;
  readonly onClose: () => void;
  readonly onMoved?: ((appointmentId: string) => void) | undefined;
}) => {
  const [reschedule, moving] = useRescheduleMutation();

  const [date, setDate] = useState(() => clinicDay(appointment.startAt, timeZone));
  const [startAt, setStartAt] = useState('');
  const [reason, setReason] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);

  useEffect(() => {
    // A new day means the chosen time no longer exists.
    setStartAt('');
  }, [date]);

  const availability = useAvailabilityQuery(
    {
      doctorId: appointment.doctor.id,
      serviceId: appointment.service?.id ?? '',
      date,
    },
    { skip: appointment.service === null || date === '' },
  );

  /** Re-reads the slot list, but only if it was ever read. `refetch` throws otherwise. */
  const refreshTimes = (): void => {
    if (!availability.isUninitialized) {
      void availability.refetch();
    }
  };

  const submit = async (): Promise<void> => {
    if (startAt === '') {
      setProblem('Choose a new time.');
      return;
    }

    setProblem(undefined);

    try {
      const result = await reschedule({
        appointmentId: appointment.id,
        input: { startAt, reason: reason.trim() === '' ? null : reason.trim() },
      }).unwrap();

      onMoved?.(result.appointmentId);
      onClose();
    } catch (error) {
      setProblem(errorMessage(error, 'The appointment was not moved.'));
      refreshTimes();
    }
  };

  return (
    <Overlay
      eyebrow="EDIT APPOINTMENT"
      title="Reschedule appointment"
      onClose={onClose}
      footer={
        <>
          <Button kind="secondary" onClick={onClose} disabled={moving.isLoading}>
            Cancel
          </Button>
          <Button
            loading={moving.isLoading}
            onClick={() => {
              void submit();
            }}
          >
            Move appointment
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="rounded-lg border border-border bg-background p-4">
          <p className="m-0 text-muted text-xs">
            Currently {formatDateTime(appointment.startAt, timeZone)} with{' '}
            {appointment.doctor.fullName}.
          </p>
        </div>

        {appointment.service === null ? (
          <Alert kind="warning">
            This appointment has no service recorded, so no times can be offered for it.
          </Alert>
        ) : (
          <>
            <DateInput
              label="New date"
              value={date}
              min={clinicToday(timeZone)}
              onChange={setDate}
            />

            <div className="flex flex-col gap-2">
              <span className="font-semibold text-[0.6875rem] text-muted uppercase">
                Available times
              </span>

              {availability.isFetching && <Spinner />}

              {availability.data !== undefined && availability.data.slots.length > 0 && (
                <div className="flex flex-wrap gap-2">
                  {availability.data.slots.map((slot) => (
                    <button
                      key={slot.startAt}
                      type="button"
                      aria-pressed={startAt === slot.startAt}
                      onClick={() => {
                        setStartAt(slot.startAt);
                      }}
                      className={cn(
                        'h-9 rounded-md border px-3 font-semibold text-xs',
                        startAt === slot.startAt
                          ? 'border-accent bg-accent text-on-accent'
                          : 'border-border bg-surface text-default hover:bg-background',
                      )}
                    >
                      {slot.label}
                    </button>
                  ))}
                </div>
              )}

              {availability.data !== undefined && availability.data.slots.length === 0 && (
                <Alert kind="warning">No times are available that day.</Alert>
              )}
            </div>

            <TextAreaField
              label="Reason"
              hint="Optional, and kept on the cancelled row so the history explains itself."
              rows={2}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
              }}
            />
          </>
        )}

        {problem !== undefined && <Alert kind="danger">{problem}</Alert>}
      </div>
    </Overlay>
  );
};
