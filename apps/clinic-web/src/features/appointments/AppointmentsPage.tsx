import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import type { AppointmentView } from '@clinicai/api-client';
import {
  APPOINTMENT_STATUSES,
  addDays,
  isClinicDay,
  startOfClinicDay,
  type ClinicDay,
} from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Badge, Cell, Row, Table } from '../../components/ui/Table';
import { DateInput, FilterSelect, Pager, SearchInput } from '../../components/ui/Toolbar';
import { cn } from '../../components/ui/cn';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import { clinicToday, formatIsoDay, formatTime24 } from '../../lib/clinicTime';
import { useClinic } from '../clinic/api';
import { AppointmentDetail } from './AppointmentDetail';
import { BookingForm } from './BookingForm';
import { RescheduleForm } from './RescheduleForm';
import { useAppointmentsQuery } from './api';
import { statusBadge, statusLabel } from './status';
import { DayView, MonthView, WeekView, weekStart } from './views';

/**
 * Appointments, as the clinic's reference draws it: one toolbar and four views of the same
 * book, Month, Week, Day and List.
 *
 * ─── THE VIEW AND THE DAY LIVE IN THE ADDRESS ───────────────────────────────────
 *
 * `?view=week&date=2026-11-03`, so a reload, a back button or a link a colleague sends lands
 * on the same view of the same day (apps/clinic-web/CLAUDE.md: the URL holds filters, page
 * and selected date, never patient data).
 *
 * ─── WHAT THE ARROWS MOVE ───────────────────────────────────────────────────────
 *
 * A month in Month and List, a week in Week, a day in Day. The list is scoped to the month
 * the toolbar names, which is what makes its title and its arrows mean something; choosing a
 * date in its filter bar narrows that to one day.
 */

const VIEWS = ['month', 'week', 'day', 'list'] as const;
type View = (typeof VIEWS)[number];

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  ...APPOINTMENT_STATUSES.map((status) => ({
    value: status,
    label: status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' '),
  })),
];

const monthTitle = (day: ClinicDay): string =>
  new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric', timeZone: 'UTC' }).format(
    new Date(`${day}T12:00:00.000Z`),
  );

/** "May 18 – May 24, 2025", as the reference titles a week. */
const weekTitle = (day: ClinicDay): string => {
  const sunday = weekStart(day);
  const saturday = addDays(sunday, 6);
  const short = (value: ClinicDay): string =>
    new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }).format(
      new Date(`${value}T12:00:00.000Z`),
    );

  return `${short(sunday)} – ${short(saturday)}, ${saturday.slice(0, 4)}`;
};

/** A month forward or back, keeping the day of the month where the target month has it. */
const shiftMonth = (day: ClinicDay, by: number): ClinicDay => {
  const [year, month, dayOfMonth] = day.split('-').map(Number) as [number, number, number];
  const lastDay = new Date(Date.UTC(year, month - 1 + by + 1, 0)).getUTCDate();
  return new Date(Date.UTC(year, month - 1 + by, Math.min(dayOfMonth, lastDay)))
    .toISOString()
    .slice(0, 10);
};

export const AppointmentsPage = () => {
  const { data: clinic, isLoading: clinicLoading } = useClinic();
  const timeZone = clinic?.organisation.timezone ?? 'UTC';
  const canWrite = useCan('appointments', 'write');
  const today = clinicLoading ? '' : clinicToday(timeZone);

  const [params, setParams] = useSearchParams();

  const viewParam = params.get('view');
  const view: View = VIEWS.includes(viewParam as View) ? (viewParam as View) : 'list';
  const dateParam = params.get('date') ?? '';
  const anchor: ClinicDay = isClinicDay(dateParam) ? dateParam : today;

  const navigate = (next: { readonly view?: View; readonly date?: ClinicDay }): void => {
    const updated = new URLSearchParams(params);
    if (next.view !== undefined) {
      updated.set('view', next.view);
    }
    if (next.date !== undefined) {
      updated.set('date', next.date);
    }
    setParams(updated, { replace: true });
  };

  const [search, setSearch] = useState('');
  const [debounced, setDebounced] = useState('');
  const [day, setDay] = useState('');
  const [status, setStatus] = useState('');
  const [cursors, setCursors] = useState<readonly (string | undefined)[]>([undefined]);
  const [selected, setSelected] = useState<AppointmentView | undefined>(undefined);
  const [rescheduling, setRescheduling] = useState<AppointmentView | undefined>(undefined);

  /**
   * The booking sheet opens from a link as well as from the button.
   *
   * A patient's profile links here with `?book=1&patientId=`, and the header's New
   * Appointment with `?book=1`. The parameter is cleared as soon as it is read, so a refresh
   * does not reopen the sheet.
   */
  const bookingFromLink = params.get('book') === '1';
  const [booking, setBooking] = useState<{ readonly day?: ClinicDay } | undefined>(
    bookingFromLink ? {} : undefined,
  );
  const initialPatientId = params.get('patientId') ?? undefined;

  if (bookingFromLink) {
    const next = new URLSearchParams(params);
    next.delete('book');
    setParams(next, { replace: true });
  }

  useEffect(() => {
    // 300ms, the same as the patient list: below laggy, above the rate a person types.
    const timer = setTimeout(() => {
      setDebounced(search);
    }, 300);

    return () => {
      clearTimeout(timer);
    };
  }, [search]);

  useEffect(() => {
    // A new filter starts a new sequence of pages: the old cursor points at a row the new
    // filter may not return.
    setCursors([undefined]);
  }, [debounced, day, status, anchor]);

  const cursor = cursors[cursors.length - 1];
  const filtered = debounced !== '' || day !== '' || status !== '';
  const monthStart = anchor === '' ? '' : `${anchor.slice(0, 7)}-01`;

  /**
   * The list's window: the day chosen in its filter, or else the month the toolbar names.
   * Converted to instants here because the list endpoint takes instants, and only the
   * clinic's zone says which instants a clinic day is.
   */
  const period =
    day !== ''
      ? { from: day, to: addDays(day, 1) }
      : monthStart === ''
        ? undefined
        : { from: monthStart, to: shiftMonth(monthStart, 1) };

  const list = useAppointmentsQuery(
    {
      ...(debounced === '' ? {} : { q: debounced }),
      ...(period === undefined
        ? {}
        : {
            from: startOfClinicDay(period.from, timeZone).toISOString(),
            to: startOfClinicDay(period.to, timeZone).toISOString(),
          }),
      ...(status === '' ? {} : { status: [status] as never }),
      ...(initialPatientId === undefined ? {} : { patientId: initialPatientId }),
      cursor,
      limit: PAGE_SIZE,
    },
    { skip: clinicLoading || view !== 'list' },
  );

  const step = (by: number): void => {
    navigate({
      date:
        view === 'week'
          ? addDays(anchor, by * 7)
          : view === 'day'
            ? addDays(anchor, by)
            : shiftMonth(anchor, by),
    });
  };

  const openBooking = canWrite
    ? (date?: ClinicDay) => {
        setBooking(date === undefined ? {} : { day: date });
      }
    : undefined;

  const doctors = (clinic?.doctors ?? []).filter((doctor) => doctor.active);

  if (clinicLoading || anchor === '') {
    return <Spinner />;
  }

  return (
    <div className="flex flex-col gap-4">
      {/* The reference's toolbar: arrows and Today, the period, and the four views. */}
      <Card
        padded={false}
        className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5"
      >
        <div className="flex items-center gap-2">
          <button
            type="button"
            aria-label="Previous"
            onClick={() => {
              step(-1);
            }}
            className="grid size-[38px] place-items-center rounded-control border border-border-chrome bg-surface text-default hover:bg-background"
          >
            <ChevronLeft size={16} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={() => {
              navigate({ date: today });
            }}
            className="h-[38px] rounded-control border border-border-chrome bg-surface px-4 font-semibold text-default text-sm hover:bg-background"
          >
            Today
          </button>
          <button
            type="button"
            aria-label="Next"
            onClick={() => {
              step(1);
            }}
            className="grid size-[38px] place-items-center rounded-control border border-border-chrome bg-surface text-default hover:bg-background"
          >
            <ChevronRight size={16} aria-hidden="true" />
          </button>
          <strong className="ml-3 font-bold text-[1.0625rem] text-default">
            {view === 'week' ? weekTitle(anchor) : monthTitle(anchor)}
          </strong>
        </div>

        <div
          role="tablist"
          aria-label="Calendar view"
          className="flex rounded-[12px] bg-background p-1"
        >
          {VIEWS.map((option) => (
            <button
              key={option}
              type="button"
              role="tab"
              aria-selected={view === option}
              onClick={() => {
                navigate({ view: option });
              }}
              className={cn(
                'h-8 rounded-[9px] px-3.5 text-sm capitalize',
                view === option
                  ? 'bg-surface font-medium text-accent shadow-popover'
                  : 'text-muted hover:text-default',
              )}
            >
              {option}
            </button>
          ))}
        </div>
      </Card>

      {view === 'month' && (
        <MonthView
          anchor={anchor}
          today={today}
          timeZone={timeZone}
          onSelectDay={(date) => {
            navigate({ date });
          }}
          onOpen={setSelected}
          onBook={openBooking}
          hours={clinic?.hours ?? []}
        />
      )}

      {view === 'week' && (
        <WeekView
          anchor={anchor}
          today={today}
          timeZone={timeZone}
          onSelectDay={(date) => {
            navigate({ date });
          }}
          onOpen={setSelected}
          onBook={openBooking}
          hours={clinic?.hours ?? []}
        />
      )}

      {view === 'day' && (
        <DayView
          anchor={anchor}
          today={today}
          timeZone={timeZone}
          onSelectDay={(date) => {
            navigate({ date });
          }}
          onOpen={setSelected}
          onBook={openBooking}
          hours={clinic?.hours ?? []}
          // The reference names the doctor beside the hours. With several, it would be a
          // guess which one, so the name appears only when there is exactly one.
          doctorName={doctors.length === 1 ? doctors[0]?.fullName : undefined}
        />
      )}

      {view === 'list' && (
        <>
          <Card
            padded={false}
            className="flex flex-wrap items-end justify-between gap-3 px-4 py-3.5"
          >
            <div className="min-w-[260px] flex-1 sm:max-w-[310px]">
              <SearchInput
                label="Search appointments"
                placeholder="Search patient or contact"
                value={search}
                onChange={setSearch}
              />
            </div>
            <div className="flex flex-wrap items-end gap-3">
              <DateInput
                label="Date"
                value={day}
                onChange={(value) => {
                  setDay(value);
                }}
              />
              <FilterSelect
                label="Status"
                value={status}
                onChange={(value) => {
                  setStatus(value);
                }}
                options={STATUS_OPTIONS}
              />
              {canWrite && (
                <button
                  type="button"
                  onClick={() => {
                    setBooking({});
                  }}
                  className="flex h-10 items-center gap-1.5 rounded-control bg-accent px-4 font-semibold text-inverse text-sm shadow-accent hover:opacity-95"
                >
                  <Plus size={16} aria-hidden="true" />
                  New Appointment
                </button>
              )}
            </div>
          </Card>

          {list.isLoading && <Spinner />}

          {list.isError && (
            <div className="flex flex-col items-start gap-3">
              <Alert kind="danger">
                {errorMessage(list.error, 'The appointments could not be loaded.')}
              </Alert>
              <Button
                kind="secondary"
                onClick={() => {
                  void list.refetch();
                }}
              >
                Try again
              </Button>
            </div>
          )}

          {list.data !== undefined && list.data.items.length === 0 && (
            /**
             * TWO DIFFERENT EMPTY STATES: a month with nothing in it is a month to book, and a
             * filter that matched nothing is a filter to clear.
             */
            <EmptyState
              title={filtered ? 'Nothing matches that filter' : 'No appointments this month'}
              body={
                filtered
                  ? 'No appointment matches what you have selected. Clearing the filters shows the rest of the month.'
                  : 'Nothing is booked in this month. Bookings made here and by the AI receptionist appear as soon as they are made.'
              }
              action={
                filtered ? (
                  <Button
                    kind="secondary"
                    onClick={() => {
                      setSearch('');
                      setDay('');
                      setStatus('');
                    }}
                  >
                    Clear the filters
                  </Button>
                ) : canWrite ? (
                  <Button
                    onClick={() => {
                      setBooking({});
                    }}
                  >
                    ＋ New Appointment
                  </Button>
                ) : undefined
              }
            />
          )}

          {list.data !== undefined && list.data.items.length > 0 && (
            <>
              <Table
                caption="Appointments in this period, soonest first"
                head={['Date & time', 'Patient', 'Doctor', 'Service', 'Status', 'Actions']}
              >
                {list.data.items.map((appointment) => (
                  <Row key={appointment.id}>
                    <Cell>
                      <span className="flex flex-col gap-1">
                        <strong className="font-semibold text-default">
                          {formatIsoDay(appointment.startAt, timeZone)}
                        </strong>
                        <small className="text-muted text-xs">
                          {formatTime24(appointment.startAt, timeZone)}
                        </small>
                      </span>
                    </Cell>
                    <Cell>{appointment.patient.fullName ?? 'Name hidden'}</Cell>
                    <Cell>{appointment.doctor.fullName}</Cell>
                    <Cell muted={appointment.service === null}>
                      {appointment.service?.name ?? 'No service'}
                    </Cell>
                    <Cell>
                      <Badge kind={statusBadge(appointment.status, appointment.source)}>
                        {statusLabel(appointment.status, appointment.source)}
                      </Badge>
                    </Cell>
                    <Cell>
                      <button
                        type="button"
                        className="font-semibold text-accent text-[0.8125rem] hover:underline"
                        onClick={() => {
                          setSelected(appointment);
                        }}
                      >
                        View details
                      </button>
                    </Cell>
                  </Row>
                ))}
              </Table>

              <div className="flex flex-wrap items-center justify-between gap-3">
                <Pager
                  page={cursors.length}
                  hasNext={list.data.nextCursor !== null}
                  busy={list.isFetching}
                  onPrevious={() => {
                    setCursors((previous) => previous.slice(0, -1));
                  }}
                  onNext={() => {
                    setCursors((previous) =>
                      list.data?.nextCursor === null || list.data?.nextCursor === undefined
                        ? previous
                        : [...previous, list.data.nextCursor],
                    );
                  }}
                />
                <span className="text-muted text-xs">
                  Showing {list.data.items.length} appointment
                  {list.data.items.length === 1 ? '' : 's'}
                </span>
              </div>
            </>
          )}
        </>
      )}

      {selected !== undefined && (
        <AppointmentDetail
          appointment={selected}
          timeZone={timeZone}
          onClose={() => {
            setSelected(undefined);
          }}
          onReschedule={() => {
            setRescheduling(selected);
            setSelected(undefined);
          }}
        />
      )}

      {rescheduling !== undefined && (
        <RescheduleForm
          appointment={rescheduling}
          timeZone={timeZone}
          onClose={() => {
            setRescheduling(undefined);
          }}
        />
      )}

      {booking !== undefined && (
        <BookingForm
          initialPatientId={initialPatientId}
          initialDate={booking.day}
          onClose={() => {
            setBooking(undefined);
          }}
        />
      )}
    </div>
  );
};
