import { useEffect, useMemo, useState } from 'react';
import type { AvailabilityReason, ServiceView } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Overlay } from '../../components/ui/Overlay';
import { SelectField } from '../../components/ui/Input';
import { DateInput } from '../../components/ui/Toolbar';
import { Spinner } from '../../components/ui/Spinner';
import { cn } from '../../components/ui/cn';
import { errorMessage } from '../../lib/problem';
import { clinicToday, formatDate, formatDuration, formatMoney } from '../../lib/clinicTime';
import { useClinic } from '../clinic/api';
import { usePatientsQuery } from '../patients/api';
import { PatientForm } from '../patients/PatientForm';
import { useAvailabilityQuery, useBookMutation } from './api';

/**
 * Booking an appointment: the four-step wizard from the prototype's captures
 * (`state-30` to `state-33`).
 *
 * The steps, their labels and their order are the prototype's: Patient, Service, Date and
 * time, Review. So is the behaviour that each step refuses to advance until it has what it
 * needs, with the message shown under the fields rather than beside them.
 *
 * ─── THE SLOT LIST IS THE SERVER'S, AND THAT IS THE WHOLE POINT OF STEP THREE ────
 *
 * Nothing here works out which times are free. The availability endpoint applies the opening
 * hours, the doctor's working hours, time off, the service duration, the booking policy and
 * the appointments already in the book, and returns instants. The form offers what it was
 * given and sends one back, so there is no second implementation of those rules to disagree
 * with the first.
 *
 * ─── WHY AN EMPTY DAY SAYS WHY ──────────────────────────────────────────────────
 *
 * `reason` turns "no slots" into something a receptionist can act on: the clinic is closed
 * that day, the doctor is not working, the date is beyond how far ahead this clinic books.
 * The prototype shows one sentence for all of them, which is the one thing here that is
 * better than the capture rather than the same as it.
 *
 * ─── IDEMPOTENCY ────────────────────────────────────────────────────────────────
 *
 * One key is minted when the form opens and sent with every attempt, so a double-clicked
 * button or a retried request returns the original booking rather than making a second one
 * (root CLAUDE.md rule 8). It is deliberately NOT regenerated between attempts: that would
 * make the retry a new booking, which is the bug the header exists to prevent.
 */

const STEPS = ['Patient', 'Service', 'Date & time', 'Review'] as const;

const NO_SLOTS: Record<AvailabilityReason, string> = {
  HOURS_NOT_COLLECTED:
    "This clinic's opening hours have not been recorded yet, so no times can be offered.",
  DAY_IN_THE_PAST: 'That date has already passed.',
  BEYOND_MAXIMUM_ADVANCE: 'That date is further ahead than this clinic takes bookings.',
  CLINIC_CLOSED: 'The clinic is closed that day.',
  DOCTOR_NOT_WORKING: 'The doctor is not working that day.',
  FULLY_BOOKED: 'Every time that day is taken.',
};

export const BookingForm = ({
  initialPatientId,
  onClose,
  onBooked,
}: {
  readonly initialPatientId?: string | undefined;
  readonly onClose: () => void;
  readonly onBooked?: ((appointmentId: string) => void) | undefined;
}) => {
  const { data: clinic, isLoading: clinicLoading } = useClinic();
  const [book, booking] = useBookMutation();

  const timeZone = clinic?.organisation.timezone ?? 'UTC';

  const [step, setStep] = useState(1);
  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState('');
  const [startAt, setStartAt] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [addingPatient, setAddingPatient] = useState(false);

  /**
   * Minted once per open, and kept across attempts. See the note above.
   *
   * `crypto.randomUUID` rather than a counter or a timestamp: two receptionists booking at
   * the same moment must not share a key, because the second one's booking would come back
   * as a replay of the first one's.
   */
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const { data: patients } = usePatientsQuery({ limit: 100 });

  const services = useMemo(
    () => (clinic?.services ?? []).filter((service) => service.active),
    [clinic],
  );

  /**
   * THE PILOT HAS ONE DOCTOR, so there is no doctor step. The id still has to be chosen,
   * and it is the clinic's only active doctor. A clinic with two would need a step here,
   * which is the recorded deviation.
   */
  const doctor = (clinic?.doctors ?? []).find((candidate) => candidate.active);

  useEffect(() => {
    // Default to today on the clinic's calendar, once the time zone is known.
    if (date === '' && clinic !== undefined) {
      setDate(clinicToday(timeZone));
    }
  }, [clinic, date, timeZone]);

  const availability = useAvailabilityQuery(
    {
      doctorId: doctor?.id ?? '',
      serviceId,
      date,
    },
    { skip: step !== 3 || doctor === undefined || serviceId === '' || date === '' },
  );

  const selectedService: ServiceView | undefined = services.find(
    (service) => service.id === serviceId,
  );
  const selectedPatient = patients?.items.find((patient) => patient.id === patientId);

  const next = (): void => {
    if (step === 1 && patientId === '') {
      setProblem('Select a patient to continue.');
      return;
    }
    if (step === 2 && serviceId === '') {
      setProblem('Select a service.');
      return;
    }
    if (step === 3 && startAt === '') {
      setProblem('Choose an available time.');
      return;
    }

    setProblem(undefined);
    setStep((current) => Math.min(STEPS.length, current + 1));
  };

  const confirm = async (): Promise<void> => {
    if (doctor === undefined) {
      setProblem('This clinic has no active doctor, so nothing can be booked yet.');
      return;
    }

    setProblem(undefined);

    try {
      const result = await book({
        input: { patientId, doctorId: doctor.id, serviceId, startAt },
        idempotencyKey,
      }).unwrap();

      onBooked?.(result.appointmentId);
      onClose();
    } catch (error) {
      /**
       * A 409 here is the ordinary case, not a crash: the slot was taken between the list
       * being drawn and this click. The message says so and the user stays on the step with
       * a refreshed list rather than being dropped back to the start.
       */
      setProblem(errorMessage(error, 'The appointment was not booked.'));
      setStep(3);
      void availability.refetch();
    }
  };

  return (
    <>
      <Overlay
        eyebrow="NEW APPOINTMENT"
        title={doctor === undefined ? 'Book an appointment' : `Book with ${doctor.fullName}`}
        onClose={onClose}
        footer={
          <>
            <Button
              kind="secondary"
              onClick={() => {
                if (step === 1) {
                  onClose();
                  return;
                }
                setProblem(undefined);
                setStep(step - 1);
              }}
              disabled={booking.isLoading}
            >
              {step === 1 ? 'Cancel' : 'Back'}
            </Button>

            {step < STEPS.length ? (
              <Button onClick={next}>Continue</Button>
            ) : (
              <Button
                loading={booking.isLoading}
                onClick={() => {
                  void confirm();
                }}
              >
                Confirm appointment
              </Button>
            )}
          </>
        }
      >
        <ol className="m-0 mb-6 flex list-none items-center gap-2 p-0">
          {STEPS.map((label, index) => (
            <li key={label} className="flex items-center gap-2">
              <span
                className={cn(
                  'inline-flex size-6 items-center justify-center rounded-full font-semibold text-[0.6875rem]',
                  step >= index + 1 ? 'bg-accent text-on-accent' : 'bg-background text-muted',
                )}
                aria-hidden="true"
              >
                {index + 1}
              </span>
              <span
                className={cn(
                  'text-xs',
                  step >= index + 1 ? 'font-semibold text-default' : 'text-muted',
                )}
                aria-current={step === index + 1 ? 'step' : undefined}
              >
                {label}
              </span>
              {index < STEPS.length - 1 && (
                <span className="h-px w-6 bg-border" aria-hidden="true" />
              )}
            </li>
          ))}
        </ol>

        {clinicLoading && <Spinner />}

        {step === 1 && (
          <div className="flex flex-col gap-3">
            <SelectField
              label="Select patient"
              value={patientId}
              onChange={(event) => {
                setPatientId(event.target.value);
              }}
              options={[
                { value: '', label: 'Choose a patient' },
                ...(patients?.items ?? []).map((patient) => ({
                  value: patient.id,
                  label: `${patient.fullName ?? 'Name hidden'}${
                    patient.phone === null ? '' : ` · ${patient.phone}`
                  }`,
                })),
              ]}
            />

            <button
              type="button"
              className="self-start font-semibold text-accent text-xs hover:underline"
              onClick={() => {
                setAddingPatient(true);
              }}
            >
              ＋ Add a new patient
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-2">
            {services.length === 0 ? (
              <Alert kind="warning">
                This clinic has no active services, so there is nothing to book. Add one under
                Services first.
              </Alert>
            ) : (
              services.map((service) => (
                <button
                  key={service.id}
                  type="button"
                  aria-pressed={serviceId === service.id}
                  onClick={() => {
                    setServiceId(service.id);
                    // A different service has a different duration, so the chosen time may no
                    // longer be a slot at all.
                    setStartAt('');
                  }}
                  className={cn(
                    'flex flex-col gap-1 rounded-lg border p-4 text-left',
                    serviceId === service.id
                      ? 'border-accent bg-accent-surface'
                      : 'border-border bg-surface hover:bg-background',
                  )}
                >
                  <strong className="font-semibold text-default text-xs">{service.name}</strong>
                  <small className="text-muted text-xs">
                    {formatDuration(service.durationMinutes)} · {formatMoney(service.priceMinor)}
                  </small>
                </button>
              ))
            )}
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-4">
            <DateInput
              label="Appointment date"
              value={date}
              min={clinicToday(timeZone)}
              onChange={(value) => {
                setDate(value);
                setStartAt('');
              }}
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
                <Alert kind="warning">
                  {availability.data.reason === null
                    ? 'No times are available that day.'
                    : NO_SLOTS[availability.data.reason]}
                </Alert>
              )}

              {availability.isError && (
                <Alert kind="danger">
                  {errorMessage(availability.error, 'Availability could not be loaded.')}
                </Alert>
              )}

              <p className="m-0 text-subtle text-xs">
                Calculated from the clinic&apos;s opening hours, the doctor&apos;s working hours,
                the service duration and the appointments already booked.
              </p>
            </div>
          </div>
        )}

        {step === 4 && (
          <dl className="m-0 flex flex-col gap-3 rounded-lg border border-border bg-background p-4">
            {[
              ['Patient', selectedPatient?.fullName ?? 'Name hidden'],
              ['Service', selectedService?.name ?? '—'],
              ['Date', date === '' ? '—' : formatDate(`${date}T00:00:00.000Z`, 'UTC')],
              [
                'Time',
                startAt === ''
                  ? '—'
                  : (availability.data?.slots.find((slot) => slot.startAt === startAt)?.label ??
                    '—'),
              ],
              ['Doctor', doctor?.fullName ?? '—'],
              [
                'Duration',
                selectedService === undefined
                  ? '—'
                  : formatDuration(selectedService.durationMinutes),
              ],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-[0.6875rem] text-muted uppercase">{label}</dt>
                <dd className="m-0 font-semibold text-default text-xs">{value}</dd>
              </div>
            ))}
          </dl>
        )}

        {problem !== undefined && (
          <div className="mt-4">
            <Alert kind="danger">{problem}</Alert>
          </div>
        )}
      </Overlay>

      {addingPatient && (
        <PatientForm
          onClose={() => {
            setAddingPatient(false);
          }}
          onSaved={(created) => {
            // Selected straight away: the receptionist added this patient in order to book
            // for them, so making them pick the name again would be busywork.
            setPatientId(created);
          }}
        />
      )}
    </>
  );
};
