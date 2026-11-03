import { useEffect, useMemo, useState } from 'react';
import type { AvailabilityReason } from '@clinicai/api-client';
import { APPOINTMENT_NOTES_MAX } from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Overlay } from '../../components/ui/Overlay';
import { SelectField, TextAreaField } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { cn } from '../../components/ui/cn';
import { errorMessage } from '../../lib/problem';
import { clinicToday, formatDate, formatDuration, formatMoney } from '../../lib/clinicTime';
import { useClinic } from '../clinic/api';
import { usePatientsQuery } from '../patients/api';
import { PatientForm } from '../patients/PatientForm';
import { useAvailabilityQuery, useBookMutation } from './api';

/**
 * Booking an appointment: one scrolling sheet, as the clinic's reference draws it.
 *
 * ─── ONE SHEET, NOT FOUR STEPS ──────────────────────────────────────────────────
 *
 * The prototype export has a four-step wizard and the reference the clinic signed off
 * replaced it with a single form: patient, doctor, service, date, then the free times, all
 * visible at once. "Continue" then shows what is about to be booked for a last look, which
 * is the old fourth step kept as a confirmation, because a booking is the one action here a
 * patient will act on and it should not be one click from a mis-tapped slot.
 *
 * ─── THE SLOT LIST IS THE SERVER'S ──────────────────────────────────────────────
 *
 * Nothing here works out which times are free. The availability endpoint applies the
 * opening hours, the doctor's hours, time off, the service's length, the booking policy and
 * the appointments already in the book, and returns instants. The form offers what it was
 * given and sends one back, so no second implementation of those rules can disagree.
 *
 * ─── AN EMPTY DAY SAYS WHY ──────────────────────────────────────────────────────
 *
 * `reason` turns "no slots" into something a receptionist can act on: closed that day, the
 * doctor is off, too far ahead. The reference shows one sentence for all of them.
 *
 * ─── IDEMPOTENCY ────────────────────────────────────────────────────────────────
 *
 * One key is minted when the sheet opens and sent with every attempt, so a double-click or a
 * retried request returns the original booking (root CLAUDE.md rule 8). It is deliberately
 * NOT regenerated between attempts: that would make the retry a new booking, which is the
 * bug the header exists to prevent.
 *
 * ─── THE NOTE IS PATIENT DATA ───────────────────────────────────────────────────
 *
 * Optional, bounded at the length the database enforces, and sent with the booking. The API
 * never logs it or audits its text, nulls it for a platform role's masked read, and carries
 * it across a reschedule. Blank is sent as nothing at all, so an empty box is not stored as
 * a note that says nothing.
 */

const NO_SLOTS: Record<AvailabilityReason, string> = {
  HOURS_NOT_COLLECTED:
    "This clinic's opening hours have not been recorded yet, so no times can be offered.",
  DAY_IN_THE_PAST: 'That date has already passed.',
  BEYOND_MAXIMUM_ADVANCE: 'That date is further ahead than this clinic takes bookings.',
  CLINIC_CLOSED: 'The clinic is closed that day.',
  DOCTOR_NOT_WORKING: 'The doctor is not working that day.',
  FULLY_BOOKED: 'Every time that day is taken.',
};

/** `Priya Shah` stays `Priya Shah`; the reference's possessive needs a name either way. */
const possessive = (name: string): string => `${name}’s`;

export const BookingForm = ({
  initialPatientId,
  initialDate,
  onClose,
  onBooked,
}: {
  readonly initialPatientId?: string | undefined;
  /**
   * The clinic day to open on, from "+ Add" on a week column or "+ Book" on the month's
   * selected day. Without it the sheet opens on today.
   */
  readonly initialDate?: string | undefined;
  readonly onClose: () => void;
  readonly onBooked?: ((appointmentId: string) => void) | undefined;
}) => {
  const { data: clinic, isLoading: clinicLoading } = useClinic();
  const [book, booking] = useBookMutation();

  const timeZone = clinic?.organisation.timezone ?? 'UTC';

  const [reviewing, setReviewing] = useState(false);
  const [patientId, setPatientId] = useState(initialPatientId ?? '');
  const [doctorId, setDoctorId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [date, setDate] = useState(initialDate ?? '');
  const [startAt, setStartAt] = useState('');
  const [notes, setNotes] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [addingPatient, setAddingPatient] = useState(false);

  /**
   * Minted once per open, and kept across attempts. See the note above.
   *
   * `crypto.randomUUID` rather than a counter or a timestamp: two receptionists booking at
   * the same moment must not share a key, because the second booking would come back as a
   * replay of the first.
   */
  const [idempotencyKey] = useState(() => crypto.randomUUID());

  const { data: patients } = usePatientsQuery({ limit: 100 });

  const doctors = useMemo(
    () => (clinic?.doctors ?? []).filter((doctor) => doctor.active),
    [clinic],
  );
  const services = useMemo(
    () => (clinic?.services ?? []).filter((service) => service.active),
    [clinic],
  );

  /**
   * Defaults, once the clinic is known: today on the clinic's own calendar, and the doctor
   * and service when there is exactly one of each, which is the pilot's shape. With several,
   * the receptionist chooses: picking the first would be a guess dressed as a default.
   */
  useEffect(() => {
    if (clinic === undefined) {
      return;
    }
    if (date === '') {
      setDate(clinicToday(timeZone));
    }
    if (doctorId === '' && doctors.length === 1 && doctors[0] !== undefined) {
      setDoctorId(doctors[0].id);
    }
    if (serviceId === '' && services.length === 1 && services[0] !== undefined) {
      setServiceId(services[0].id);
    }
  }, [clinic, date, doctorId, doctors, serviceId, services, timeZone]);

  const availability = useAvailabilityQuery(
    { doctorId, serviceId, date },
    { skip: doctorId === '' || serviceId === '' || date === '' },
  );

  /**
   * Re-reads the slot list, but only if it was ever read.
   *
   * `refetch` THROWS on a query that has not started, which is the case whenever `skip` was
   * true. It surfaced as "Cannot refetch a query that has not been started yet" in a test run
   * rather than anywhere a user would see, which is how an unhandled rejection ships.
   */
  const refreshTimes = (): void => {
    if (!availability.isUninitialized) {
      void availability.refetch();
    }
  };

  const doctor = doctors.find((candidate) => candidate.id === doctorId);
  const service = services.find((candidate) => candidate.id === serviceId);
  const patient = patients?.items.find((candidate) => candidate.id === patientId);
  const slot = availability.data?.slots.find((candidate) => candidate.startAt === startAt);

  /** Any change upstream of the time invalidates the time: it was free for the old choice. */
  const resetTime = (): void => {
    setStartAt('');
  };

  const proceed = (): void => {
    if (patientId === '') {
      setProblem('Select a patient to continue.');
      return;
    }
    if (doctorId === '') {
      setProblem('Select a doctor.');
      return;
    }
    if (serviceId === '') {
      setProblem('Select a service.');
      return;
    }
    if (startAt === '') {
      setProblem('Choose an available time.');
      return;
    }

    setProblem(undefined);
    setReviewing(true);
  };

  const confirm = async (): Promise<void> => {
    setProblem(undefined);

    try {
      const result = await book({
        input: {
          patientId,
          doctorId,
          serviceId,
          startAt,
          ...(notes.trim() === '' ? {} : { notes: notes.trim() }),
        },
        idempotencyKey,
      }).unwrap();

      onBooked?.(result.appointmentId);
      onClose();
    } catch (error) {
      /**
       * A 409 is the ordinary case, not a crash: the slot was taken between the list being
       * drawn and this click. The message says so, the sheet returns to the times, and the
       * times are read again rather than still offering the one that has gone.
       */
      setProblem(errorMessage(error, 'The appointment was not booked.'));
      setReviewing(false);
      resetTime();
      refreshTimes();
    }
  };

  const title = doctor === undefined ? 'Book an appointment' : `Book with ${doctor.fullName}`;

  return (
    <>
      <Overlay
        eyebrow="NEW APPOINTMENT"
        title={title}
        size="wide"
        onClose={onClose}
        footer={
          reviewing ? (
            <>
              <Button
                kind="secondary"
                onClick={() => {
                  setReviewing(false);
                }}
              >
                Back
              </Button>
              <Button
                loading={booking.isLoading}
                onClick={() => {
                  void confirm();
                }}
              >
                Confirm appointment
              </Button>
            </>
          ) : (
            <>
              <Button kind="secondary" onClick={onClose}>
                Cancel
              </Button>
              <Button onClick={proceed}>Continue</Button>
            </>
          )
        }
      >
        {clinicLoading && <Spinner />}

        {!clinicLoading && !reviewing && (
          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <SelectField
                label="Select patient"
                value={patientId}
                placeholder="Choose a patient"
                onChange={(event) => {
                  setPatientId(event.target.value);
                }}
                options={(patients?.items ?? []).map((candidate) => ({
                  value: candidate.id,
                  label: `${candidate.fullName ?? 'Name hidden'}${
                    candidate.phone === null ? '' : ` · ${candidate.phone}`
                  }`,
                }))}
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

            {doctors.length === 0 ? (
              <Alert kind="warning">
                This clinic has no active doctor, so nothing can be booked yet.
              </Alert>
            ) : (
              <SelectField
                label="Doctor"
                value={doctorId}
                placeholder={doctors.length === 1 ? undefined : 'Choose a doctor'}
                onChange={(event) => {
                  setDoctorId(event.target.value);
                  resetTime();
                }}
                options={doctors.map((candidate) => ({
                  value: candidate.id,
                  // "Dr. Sudhir · Cardiology Specialist", as the reference writes a doctor.
                  label:
                    candidate.specialty === null
                      ? candidate.fullName
                      : `${candidate.fullName} · ${candidate.specialty}`,
                }))}
              />
            )}

            {services.length === 0 ? (
              <Alert kind="warning">
                This clinic has no active services, so there is nothing to book. Add one under
                Services first.
              </Alert>
            ) : (
              <SelectField
                label="Select service"
                value={serviceId}
                placeholder={services.length === 1 ? undefined : 'Choose a service'}
                onChange={(event) => {
                  setServiceId(event.target.value);
                  resetTime();
                }}
                options={services.map((candidate) => ({
                  value: candidate.id,
                  label: candidate.name,
                }))}
              />
            )}

            <label className="flex flex-col gap-1.5">
              <span className="font-semibold text-default text-sm">Appointment date</span>
              <input
                type="date"
                value={date}
                onChange={(event) => {
                  setDate(event.target.value);
                  resetTime();
                }}
                className="h-[42px] rounded-[10px] border border-border bg-surface px-3.5 text-default text-sm"
              />
            </label>

            <fieldset className="m-0 flex flex-col gap-2.5 border-0 p-0">
              <legend className="mb-2.5 font-semibold text-default text-sm">
                Available time slots
              </legend>

              {(doctorId === '' || serviceId === '') && (
                <p className="m-0 text-muted text-xs">
                  Choose a doctor and a service to see the free times.
                </p>
              )}

              {availability.isFetching && availability.data === undefined && <Spinner />}

              {availability.data !== undefined && availability.data.slots.length === 0 && (
                <p className="m-0 text-muted text-xs">
                  {availability.data.reason === null
                    ? 'No times are free that day.'
                    : NO_SLOTS[availability.data.reason]}
                </p>
              )}

              {availability.data !== undefined && availability.data.slots.length > 0 && (
                <div className="grid grid-cols-4 gap-2 sm:grid-cols-8">
                  {availability.data.slots.map((candidate) => (
                    <button
                      key={candidate.startAt}
                      type="button"
                      aria-pressed={startAt === candidate.startAt}
                      onClick={() => {
                        setStartAt(candidate.startAt);
                        setProblem(undefined);
                      }}
                      className={cn(
                        'h-10 rounded-[10px] border font-bold text-[0.8125rem] transition-colors',
                        startAt === candidate.startAt
                          ? 'border-accent bg-accent text-inverse shadow-accent'
                          : 'border-border bg-[#f6f8fc] text-accent hover:border-accent',
                      )}
                    >
                      {candidate.label}
                    </button>
                  ))}
                </div>
              )}

              {doctor !== undefined && (
                <p className="m-0 text-muted text-xs">
                  Calculated from {possessive(doctor.fullName)} hours for this weekday, break times,
                  service duration, and existing bookings.
                </p>
              )}
            </fieldset>

            <TextAreaField
              label="Notes (optional)"
              placeholder="Add helpful appointment notes"
              rows={4}
              maxLength={APPOINTMENT_NOTES_MAX}
              value={notes}
              onChange={(event) => {
                setNotes(event.target.value);
              }}
            />
          </div>
        )}

        {reviewing && (
          <dl className="m-0 flex flex-col gap-3 rounded-xl bg-accent-surface p-5">
            {[
              ['Patient', patient?.fullName ?? '—'],
              ['Doctor', doctor?.fullName ?? '—'],
              ['Service', service?.name ?? '—'],
              ['Date', date === '' ? '—' : formatDate(`${date}T06:00:00.000Z`, 'UTC')],
              ['Time', slot?.label ?? '—'],
              ['Duration', service === undefined ? '—' : formatDuration(service.durationMinutes)],
              ['Price', service === undefined ? '—' : formatMoney(service.priceMinor)],
              ['Notes', notes.trim() === '' ? 'None' : notes.trim()],
            ].map(([label, value]) => (
              <div key={label} className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-muted text-xs uppercase tracking-wide">
                  {label}
                </dt>
                <dd className="m-0 font-semibold text-default text-sm">{value}</dd>
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
