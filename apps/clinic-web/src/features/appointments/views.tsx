import { useMemo } from 'react';
import { CalendarPlus, Clock, Plus } from 'lucide-react';
import type { AppointmentView, DayHoursView } from '@clinicai/api-client';
import {
  addDays,
  startOfClinicDay,
  weekdayOf,
  type AppointmentStatus,
  type ClinicDay,
} from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { cn } from '../../components/ui/cn';
import { errorMessage } from '../../lib/problem';
import { clinicDay, formatTime24 } from '../../lib/clinicTime';
import { useAgendaQuery, useAppointmentsQuery } from './api';
import { statusBadge, statusLabel } from './status';

/**
 * The calendar views of the appointments screen: month, week and day, from the clinic's
 * reference. The list view is the table on the page itself.
 *
 * ─── EVERY VIEW READS THE CLINIC'S CALENDAR ─────────────────────────────────────
 *
 * Which day an appointment is on, which week a day is in and which hour a slot falls in are
 * all the clinic's, from `clinicTime`, never the browser's. A receptionist in another zone
 * would otherwise see 23:45 appointments on the wrong day.
 *
 * ─── WEEKS START ON SUNDAY, AS THE REFERENCE DRAWS THEM ─────────────────────────
 *
 * The agenda endpoint's `range=week` is Monday-first, so the week view reads the appointment
 * list over Sunday to Saturday instead. That list is paged at 100, which is more than a
 * single doctor's week holds; a busier week says so rather than silently showing the first
 * hundred.
 */

const SUNDAY_FIRST = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

/** The Sunday on or before `day`. */
export const weekStart = (day: ClinicDay): ClinicDay =>
  addDays(day, -SUNDAY_FIRST.indexOf(weekdayOf(day)));

const dayLabel = (day: ClinicDay, options: Intl.DateTimeFormatOptions): string =>
  new Intl.DateTimeFormat('en-US', { ...options, timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00.000Z`),
  );

/** The tint an appointment card takes, from the same status and source its badge reads. */
const tintFor = (status: AppointmentStatus, source: AppointmentView['source']): string => {
  const kind = statusBadge(status, source);

  return kind === 'success'
    ? 'bg-success-surface'
    : kind === 'info'
      ? 'bg-accent-surface'
      : kind === 'warning'
        ? 'bg-warning-surface'
        : kind === 'danger'
          ? 'bg-danger-surface'
          : 'bg-background';
};

const DOT: Record<string, string> = {
  info: '#356ae6',
  success: '#20b486',
  warning: '#f3a64a',
  danger: '#ef5350',
  neutral: '#b7c0d1',
};

const groupByDay = (
  appointments: readonly AppointmentView[],
  timeZone: string,
): ReadonlyMap<string, readonly AppointmentView[]> => {
  const grouped = new Map<string, AppointmentView[]>();

  for (const appointment of appointments) {
    const key = clinicDay(appointment.startAt, timeZone);
    grouped.set(key, [...(grouped.get(key) ?? []), appointment]);
  }

  return grouped;
};

/** `09:00`, from minutes after midnight. */
const minute = (value: number): string =>
  `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;

/** The clinic's opening for one day, in words, from its recorded hours. */
const openingFor = (day: ClinicDay, hours: readonly DayHoursView[]): string => {
  const segments = hours.find((row) => row.weekday === weekdayOf(day))?.segments ?? [];

  return segments.length === 0
    ? 'The clinic is closed on this day'
    : `Open ${segments
        .map((segment) => `${minute(segment.opensAtMinute)}–${minute(segment.closesAtMinute)}`)
        .join(', ')}`;
};

/**
 * A day with nothing booked, said usefully rather than blankly.
 *
 * It tells the receptionist the three things they would otherwise go and look up: that the
 * day is free, when the clinic is open on it, and how to book into it. A day that has
 * already passed is not offered a booking, because the server would refuse one, and a
 * button that leads to a refusal is worse than no button.
 */
const FreeDay = ({
  day,
  today,
  hours,
  onBook,
}: {
  readonly day: ClinicDay;
  readonly today: ClinicDay;
  readonly hours: readonly DayHoursView[];
  readonly onBook: ((day: ClinicDay) => void) | undefined;
}) => {
  const past = day < today;

  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-14 place-items-center rounded-2xl bg-accent-surface text-accent">
        <CalendarPlus size={26} aria-hidden="true" />
      </span>
      <strong className="mt-4 font-semibold text-default text-md">
        {past ? 'Nothing was booked' : 'No appointments yet'}
      </strong>
      <p className="m-0 mt-1.5 max-w-[280px] text-muted text-xs leading-5">
        {past
          ? 'This day has passed, and no appointment was booked on it.'
          : 'This day is free. Book a patient in, or the AI receptionist will fill it as calls come in.'}
      </p>
      <span className="mt-4 inline-flex items-center gap-1.5 rounded-full bg-surface-sunken px-3 py-1.5 text-muted text-xs">
        <Clock size={13} aria-hidden="true" />
        {openingFor(day, hours)}
      </span>
      {!past && onBook !== undefined && (
        <button
          type="button"
          onClick={() => {
            onBook(day);
          }}
          className="mt-5 flex h-10 items-center gap-1.5 rounded-control bg-accent px-4 font-semibold text-inverse text-sm shadow-accent hover:opacity-95"
        >
          <Plus size={16} aria-hidden="true" />
          Book an appointment
        </button>
      )}
    </div>
  );
};

type ViewProps = {
  readonly anchor: ClinicDay;
  readonly today: ClinicDay;
  readonly timeZone: string;
  readonly onSelectDay: (day: ClinicDay) => void;
  readonly onOpen: (appointment: AppointmentView) => void;
  readonly onBook: ((day: ClinicDay) => void) | undefined;
  /** The clinic's opening hours, for what an empty day says about itself. */
  readonly hours: readonly DayHoursView[];
};

/**
 * The month: a ruled Sunday-first grid on the left and the selected day on the right.
 *
 * ONE MONTH QUERY for the dots and one day query for the panel, for the reason the overview
 * gives: the month response is capped at a page, and a busy day must not look empty.
 */
export const MonthView = ({
  anchor,
  today,
  timeZone,
  onSelectDay,
  onOpen,
  onBook,
  hours,
}: ViewProps) => {
  const monthStart = `${anchor.slice(0, 7)}-01`;
  const month = useAgendaQuery({ range: 'month', on: monthStart });
  const day = useAgendaQuery({ range: 'day', on: anchor });

  const byDay = useMemo(
    () => groupByDay(month.data?.appointments ?? [], timeZone),
    [month.data, timeZone],
  );

  const days = useMemo(() => {
    const start = weekStart(monthStart);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [monthStart]);

  const appointments = day.data?.appointments ?? [];

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
      <Card padded={false} className="overflow-hidden p-0">
        {month.isError && (
          <div className="p-4">
            <Alert kind="danger">
              {errorMessage(month.error, 'The month could not be loaded.')}
            </Alert>
          </div>
        )}
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">Appointments by day</caption>
          <thead>
            <tr>
              {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="h-[46px] border-border-chrome border-b bg-surface-sunken font-semibold text-muted text-xs uppercase"
                >
                  {heading}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: 6 }, (_, week) => (
              <tr key={days[week * 7] ?? week}>
                {days.slice(week * 7, week * 7 + 7).map((date) => {
                  const inMonth = date.slice(0, 7) === monthStart.slice(0, 7);
                  const dots = byDay.get(date) ?? [];
                  const selected = date === anchor;

                  return (
                    <td
                      key={date}
                      className="h-[96px] border-border-chrome border-r border-b p-0 align-top last:border-r-0"
                    >
                      <button
                        type="button"
                        aria-pressed={selected}
                        aria-label={`${date}, ${String(dots.length)} appointments`}
                        onClick={() => {
                          onSelectDay(date);
                        }}
                        className={cn(
                          'flex h-[96px] w-full flex-col gap-1.5 p-3 text-left',
                          selected
                            ? 'bg-accent-surface/50 outline-2 outline-accent -outline-offset-2'
                            : inMonth
                              ? 'bg-surface hover:bg-background'
                              : 'bg-[#fbfcfe]',
                        )}
                      >
                        <span
                          className={cn(
                            'text-xs',
                            inMonth ? 'text-default' : 'text-[#bbc2d0]',
                            date === today && 'font-bold text-accent',
                          )}
                        >
                          {Number(date.slice(-2))}
                        </span>
                        <span aria-hidden="true" className="flex flex-wrap gap-1">
                          {dots.slice(0, 6).map((appointment) => (
                            <span
                              key={appointment.id}
                              className="size-1.5 rounded-full"
                              style={{
                                backgroundColor:
                                  DOT[statusBadge(appointment.status, appointment.source)],
                              }}
                            />
                          ))}
                        </span>
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <Card padded={false} className="p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <span className="font-bold text-accent text-xs uppercase tracking-[1px]">
              Selected day
            </span>
            <h2 className="m-0 mt-1 font-bold text-[1.25rem] text-default tracking-[-0.3px]">
              {dayLabel(anchor, { weekday: 'long', month: 'long', day: 'numeric' })}
            </h2>
          </div>
          {/* No Book button here, at the clinic's request: an empty day offers one in the
              panel, and the header's New Appointment is on every screen. */}
        </div>

        <div className="mt-5">
          {day.isFetching && day.data === undefined && <Spinner />}
          {day.data !== undefined && appointments.length === 0 && (
            <FreeDay day={anchor} today={today} hours={hours} onBook={onBook} />
          )}
          <ul className="m-0 flex list-none flex-col p-0">
            {appointments.map((appointment) => (
              <li key={appointment.id} className="border-border-chrome border-b">
                <button
                  type="button"
                  onClick={() => {
                    onOpen(appointment);
                  }}
                  className="flex w-full items-center gap-4 px-2.5 py-4 text-left hover:bg-background"
                >
                  <span className="w-12 shrink-0 text-muted text-[0.8125rem]">
                    {formatTime24(appointment.startAt, timeZone)}
                  </span>
                  <span className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-default text-[0.8125rem]">
                      {appointment.patient.fullName ?? 'Name hidden'}
                    </span>
                    <span className="truncate text-[0.6875rem] text-muted">
                      {appointment.service?.name ?? 'No service'}
                    </span>
                  </span>
                  <Badge kind={statusBadge(appointment.status, appointment.source)}>
                    {statusLabel(appointment.status, appointment.source)}
                  </Badge>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </Card>
    </div>
  );
};

/** The week: seven columns, Sunday to Saturday, each with its appointments as cards. */
export const WeekView = ({ anchor, today, timeZone, onOpen, onBook }: ViewProps) => {
  const sunday = weekStart(anchor);
  const days = Array.from({ length: 7 }, (_, index) => addDays(sunday, index));

  const week = useAppointmentsQuery({
    from: startOfClinicDay(sunday, timeZone).toISOString(),
    to: startOfClinicDay(addDays(sunday, 7), timeZone).toISOString(),
    limit: 100,
  });

  const byDay = useMemo(() => groupByDay(week.data?.items ?? [], timeZone), [week.data, timeZone]);

  return (
    <>
      {week.isError && (
        <Alert kind="danger">{errorMessage(week.error, 'The week could not be loaded.')}</Alert>
      )}
      {week.data?.nextCursor !== null && week.data?.nextCursor !== undefined && (
        <Alert kind="warning">
          This week has more than a hundred appointments, and only the first hundred are shown. The
          list view shows them all.
        </Alert>
      )}

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {days.map((date) => {
          const items = byDay.get(date) ?? [];
          const isToday = date === today;

          return (
            <Card key={date} padded={false} className="flex min-h-[380px] flex-col gap-2.5 p-2.5">
              <div
                className={cn(
                  'flex items-center justify-between rounded-lg px-2 py-2',
                  isToday ? 'bg-accent-surface' : 'bg-surface-sunken',
                )}
              >
                <span className="text-muted text-xs">{dayLabel(date, { weekday: 'short' })}</span>
                <span className={cn('text-md', isToday ? 'text-accent' : 'text-default')}>
                  {Number(date.slice(-2))}
                </span>
              </div>

              {week.isLoading && <Spinner />}

              {items.map((appointment) => (
                <button
                  key={appointment.id}
                  type="button"
                  onClick={() => {
                    onOpen(appointment);
                  }}
                  aria-label={`${formatTime24(appointment.startAt, timeZone)}, ${appointment.patient.fullName ?? 'Name hidden'}, ${statusLabel(appointment.status, appointment.source)}`}
                  className={cn(
                    'flex flex-col gap-1 rounded-xl p-2.5 text-left hover:brightness-[0.98]',
                    tintFor(appointment.status, appointment.source),
                  )}
                >
                  <span className="text-default text-xs">
                    {formatTime24(appointment.startAt, timeZone)}
                  </span>
                  <span className="font-medium text-default text-[0.8125rem]">
                    {appointment.patient.fullName ?? 'Name hidden'}
                  </span>
                  <span className="text-[0.6875rem] text-muted">
                    {appointment.service?.name ?? 'No service'}
                  </span>
                </button>
              ))}

              {!week.isLoading && items.length === 0 && onBook !== undefined && (
                <button
                  type="button"
                  onClick={() => {
                    onBook(date);
                  }}
                  aria-label={`Add an appointment on ${date}`}
                  className="flex h-9 items-center justify-center gap-1 rounded-lg border border-border border-dashed text-muted text-xs hover:border-accent hover:text-accent"
                >
                  <Plus size={12} aria-hidden="true" />
                  Add
                </button>
              )}
            </Card>
          );
        })}
      </div>
    </>
  );
};

/**
 * The day: an hour-by-hour timeline across the clinic's opening hours.
 *
 * THE HOURS ARE THE CLINIC'S, from its recorded opening hours for that weekday. A day with
 * none recorded says so, and still shows the hours that have appointments in them, because
 * an appointment that exists must never be hidden by a gap in the configuration.
 */
export const DayView = ({
  anchor,
  timeZone,
  onOpen,
  onBook,
  hours,
  doctorName,
}: ViewProps & {
  readonly doctorName: string | undefined;
}) => {
  const day = useAgendaQuery({ range: 'day', on: anchor });
  const appointments = day.data?.appointments ?? [];

  const segments = hours.find((row) => row.weekday === weekdayOf(anchor))?.segments ?? [];
  const opens =
    segments.length === 0 ? undefined : Math.min(...segments.map((s) => s.opensAtMinute));
  const closes =
    segments.length === 0 ? undefined : Math.max(...segments.map((s) => s.closesAtMinute));

  const hourOf = (appointment: AppointmentView): number =>
    Number(formatTime24(appointment.startAt, timeZone).slice(0, 2));

  const bookedHours = appointments.map(hourOf);
  const firstHour = Math.min(
    ...(opens === undefined ? [] : [Math.floor(opens / 60)]),
    ...bookedHours,
    opens === undefined && bookedHours.length === 0 ? 9 : 24,
  );
  const lastHour = Math.max(
    ...(closes === undefined ? [] : [Math.ceil(closes / 60) - 1]),
    ...bookedHours,
    opens === undefined && bookedHours.length === 0 ? 16 : 0,
  );
  const rows = Array.from(
    { length: Math.max(0, lastHour - firstHour + 1) },
    (_, i) => firstHour + i,
  );

  return (
    <Card padded={false} className="p-5">
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
        <div className="flex flex-wrap items-baseline gap-2.5 pl-20">
          <h2 className="m-0 font-medium text-default text-md">
            {dayLabel(anchor, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
          </h2>
          <span className="text-muted text-xs">
            {[
              doctorName,
              opens === undefined || closes === undefined
                ? 'No opening hours recorded for this day'
                : `${minute(opens)}–${minute(closes)}`,
            ]
              .filter((part): part is string => part !== undefined)
              .join(' · ')}
          </span>
        </div>
        {onBook !== undefined && (
          <button
            type="button"
            onClick={() => {
              onBook(anchor);
            }}
            className="flex h-10 items-center gap-1.5 rounded-control bg-accent px-4 font-semibold text-inverse text-sm shadow-accent hover:opacity-95"
          >
            <Plus size={16} aria-hidden="true" />
            New Appointment
          </button>
        )}
      </div>

      {day.isFetching && day.data === undefined && <Spinner />}

      <ol className="m-0 list-none p-0" aria-label="Appointments by hour">
        {rows.map((hour) => {
          const inHour = appointments.filter((appointment) => hourOf(appointment) === hour);

          return (
            <li
              key={hour}
              className="grid min-h-[88px] grid-cols-[76px_minmax(0,1fr)] border-border-chrome border-t"
            >
              <span className="pt-4 text-muted text-xs">{minute(hour * 60)}</span>
              <div className="flex flex-col gap-2 border-border-chrome border-l py-2 pl-2">
                {inHour.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => {
                      onOpen(appointment);
                    }}
                    className="flex w-full max-w-[360px] flex-col gap-1 rounded-md border-accent border-l-[3px] bg-accent-surface px-3 py-2.5 text-left hover:brightness-[0.98]"
                  >
                    <span className="text-default text-[0.8125rem]">
                      {formatTime24(appointment.startAt, timeZone)} ·{' '}
                      {appointment.patient.fullName ?? 'Name hidden'}
                    </span>
                    <span className="text-[0.6875rem] text-muted">
                      {appointment.service?.name ?? 'No service'}
                    </span>
                  </button>
                ))}
              </div>
            </li>
          );
        })}
      </ol>
    </Card>
  );
};
