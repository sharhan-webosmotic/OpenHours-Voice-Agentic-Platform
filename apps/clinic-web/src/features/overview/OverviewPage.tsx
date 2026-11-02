import { useState } from 'react';
import { Link } from 'react-router';
import { CalendarDays, CheckCircle2, Clock, PhoneCall } from 'lucide-react';
import { addDays, type AppointmentStatus } from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { useAuth } from '../../app/AuthProvider';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import { clinicToday, formatDate, formatTime } from '../../lib/clinicTime';
import { useClinic } from '../clinic/api';
import { BookingForm } from '../appointments/BookingForm';
import { useAgendaQuery } from '../appointments/api';
import { CalendarPanel } from './CalendarPanel';
import { statusBadge, statusLabel } from '../appointments/status';

/**
 * The day at a glance, from `docs/prototype/desktop-01-overview.png`.
 *
 * ─── THE RE-FLOW, WHICH IS THE WHOLE STORY OF THIS SCREEN ───────────────────────
 *
 * The prototype's Overview is a Figma export with `min-w-[1920px]` and no responsive
 * behaviour: below that width it does not re-flow, it CLIPS, which is visible in
 * `laptop-01-overview.png` where the right-hand calendar is cut off mid-column. So this is
 * the one screen that could not be copied as drawn.
 *
 * What is kept is the capture's hierarchy and card order: the greeting strip, then the row of
 * counters, then the activity panels, then the two lists at the bottom, with the calendar and
 * the day's agenda down the right. What changes is that the three-column grid collapses to
 * two at laptop width and one at tablet width, in that order, so nothing is ever clipped and
 * the reading order stays the same.
 *
 * ─── WHAT IS REAL AND WHAT IS AN HONEST ABSENCE ─────────────────────────────────
 *
 * REAL: the appointment counters, today's agenda, the upcoming list, the calendar's own
 * month. All of it comes from the agenda endpoint.
 *
 * ABSENT, AND SAID SO: calls answered, AI bookings, the estimated revenue impact, the call
 * activity chart and the call outcome split. Those are five of the capture's panels and every
 * number in them is invented. There is no call endpoint until the voice integration lands, so
 * the panels say that rather than showing a plausible figure. A fabricated call count is the
 * one thing this feature must never put on a clinic's screen.
 */

const COUNTERS: readonly {
  readonly status: AppointmentStatus;
  readonly label: string;
  readonly icon: typeof CalendarDays;
}[] = [
  { status: 'SCHEDULED', label: 'Awaiting confirmation', icon: Clock },
  { status: 'CONFIRMED', label: 'Confirmed', icon: CheckCircle2 },
  { status: 'COMPLETED', label: 'Completed', icon: CalendarDays },
  { status: 'CANCELLED', label: 'Cancelled', icon: PhoneCall },
];

export const OverviewPage = () => {
  const { user } = useAuth();
  const { data: clinic, isLoading: clinicLoading } = useClinic();
  const canBook = useCan('appointments', 'write');
  const [booking, setBooking] = useState(false);

  const timeZone = clinic?.organisation.timezone ?? 'UTC';
  const today = clinicLoading ? '' : clinicToday(timeZone);

  const todayAgenda = useAgendaQuery({ range: 'day', on: today }, { skip: today === '' });

  const weekAgenda = useAgendaQuery({ range: 'week', on: today }, { skip: today === '' });

  if (clinicLoading || today === '') {
    return <Spinner />;
  }

  const counts = weekAgenda.data?.counts;

  return (
    <>
      <div className="flex flex-col gap-4">
        <Card className="flex flex-wrap items-center justify-between gap-4 bg-accent-surface">
          <div className="flex flex-col gap-1">
            <span className="font-semibold text-[0.6875rem] text-accent uppercase tracking-wide">
              {formatDate(new Date().toISOString(), timeZone)}
            </span>
            <strong className="font-semibold text-default text-xl">
              {/* The signed-in person, not a hardcoded doctor as in the prototype. */}
              Good morning{user?.role === 'DOCTOR' ? ', doctor' : ''}
            </strong>
            <p className="m-0 text-muted text-xs">
              {clinic?.organisation.name ?? 'This clinic'} · everything below is this clinic&apos;s
              own data, in {timeZone.replace('_', ' ')}.
            </p>
          </div>

          {canBook && (
            <Button
              onClick={() => {
                setBooking(true);
              }}
            >
              ＋ New Appointment
            </Button>
          )}
        </Card>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {COUNTERS.map((counter) => (
            <Card key={counter.status} className="flex items-center justify-between gap-3">
              <div className="flex flex-col gap-1">
                <span className="text-muted text-xs">{counter.label}</span>
                <strong className="font-semibold text-default text-xl">
                  {counts === undefined ? '—' : counts[counter.status]}
                </strong>
                <small className="text-subtle text-xs">this week</small>
              </div>
              <span
                className="inline-flex size-10 items-center justify-center rounded-lg bg-accent-surface text-accent"
                aria-hidden="true"
              >
                <counter.icon size={18} />
              </span>
            </Card>
          ))}
        </div>

        <div className="grid grid-cols-1 items-start gap-4 xl:grid-cols-[minmax(0,1fr)_24rem]">
          <Card className="flex flex-col gap-4 p-0">
            <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
              <div className="flex flex-col gap-0.5">
                <h2 className="m-0 font-semibold text-default text-md">Today</h2>
                <p className="m-0 text-muted text-xs">
                  {formatDate(new Date().toISOString(), timeZone)}
                </p>
              </div>
              <Link
                to="/appointments"
                className="font-semibold text-accent text-xs hover:underline"
              >
                View all appointments
              </Link>
            </div>

            {todayAgenda.isLoading && (
              <div className="px-6 pb-6">
                <Spinner />
              </div>
            )}

            {todayAgenda.isError && (
              <div className="px-6 pb-6">
                <Alert kind="danger">
                  {errorMessage(todayAgenda.error, "Today's appointments could not be loaded.")}
                </Alert>
              </div>
            )}

            {todayAgenda.data !== undefined && todayAgenda.data.appointments.length === 0 && (
              <div className="px-6 pb-6">
                <EmptyState
                  title="Nothing booked today"
                  body="Appointments booked here and by the AI receptionist both appear in this list."
                  action={
                    canBook ? (
                      <Button
                        onClick={() => {
                          setBooking(true);
                        }}
                      >
                        ＋ New Appointment
                      </Button>
                    ) : undefined
                  }
                />
              </div>
            )}

            {todayAgenda.data !== undefined && todayAgenda.data.appointments.length > 0 && (
              <ul className="m-0 list-none p-0">
                {todayAgenda.data.appointments.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-border border-t px-6 py-4"
                  >
                    <span className="flex items-center gap-4">
                      <strong className="w-20 font-semibold text-default text-xs">
                        {formatTime(appointment.startAt, timeZone)}
                      </strong>
                      <span className="flex flex-col gap-0.5">
                        <strong className="font-semibold text-default text-xs">
                          {appointment.patient.fullName ?? 'Name hidden'}
                        </strong>
                        <small className="text-muted text-xs">
                          {appointment.doctor.fullName}
                          {appointment.service === null ? '' : ` · ${appointment.service.name}`}
                        </small>
                      </span>
                    </span>
                    <Badge kind={statusBadge(appointment.status)}>
                      {statusLabel(appointment.status, appointment.source)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <div className="flex flex-col gap-4">
            {/*
             * The calendar sits in the right-hand column, where the capture has it, and takes
             * the top of it: the month grid and the selected day are what a receptionist looks
             * at first, and the week's counts are a summary of what the grid already shows.
             */}
            <CalendarPanel timeZone={timeZone} today={today} />

            <Card className="flex flex-col gap-3">
              <h2 className="m-0 font-semibold text-default text-md">This week</h2>
              {counts === undefined ? (
                <Spinner />
              ) : (
                <>
                  <p className="m-0 text-muted text-xs">
                    {formatDate(`${today}T00:00:00.000Z`, 'UTC')} to{' '}
                    {formatDate(`${addDays(today, 6)}T00:00:00.000Z`, 'UTC')}
                  </p>
                  <ul className="m-0 flex list-none flex-col gap-2 p-0">
                    {COUNTERS.map((counter) => (
                      <li
                        key={counter.status}
                        className="flex items-center justify-between gap-3 border-border border-b pb-2 last:border-b-0"
                      >
                        <span className="text-muted text-xs">{counter.label}</span>
                        <strong className="font-semibold text-default text-xs">
                          {counts[counter.status]}
                        </strong>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </Card>

            {/*
             * The five panels the capture fills with invented numbers.
             *
             * One honest card rather than five empty ones: five placeholders would take up the
             * whole right-hand column and say the same sentence five times.
             */}
            <Card className="flex flex-col gap-2">
              <h2 className="m-0 font-semibold text-default text-md">AI receptionist activity</h2>
              <p className="m-0 text-muted text-xs">
                Calls answered, bookings the agent made, the call outcome split and the revenue
                estimate are not shown, because there is no call data in the platform yet. They
                arrive with the voice integration, and showing a plausible number before then would
                put a figure on this screen that nothing can support.
              </p>
              <Link to="/calls" className="font-semibold text-accent text-xs hover:underline">
                About call history
              </Link>
            </Card>
          </div>
        </div>
      </div>

      {booking && (
        <BookingForm
          onClose={() => {
            setBooking(false);
          }}
        />
      )}
    </>
  );
};
