import { useEffect, useState } from 'react';
import { WEEKDAYS, clinicHoursSchema, type Weekday } from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { cn } from '../../components/ui/cn';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import { formatDuration } from '../../lib/clinicTime';
import { useClinic, useReplaceHoursMutation } from '../clinic/api';

/**
 * Doctors and staff, from `docs/prototype/laptop-11-staff.png`.
 *
 * The capture's two columns are kept: the doctor on the left with their details under them,
 * the hours editor and the staff list on the right.
 *
 * ─── WHAT THE HOURS EDITOR ACTUALLY EDITS, WHICH THE PROTOTYPE IS VAGUE ABOUT ───
 *
 * The capture calls it "Working hours & availability" and the prototype stores one set of
 * hours used for every calculation. The platform has TWO: the clinic's opening hours, and
 * each doctor's working hours inside them. The slot engine intersects them.
 *
 * This editor writes the CLINIC's opening hours, because that is the one the API exposes and
 * the one a single-doctor clinic means when it says "we are open 09:00 to 17:00". The
 * heading says so, and a note says per-doctor hours are not editable here yet, because there
 * is no endpoint for `doctor_working_hours`. Writing the clinic's hours and labelling them as
 * the doctor's would be the kind of quiet mislabelling that makes a slot list inexplicable.
 *
 * ─── THE BREAK IS THE GAP BETWEEN TWO SEGMENTS (D-013) ──────────────────────────
 *
 * Which is why this form can exist at all: "day starts / break starts / break ends / day
 * ends" becomes two segments per day, and a day with no break becomes one. The API takes all
 * seven weekdays on every save, so a day that is off is a day with no segments.
 *
 * ─── THREE DEVIATIONS ───────────────────────────────────────────────────────────
 *
 * 1. NO EMAIL OR PHONE ON THE DOCTOR CARD. `doctors` holds a name, a specialty and a buffer.
 *    The login that belongs to a doctor has an email, and it is a different record.
 * 2. ONE SET OF HOURS FOR EVERY SELECTED DAY, as the prototype has it. A clinic whose
 *    Saturday differs from its Tuesday cannot say so here; the admin console's own hours
 *    section edits each day separately. The note on screen says where to go.
 * 3. THE CLINIC STAFF LIST IS AN HONEST EMPTY STATE. There is no endpoint that lists a
 *    clinic's users.
 */

const DAY_LABELS: Record<Weekday, string> = {
  MONDAY: 'Mon',
  TUESDAY: 'Tue',
  WEDNESDAY: 'Wed',
  THURSDAY: 'Thu',
  FRIDAY: 'Fri',
  SATURDAY: 'Sat',
  SUNDAY: 'Sun',
};

/** `540` to `09:00`, for a time input. */
const toTimeValue = (minutes: number): string =>
  `${String(Math.floor(minutes / 60)).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')}`;

/** `09:00` to `540`. */
const toMinutes = (value: string): number => {
  const [hours, minutes] = value.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
};

export const StaffPage = () => {
  const { data: clinic, isLoading, isError, error, refetch } = useClinic();
  const [replaceHours, saving] = useReplaceHoursMutation();
  const canWrite = useCan('doctors_services_hours', 'write');

  const [openDays, setOpenDays] = useState<readonly Weekday[]>([]);
  const [dayStart, setDayStart] = useState('09:00');
  const [dayEnd, setDayEnd] = useState('17:00');
  const [breakStart, setBreakStart] = useState('');
  const [breakEnd, setBreakEnd] = useState('');
  const [problem, setProblem] = useState<string | undefined>(undefined);
  const [saved, setSaved] = useState(false);

  /**
   * The form is seeded from the clinic ONCE, when it arrives.
   *
   * Not kept in step with it afterwards, deliberately: a save invalidates the clinic query,
   * and re-seeding on every refetch would wipe half-finished edits the moment anything else
   * on the screen changed.
   */
  useEffect(() => {
    if (clinic === undefined) {
      return;
    }

    const open = clinic.hours.filter((day) => day.segments.length > 0);
    setOpenDays(open.map((day) => day.weekday));

    const first = open[0];
    const firstSegment = first?.segments[0];
    const lastSegment = first?.segments.at(-1);

    if (firstSegment !== undefined && lastSegment !== undefined) {
      setDayStart(toTimeValue(firstSegment.opensAtMinute));
      setDayEnd(toTimeValue(lastSegment.closesAtMinute));

      // Two segments mean a break between them; one means no break.
      if (first !== undefined && first.segments.length > 1) {
        setBreakStart(toTimeValue(firstSegment.closesAtMinute));
        setBreakEnd(toTimeValue(lastSegment.opensAtMinute));
      } else {
        setBreakStart('');
        setBreakEnd('');
      }
    }
  }, [clinic]);

  if (isLoading) {
    return <Spinner />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert kind="danger">{errorMessage(error, 'The clinic could not be loaded.')}</Alert>
        <Button
          kind="secondary"
          onClick={() => {
            void refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (clinic === undefined) {
    return <Spinner />;
  }

  const doctor = clinic.doctors.find((candidate) => candidate.active) ?? clinic.doctors[0];

  const save = async (): Promise<void> => {
    setProblem(undefined);
    setSaved(false);

    const hasBreak = breakStart !== '' && breakEnd !== '';

    const days = WEEKDAYS.map((weekday) => ({
      weekday,
      segments: openDays.includes(weekday)
        ? hasBreak
          ? [
              { opensAtMinute: toMinutes(dayStart), closesAtMinute: toMinutes(breakStart) },
              { opensAtMinute: toMinutes(breakEnd), closesAtMinute: toMinutes(dayEnd) },
            ]
          : [{ opensAtMinute: toMinutes(dayStart), closesAtMinute: toMinutes(dayEnd) }]
        : [],
    }));

    /**
     * Parsed against the shared schema first, so the form refuses what the API would refuse
     * and says the same thing: overnight hours, a close before an open, a break that does not
     * sit inside the day.
     */
    const parsed = clinicHoursSchema.safeParse({ days });

    if (!parsed.success) {
      setProblem(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }

    try {
      await replaceHours({ organisationId: clinic.organisation.id, input: parsed.data }).unwrap();
      setSaved(true);
    } catch (caught) {
      setProblem(errorMessage(caught, 'The opening hours were not saved.'));
    }
  };

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="flex flex-col gap-5">
        {doctor === undefined ? (
          <EmptyState
            title="No doctor yet"
            body="A clinic needs a doctor before anything can be booked: the slot engine answers per doctor. A platform administrator adds one in the admin console."
          />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={doctor.fullName} size="lg" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[0.6875rem] text-accent uppercase tracking-wide">
                  Clinic doctor
                </span>
                <strong className="font-semibold text-default text-md">{doctor.fullName}</strong>
                <small className="text-muted text-xs">
                  {doctor.specialty ?? 'Specialty not recorded'}
                </small>
              </div>
            </div>

            <dl className="m-0 flex flex-col gap-4 border-border border-t pt-5">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-[0.6875rem] text-muted uppercase">Status</dt>
                <dd className="m-0">
                  <Badge kind={doctor.active ? 'success' : 'neutral'}>
                    {doctor.active ? 'Active' : 'Inactive'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-[0.6875rem] text-muted uppercase">
                  Gap after each appointment
                </dt>
                <dd className="m-0 font-semibold text-default text-xs">
                  {doctor.bufferMinutes === 0 ? 'None' : formatDuration(doctor.bufferMinutes)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-[0.6875rem] text-muted uppercase">
                  Bookable services
                </dt>
                <dd className="m-0 text-right font-semibold text-default text-xs">
                  {clinic.services.filter((service) => service.active).length === 0
                    ? 'None yet'
                    : clinic.services
                        .filter((service) => service.active)
                        .map((service) => service.name)
                        .join(', ')}
                </dd>
              </div>
            </dl>

            <Alert kind="info">
              This clinic is configured for one doctor, so every appointment is assigned to{' '}
              {doctor.fullName}. A second doctor needs a column in the appointment list, a step in
              the booking form and a filter, which is recorded in the feature document.
            </Alert>
          </>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="flex flex-col gap-4">
          <div className="flex flex-col gap-0.5">
            <h2 className="m-0 font-semibold text-default text-md">Clinic opening hours</h2>
            <p className="m-0 text-muted text-xs">
              Every bookable slot is calculated from these, the doctor&apos;s own working hours and
              the service duration. Changing them changes what can be booked.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            {WEEKDAYS.map((weekday) => {
              const open = openDays.includes(weekday);

              return (
                <button
                  key={weekday}
                  type="button"
                  disabled={!canWrite}
                  aria-pressed={open}
                  onClick={() => {
                    setSaved(false);
                    setOpenDays((previous) =>
                      previous.includes(weekday)
                        ? previous.filter((day) => day !== weekday)
                        : [...previous, weekday],
                    );
                  }}
                  className={cn(
                    'h-10 min-w-16 rounded-md border px-3 font-semibold text-xs',
                    open
                      ? 'border-accent bg-accent text-inverse'
                      : 'border-border bg-surface text-muted hover:bg-background',
                    !canWrite && 'cursor-not-allowed opacity-60',
                  )}
                >
                  {DAY_LABELS[weekday]}
                </button>
              );
            })}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            {[
              ['Day starts', dayStart, setDayStart] as const,
              ['Day ends', dayEnd, setDayEnd] as const,
              ['Break starts', breakStart, setBreakStart] as const,
              ['Break ends', breakEnd, setBreakEnd] as const,
            ].map(([label, value, set]) => (
              <label key={label} className="flex flex-col gap-1.5">
                <span className="font-semibold text-default text-xs">{label}</span>
                <input
                  type="time"
                  value={value}
                  disabled={!canWrite}
                  onChange={(event) => {
                    setSaved(false);
                    set(event.target.value);
                  }}
                  className="h-10 rounded-md border border-border bg-surface px-3 text-default text-xs disabled:opacity-60"
                />
              </label>
            ))}
          </div>

          <p className="m-0 text-subtle text-xs">
            A break is the gap between two opening segments, so leaving both break fields empty
            means the clinic is open straight through. These hours apply to every selected day: a
            clinic whose Saturday differs sets that day in the admin console.
          </p>

          {problem !== undefined && <Alert kind="danger">{problem}</Alert>}
          {saved && <Alert kind="success">Opening hours saved.</Alert>}

          {canWrite && (
            <div className="flex items-center justify-end gap-3">
              <Button
                loading={saving.isLoading}
                onClick={() => {
                  void save();
                }}
              >
                Save opening hours
              </Button>
            </div>
          )}
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="m-0 font-semibold text-default text-md">Clinic staff</h2>
          <EmptyState
            title="The staff list is not available yet"
            body="There is no endpoint that lists a clinic's users, so nothing is shown rather than an empty list implying this clinic has no staff. Clinic users are created in the admin console today."
          />
        </Card>
      </div>
    </div>
  );
};
