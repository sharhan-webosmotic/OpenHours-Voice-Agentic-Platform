import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import type { AppointmentView } from '@clinicai/api-client';
import { WEEKDAYS, addDays, weekdayOf, type AppointmentStatus } from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { cn } from '../../components/ui/cn';
import { errorMessage } from '../../lib/problem';
import { clinicDay, formatDayHeading, formatTime } from '../../lib/clinicTime';
import { useAgendaQuery } from '../appointments/api';
import { statusBadge, statusLabel } from '../appointments/status';

/**
 * "Calendar & Bookings": the month grid and the day beside it, from
 * `docs/prototype/desktop-01-overview.png`.
 *
 * ─── IT IS ONE QUERY, NOT THIRTY ────────────────────────────────────────────────
 *
 * The agenda endpoint answers `range=month` with the month's appointments and its status
 * counts, so the dots under each date are drawn by grouping ONE response by clinic day. A
 * query per day would be thirty requests to render a calendar.
 *
 * The day panel is a second query (`range=day`), because the month response is capped at the
 * page size and a clinic with a hundred appointments in a month would otherwise show a day
 * that looked empty.
 *
 * ─── THE GRID IS BUILT ON THE CLINIC'S CALENDAR ─────────────────────────────────
 *
 * Which day an appointment falls on is decided by the clinic's time zone, not the browser's:
 * an appointment at 23:45 in Kolkata is the 2nd there and the 1st in UTC, and a calendar that
 * disagreed with the list under it would be unexplainable.
 *
 * The weeks start on MONDAY, as the prototype's grid does and as the clinic's own week does.
 */

const WEEK_HEADINGS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'] as const;

const DOT_COLOURS: Record<AppointmentStatus, string> = {
  SCHEDULED: 'bg-warning',
  CONFIRMED: 'bg-success',
  COMPLETED: 'bg-accent',
  CANCELLED: 'bg-danger',
  NO_SHOW: 'bg-danger',
};

/**
 * The Monday on or before the first of the month, so the grid starts on a full week.
 *
 * `WEEKDAYS` from the shared package is Monday-first, which is also how the prototype's grid
 * and a clinic's week read, so the offset is simply the weekday's position in it.
 */
const gridStart = (monthStart: string): string =>
  addDays(monthStart, -WEEKDAYS.indexOf(weekdayOf(monthStart)));

const monthLabel = (day: string, timeZone: string): string =>
  new Intl.DateTimeFormat('en-IN', { timeZone, month: 'long', year: 'numeric' }).format(
    new Date(`${day}T06:00:00.000Z`),
  );

const shiftMonth = (day: string, by: number): string => {
  const [year, month] = day.split('-').map(Number) as [number, number];
  const moved = new Date(Date.UTC(year, month - 1 + by, 1));

  return moved.toISOString().slice(0, 10);
};

export const CalendarPanel = ({
  timeZone,
  today,
}: {
  readonly timeZone: string;
  readonly today: string;
}) => {
  const [monthStart, setMonthStart] = useState(() => `${today.slice(0, 7)}-01`);
  const [selected, setSelected] = useState(today);

  const month = useAgendaQuery({ range: 'month', on: monthStart });
  const day = useAgendaQuery({ range: 'day', on: selected });

  /**
   * The month's appointments grouped by the clinic day they fall on.
   *
   * Memoised because it runs over every appointment in the month on each render, and the
   * calendar re-renders whenever a day is selected.
   */
  const byDay = useMemo(() => {
    const grouped = new Map<string, AppointmentView[]>();

    for (const appointment of month.data?.appointments ?? []) {
      const key = clinicDay(appointment.startAt, timeZone);
      const existing = grouped.get(key);

      if (existing === undefined) {
        grouped.set(key, [appointment]);
      } else {
        existing.push(appointment);
      }
    }

    return grouped;
  }, [month.data, timeZone]);

  const days = useMemo(() => {
    const start = gridStart(monthStart);
    // Six weeks, which is what a month needs in the worst case and what the prototype draws.
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [monthStart]);

  return (
    <Card className="flex flex-col gap-4 p-0">
      <div className="flex flex-wrap items-center justify-between gap-3 px-6 pt-6">
        <div className="flex flex-col gap-0.5">
          <h2 className="m-0 font-semibold text-default text-md">Calendar &amp; bookings</h2>
          <p className="m-0 text-muted text-xs">{monthLabel(monthStart, timeZone)}</p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            kind="secondary"
            onClick={() => {
              setMonthStart(`${today.slice(0, 7)}-01`);
              setSelected(today);
            }}
          >
            Today
          </Button>
          <button
            type="button"
            aria-label="Previous month"
            onClick={() => {
              setMonthStart((current) => shiftMonth(current, -1));
            }}
            className="rounded-md border border-border p-2 text-muted hover:bg-background"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            aria-label="Next month"
            onClick={() => {
              setMonthStart((current) => shiftMonth(current, 1));
            }}
            className="rounded-md border border-border p-2 text-muted hover:bg-background"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className="px-6">
        {month.isError && (
          <Alert kind="danger">
            {errorMessage(month.error, 'The calendar could not be loaded.')}
          </Alert>
        )}

        {/*
         * A REAL TABLE, not a grid of divs with ARIA roles on them.
         *
         * The first version was `role="grid"` over a CSS grid, with the weekday headings and
         * the day cells as siblings. That is malformed: `grid` expects `row` children, so the
         * headings were not exposed as column headers at all and a screen reader was given a
         * flat list of 42 buttons with no sense of a week. A `<table>` gives the row and
         * column relationships for free, which is the same reason `Table.tsx` is a table.
         */}
        <table className="w-full table-fixed border-collapse">
          <caption className="sr-only">
            Appointments by day for {monthLabel(monthStart, timeZone)}
          </caption>
          <thead>
            <tr>
              {WEEK_HEADINGS.map((heading) => (
                <th
                  key={heading}
                  scope="col"
                  className="py-2 text-center font-semibold text-[0.6875rem] text-muted uppercase"
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
                  const appointments = byDay.get(date) ?? [];
                  const isToday = date === today;

                  return (
                    <td key={date} className="p-0.5">
                      <button
                        type="button"
                        aria-pressed={date === selected}
                        aria-label={`${date}, ${String(appointments.length)} appointments`}
                        onClick={() => {
                          setSelected(date);
                        }}
                        className={cn(
                          'flex h-14 w-full flex-col items-center justify-center gap-1 rounded-md border text-xs',
                          date === selected
                            ? 'border-accent bg-accent-surface font-semibold text-default'
                            : 'border-transparent hover:bg-background',
                          inMonth ? 'text-default' : 'text-subtle',
                          isToday && date !== selected && 'border-border font-semibold',
                        )}
                      >
                        <span>{Number(date.slice(-2))}</span>
                        <span className="flex h-1.5 items-center gap-0.5" aria-hidden="true">
                          {/*
                           * Three dots at most, because four in a cell this size is a smudge.
                           * The count is in the accessible name either way, so a screen
                           * reader is told the number rather than shown an approximation.
                           */}
                          {appointments.slice(0, 3).map((appointment) => (
                            <span
                              key={appointment.id}
                              className={cn(
                                'size-1.5 rounded-full',
                                DOT_COLOURS[appointment.status],
                              )}
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

        <ul className="m-0 mt-3 flex list-none flex-wrap gap-3 p-0">
          {(
            [
              ['CONFIRMED', 'Confirmed'],
              ['SCHEDULED', 'Pending'],
              ['COMPLETED', 'Completed'],
              ['CANCELLED', 'Cancelled'],
            ] as const
          ).map(([status, label]) => (
            <li key={status} className="flex items-center gap-1.5 text-muted text-xs">
              <span
                className={cn('size-1.5 rounded-full', DOT_COLOURS[status])}
                aria-hidden="true"
              />
              {label}
            </li>
          ))}
        </ul>
      </div>

      <div className="border-border border-t">
        <div className="flex flex-wrap items-center justify-between gap-3 px-6 py-4">
          <strong className="font-semibold text-default text-xs">
            {formatDayHeading(`${selected}T06:00:00.000Z`, 'UTC')}
          </strong>
          <span className="text-muted text-xs">
            {day.data === undefined
              ? '—'
              : `${String(day.data.appointments.length)} appointment${
                  day.data.appointments.length === 1 ? '' : 's'
                }`}
          </span>
        </div>

        {day.isFetching && (
          <div className="px-6 pb-4">
            <Spinner />
          </div>
        )}

        {day.data !== undefined && day.data.appointments.length === 0 && !day.isFetching && (
          <p className="m-0 px-6 pb-5 text-muted text-xs">Nothing booked on this day.</p>
        )}

        {day.data !== undefined && day.data.appointments.length > 0 && (
          <ul className="m-0 list-none p-0">
            {day.data.appointments.map((appointment) => (
              <li
                key={appointment.id}
                className="flex flex-wrap items-center justify-between gap-3 border-border border-t px-6 py-3"
              >
                <span className="flex items-center gap-3">
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
      </div>
    </Card>
  );
};
