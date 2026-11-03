import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { ChevronLeft, ChevronRight, Ellipsis, Plus } from 'lucide-react';
import type { AppointmentView } from '@clinicai/api-client';
import { addDays, weekdayOf, type AppointmentStatus } from '@clinicai/shared';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { cn } from '../../components/ui/cn';
import { clinicDay, formatTime } from '../../lib/clinicTime';
import { useClinic } from '../clinic/api';
import { useAgendaQuery, useAvailabilityQuery } from '../appointments/api';
import { statusBadge, statusLabel } from '../appointments/status';
import { Panel } from './cards';

/**
 * "Calendar & Bookings", from the design's node `1:820`: the month, the chosen day's
 * appointments and its next free times, in one 492px column.
 *
 * ─── SUNDAY FIRST, AS THE REFERENCE DRAWS IT ────────────────────────────────────
 *
 * The earlier calendar started on Monday, matching the clinic's working week. The reference
 * starts on Sunday, and it is the reference that was signed off, so the grid follows it.
 *
 * ─── ONE MONTH QUERY, NOT THIRTY ────────────────────────────────────────────────
 *
 * The dots come from one `range=month` response grouped by clinic day. The day list is its
 * own `range=day` request, because the month response is capped at a page and a busy day
 * would otherwise look empty.
 *
 * ─── THE DOTS ARE THE LEGEND'S FOUR, AND EVERY STATUS LANDS ON ONE ──────────────
 *
 *   AI Booking  blue    awaiting confirmation, booked by the agent
 *   Pending     orange  awaiting confirmation, booked by anybody else
 *   Confirmed   green   confirmed, and completed, which was confirmed and then happened
 *   Cancelled   red     cancelled, and a no-show, which is a cancellation nobody phoned in
 */

const WEEK = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] as const;
const SUNDAY_FIRST = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const DOT = {
  ai: '#356ae6',
  confirmed: '#20b486',
  pending: '#f3a64a',
  cancelled: '#ef5350',
} as const;

const dotFor = (appointment: AppointmentView): string => {
  const status: AppointmentStatus = appointment.status;

  if (status === 'CANCELLED' || status === 'NO_SHOW') {
    return DOT.cancelled;
  }
  if (status === 'CONFIRMED' || status === 'COMPLETED') {
    return DOT.confirmed;
  }
  return appointment.source === 'VOICE_AGENT' ? DOT.ai : DOT.pending;
};

const monthLabel = (day: string): string =>
  new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00.000Z`),
  );

const dayHeading = (day: string): string =>
  new Intl.DateTimeFormat('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${day}T12:00:00.000Z`));

const shiftMonth = (day: string, by: number): string => {
  const [year, month] = day.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(year, month - 1 + by, 1)).toISOString().slice(0, 10);
};

/** `9:00 AM`, as the reference writes a time, from the clinic's own clock. */
const clock = (instant: string, timeZone: string): string =>
  formatTime(instant, timeZone).toUpperCase();

export const CalendarCard = ({
  timeZone,
  today,
}: {
  readonly timeZone: string;
  readonly today: string;
}) => {
  const [monthStart, setMonthStart] = useState(() => `${today.slice(0, 7)}-01`);
  const [selected, setSelected] = useState(today);
  const { data: clinic } = useClinic();

  const month = useAgendaQuery({ range: 'month', on: monthStart });
  const day = useAgendaQuery({ range: 'day', on: selected });

  /**
   * The first active doctor and service, for the "Available Slots" row.
   *
   * The reference shows free times without asking which doctor or which service, which is
   * only meaningful when there is one of each: the pilot's shape. A clinic with several sees
   * the first of each here, and the full schedule on the appointments screen.
   */
  const doctor = clinic?.doctors.find((row) => row.active);
  const service = clinic?.services.find((row) => row.active);
  const slots = useAvailabilityQuery(
    { doctorId: doctor?.id ?? '', serviceId: service?.id ?? '', date: selected },
    { skip: doctor === undefined || service === undefined },
  );

  const byDay = useMemo(() => {
    const grouped = new Map<string, AppointmentView[]>();
    for (const appointment of month.data?.appointments ?? []) {
      const key = clinicDay(appointment.startAt, timeZone);
      grouped.set(key, [...(grouped.get(key) ?? []), appointment]);
    }
    return grouped;
  }, [month.data, timeZone]);

  const days = useMemo(() => {
    const offset = SUNDAY_FIRST.indexOf(weekdayOf(monthStart));
    const start = addDays(monthStart, -offset);
    return Array.from({ length: 42 }, (_, index) => addDays(start, index));
  }, [monthStart]);

  const appointments = day.data?.appointments ?? [];

  return (
    <Panel className="flex flex-col p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="m-0 font-bold text-[1.125rem] text-default tracking-[-0.35px]">
            Calendar &amp; Bookings
          </h2>
          <p className="m-0 pt-[5px] font-medium text-muted text-xs leading-3">
            Manage clinic availability and appointments
          </p>
        </div>
        <div className="flex gap-[7px]">
          <button
            type="button"
            onClick={() => {
              setMonthStart(`${today.slice(0, 7)}-01`);
              setSelected(today);
            }}
            className="h-[34px] rounded-control border border-border-chrome bg-surface px-[11px] font-semibold text-default text-xs hover:bg-background"
          >
            Today
          </button>
          <Link
            to="/appointments?book=1"
            className="flex h-[34px] items-center gap-2 rounded-control bg-accent px-[11px] font-semibold text-inverse text-xs shadow-accent hover:opacity-95"
          >
            <Plus size={18} aria-hidden="true" />
            New
          </Link>
        </div>
      </div>

      <div className="flex h-[54px] items-center gap-2">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => {
            setMonthStart((current) => shiftMonth(current, -1));
          }}
          className="grid size-7 place-items-center rounded-lg bg-[#f6f8fc] text-muted hover:text-default"
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <strong className="min-w-[104px] font-bold text-default text-sm">
          {monthLabel(monthStart)}
        </strong>
        <button
          type="button"
          aria-label="Next month"
          onClick={() => {
            setMonthStart((current) => shiftMonth(current, 1));
          }}
          className="grid size-7 place-items-center rounded-lg bg-[#f6f8fc] text-muted hover:text-default"
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
      </div>

      {/*
       * A REAL TABLE, ruled as the reference rules it: a hairline on every cell, the left and
       * top edges carried by the table itself so no line is drawn twice.
       */}
      <table className="w-full table-fixed border-collapse border-border-chrome border-t border-l">
        <caption className="sr-only">Appointments by day for {monthLabel(monthStart)}</caption>
        <thead>
          <tr>
            {WEEK.map((heading) => (
              <th
                key={heading}
                scope="col"
                className="h-[25px] border-border-chrome border-r border-b font-bold text-muted text-xs uppercase"
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
                const isSelected = date === selected;

                return (
                  <td
                    key={date}
                    className={cn(
                      'h-[44px] border-border-chrome border-r border-b p-0 align-top',
                      inMonth ? 'bg-surface' : 'bg-[#fbfcfe]',
                    )}
                  >
                    <button
                      type="button"
                      aria-pressed={isSelected}
                      aria-label={`${date}, ${String(dots.length)} appointments`}
                      onClick={() => {
                        setSelected(date);
                      }}
                      className="relative block h-[44px] w-full px-1.5 py-[5px] text-left"
                    >
                      {isSelected && (
                        <span
                          aria-hidden="true"
                          className="absolute top-[5px] left-1.5 size-8 rounded-lg bg-[rgba(53,106,230,0.3)] shadow-[0px_4px_8px_0px_rgba(53,106,230,0.2)]"
                        />
                      )}
                      <span
                        className={cn(
                          'relative pl-1 text-xs',
                          isSelected
                            ? 'font-bold text-default'
                            : inMonth
                              ? 'font-semibold text-default'
                              : 'font-semibold text-[#bbc2d0]',
                        )}
                      >
                        {Number(date.slice(-2))}
                      </span>
                      <span
                        aria-hidden="true"
                        className="absolute top-[34px] left-[7px] flex gap-0.5"
                      >
                        {/* Three at most: a fourth in a cell this size is a smudge, and the
                            exact count is in the button's accessible name. */}
                        {dots.slice(0, 3).map((appointment) => (
                          <span
                            key={appointment.id}
                            className="size-1 rounded-[2px]"
                            style={{ backgroundColor: dotFor(appointment) }}
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

      <ul className="m-0 flex h-7 list-none items-center justify-center gap-[15px] p-0">
        {(
          [
            [DOT.ai, 'AI Booking'],
            [DOT.confirmed, 'Confirmed'],
            [DOT.pending, 'Pending'],
            [DOT.cancelled, 'Cancelled'],
          ] as const
        ).map(([colour, label]) => (
          <li key={label} className="flex items-center gap-1 font-medium text-muted text-xs">
            <span className="size-1 rounded-[2px]" style={{ backgroundColor: colour }} />
            {label}
          </li>
        ))}
      </ul>

      <section className="border-border-chrome border-t pt-[13px]">
        <div className="flex items-center justify-between">
          <h3 className="m-0 font-bold text-default text-[0.8125rem]">{dayHeading(selected)}</h3>
          <span className="text-muted text-xs">
            {day.data === undefined
              ? ''
              : `${String(appointments.length)} appointment${appointments.length === 1 ? '' : 's'}`}
          </span>
        </div>

        {day.isFetching && day.data === undefined && (
          <div className="py-4">
            <Spinner />
          </div>
        )}

        {day.data !== undefined && appointments.length === 0 && (
          <p className="m-0 py-4 text-muted text-xs">Nothing booked on this day.</p>
        )}

        <ul className="m-0 flex list-none flex-col p-0">
          {appointments.map((appointment) => (
            <li
              key={appointment.id}
              className="flex items-center justify-between gap-3 border-border-chrome border-b py-3"
            >
              <span className="flex min-w-0 items-start gap-3">
                <strong className="w-[60px] shrink-0 font-bold text-default text-xs">
                  {clock(appointment.startAt, timeZone)}
                </strong>
                <span className="flex min-w-0 flex-col gap-0.5">
                  <strong className="truncate font-bold text-default text-xs">
                    {appointment.patient.fullName ?? 'Name hidden'}
                  </strong>
                  <span className="truncate text-muted text-xs">
                    {appointment.doctor.fullName}
                    {appointment.service === null ? '' : ` · ${appointment.service.name}`}
                  </span>
                </span>
              </span>
              <span className="flex shrink-0 items-center gap-2">
                <Badge kind={statusBadge(appointment.status)}>
                  {statusLabel(appointment.status, appointment.source)}
                </Badge>
                <Link
                  to="/appointments"
                  aria-label={`Open ${appointment.patient.fullName ?? 'this appointment'}`}
                  className="text-subtle hover:text-default"
                >
                  <Ellipsis size={16} aria-hidden="true" />
                </Link>
              </span>
            </li>
          ))}
        </ul>
      </section>

      <section className="pt-5">
        <div className="flex items-center justify-between">
          <h3 className="m-0 font-bold text-default text-[0.8125rem]">Available Slots</h3>
          <Link
            to="/appointments"
            className="rounded-control border border-accent-contrast px-2.5 py-2 font-semibold text-accent text-xs hover:bg-accent-surface"
          >
            View Full Schedule
          </Link>
        </div>

        {(doctor === undefined || service === undefined) && (
          <p className="m-0 pt-3 text-muted text-xs">
            Add a doctor and a service to see free times here.
          </p>
        )}

        {slots.data !== undefined && slots.data.slots.length === 0 && (
          <p className="m-0 pt-3 text-muted text-xs">No free times on this day.</p>
        )}

        <div className="grid grid-cols-2 gap-2.5 pt-3">
          {(slots.data?.slots ?? []).slice(0, 2).map((slot) => (
            <div
              key={slot.startAt}
              className="flex items-center justify-between rounded-control border border-border-chrome px-2.5 py-2.5"
            >
              <span className="flex flex-col gap-0.5">
                <strong className="font-bold text-default text-xs">
                  {clock(slot.startAt, timeZone)} · {slots.data?.durationMinutes ?? 0} min
                </strong>
                <span className="font-medium text-[#20b486] text-xs">Available</span>
              </span>
              <Link
                to="/appointments?book=1"
                className="rounded-md bg-accent-surface px-2 py-1 font-bold text-accent text-xs"
              >
                Book
              </Link>
            </div>
          ))}
        </div>
      </section>
    </Panel>
  );
};
