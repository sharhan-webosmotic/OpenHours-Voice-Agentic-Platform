import { useState } from 'react';
import { Link } from 'react-router';
import type { OverviewRange } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { useAuth } from '../../app/AuthProvider';
import { errorMessage } from '../../lib/problem';
import { clinicToday, formatDate, formatTime } from '../../lib/clinicTime';
import { useClinic } from '../clinic/api';
import { useAppointmentsQuery } from '../appointments/api';
import { statusBadge, statusLabel } from '../appointments/status';
import { useCallsQuery } from '../calls/api';
import {
  callerLabel,
  durationLabel,
  statusBadge as callBadge,
  statusLabel as callStatus,
} from '../calls/status';
import { useOverviewQuery } from './api';
import { CalendarCard } from './CalendarCard';
import { ActivityCard, HeroCard, KpiRow, OutcomesCard, Panel, RevenueCard } from './cards';

/**
 * The Overview, as the dashboard design lays it out and as the clinic's reference crops show.
 *
 * ─── THE GRID IS THE EXPORT'S ───────────────────────────────────────────────────
 *
 * `grid-cols-[minmax(0,1fr)_492px]` with a 16px gap: everything on the left flexes and the
 * calendar keeps the 492px the design gives it. Below 1280px the calendar drops under the
 * rest rather than squeezing the cards, because a calendar at 300px wide is a calendar
 * nobody can tap.
 *
 * ─── WHERE EACH NUMBER COMES FROM ───────────────────────────────────────────────
 *
 * The cards from `GET /api/v1/analytics/overview`. The calendar from the agenda and the
 * availability endpoints. The two tables at the foot from the call list and the appointment
 * list, which are the PHI-bearing reads and are audited as such.
 */

/** The first name, as a greeting uses it: "Priya Shah" greets Priya. */
const firstName = (fullName: string): string => fullName.trim().split(/\s+/)[0] ?? fullName;

export const OverviewPage = () => {
  const { user } = useAuth();
  const { data: clinic, isLoading: clinicLoading } = useClinic();
  const [range, setRange] = useState<OverviewRange>('7d');
  const now = new Date();

  const timeZone = clinic?.organisation.timezone ?? 'UTC';
  const today = clinicLoading ? '' : clinicToday(timeZone);

  const overview = useOverviewQuery({ range }, { skip: clinicLoading });

  if (clinicLoading || today === '') {
    return <Spinner />;
  }

  return (
    <>
      {/*
       * The page's own heading, visually hidden. The design opens on the greeting card with
       * no title above it, and a page still needs a landmark heading named after it.
       */}
      <h1 className="sr-only">Overview</h1>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_492px]">
        <div className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-wrap gap-4">
            <HeroCard
              personName={firstName(user?.fullName ?? '')}
              timeZone={timeZone}
              agent={overview.data?.agent}
              range={range}
              onRangeChange={setRange}
              now={now}
            />
            <RevenueCard overview={overview.data} />
          </div>

          {overview.isError && (
            <div className="flex flex-col items-start gap-3">
              <Alert kind="danger">
                {errorMessage(overview.error, 'The overview figures could not be loaded.')}
              </Alert>
              <Button
                kind="secondary"
                onClick={() => {
                  void overview.refetch();
                }}
              >
                Try again
              </Button>
            </div>
          )}

          <KpiRow overview={overview.data} range={range} />

          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_420px]">
            <ActivityCard overview={overview.data} />
            <OutcomesCard overview={overview.data} />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <RecentCalls timeZone={timeZone} />
            <UpcomingAppointments timeZone={timeZone} now={now} />
          </div>
        </div>

        <CalendarCard timeZone={timeZone} today={today} />
      </div>
    </>
  );
};

/** "Recent AI Calls", from the design's foot: the four newest, newest first. */
const RecentCalls = ({ timeZone }: { readonly timeZone: string }) => {
  const { data, isLoading } = useCallsQuery({ limit: 4 });

  return (
    <Panel className="p-5">
      <TableHeading
        title="Recent AI Calls"
        subtitle="Latest conversations handled by ClinicAI"
        to="/calls"
      />

      {isLoading && <Spinner />}

      {data !== undefined && data.items.length === 0 && (
        <p className="m-0 py-6 text-center text-muted text-xs">
          No calls yet. Calls answered by the AI receptionist will appear here.
        </p>
      )}

      {data !== undefined && data.items.length > 0 && (
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">The four most recent calls</caption>
          <thead>
            <tr className="text-muted">
              <th className="py-2 font-semibold">Time</th>
              <th className="py-2 font-semibold">Caller</th>
              <th className="py-2 font-semibold">Outcome</th>
              <th className="py-2 font-semibold">Duration</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((call) => (
              <tr key={call.id} className="border-border-chrome border-t">
                <td className="py-2.5 text-muted">
                  {formatTime(call.startedAt ?? call.createdAt, timeZone).toUpperCase()}
                </td>
                <td className="py-2.5 font-semibold text-default">{callerLabel(call)}</td>
                <td className="py-2.5">
                  <Badge kind={callBadge(call.status)}>{callStatus(call.status)}</Badge>
                </td>
                <td className="py-2.5 text-muted">{durationLabel(call.durationSeconds)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
};

/** "Upcoming Appointments", from the design's foot: the next four from now. */
const UpcomingAppointments = ({
  timeZone,
  now,
}: {
  readonly timeZone: string;
  readonly now: Date;
}) => {
  const { data, isLoading } = useAppointmentsQuery({
    from: now.toISOString(),
    status: ['SCHEDULED', 'CONFIRMED'],
    limit: 4,
  });

  return (
    <Panel className="p-5">
      <TableHeading
        title="Upcoming Appointments"
        subtitle="Next confirmed and pending visits"
        to="/appointments"
      />

      {isLoading && <Spinner />}

      {data !== undefined && data.items.length === 0 && (
        <p className="m-0 py-6 text-center text-muted text-xs">Nothing upcoming is booked.</p>
      )}

      {data !== undefined && data.items.length > 0 && (
        <table className="w-full border-collapse text-left text-xs">
          <caption className="sr-only">The next four appointments</caption>
          <thead>
            <tr className="text-muted">
              <th className="py-2 font-semibold">Time</th>
              <th className="py-2 font-semibold">Patient</th>
              <th className="py-2 font-semibold">Service</th>
              <th className="py-2 font-semibold">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((appointment) => (
              <tr key={appointment.id} className="border-border-chrome border-t">
                <td className="py-2.5 text-muted">
                  {formatDate(appointment.startAt, timeZone)},{' '}
                  {formatTime(appointment.startAt, timeZone).toUpperCase()}
                </td>
                <td className="py-2.5 font-semibold text-default">
                  {appointment.patient.fullName ?? 'Name hidden'}
                </td>
                <td className="py-2.5 text-muted">{appointment.service?.name ?? '—'}</td>
                <td className="py-2.5">
                  <Badge kind={statusBadge(appointment.status)}>
                    {statusLabel(appointment.status, appointment.source)}
                  </Badge>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
};

const TableHeading = ({
  title,
  subtitle,
  to,
}: {
  readonly title: string;
  readonly subtitle: string;
  readonly to: string;
}) => (
  <div className="mb-3 flex items-start justify-between">
    <div>
      <h2 className="m-0 font-bold text-default text-md tracking-[-0.25px]">{title}</h2>
      <p className="m-0 pt-[5px] text-muted text-xs">{subtitle}</p>
    </div>
    <Link to={to} className="font-bold text-accent text-xs hover:underline">
      View all →
    </Link>
  </div>
);
