import type { ReactNode } from 'react';
import type { OverviewRange, OverviewResult, SarvamMappingView } from '@clinicai/api-client';
import { AudioLines, CalendarCheck, Headset, PhoneIncoming, Percent } from 'lucide-react';
import { Badge, type BadgeKind } from '../../components/ui/Table';
import { cn } from '../../components/ui/cn';
import { formatDateTime } from '../../lib/clinicTime';
import { formatPhone } from '../../lib/phone';
import { Change, Panel, PeriodSelect } from '../overview/cards';
import { Sparkline } from '../overview/charts';

/**
 * The voice agent's dashboard, at the top of Call History.
 *
 * ─── WHERE EACH FIGURE COMES FROM ───────────────────────────────────────────────
 *
 * The agent's identity (its number, the Sarvam app version, the prompt version) is the
 * clinic's Sarvam mapping, which is configuration and names no patient. Its status, its last
 * call and every count are the overview endpoint's, the same numbers the overview shows, so
 * the two screens cannot disagree. Nothing here is computed from the page of calls below it,
 * which is paged and filtered and would make the counts move with the search box.
 *
 * ─── THE STATUS IS NEVER INFERRED ───────────────────────────────────────────────
 *
 * "Live" is shown only when the platform records the agent as active. A clinic with no
 * Sarvam mapping is "Not connected", whatever its call log holds, because a receptionist
 * reading "Live" will stop answering the phone.
 */

type AgentStatus = OverviewResult['agent']['status'];

const STATUS: Record<
  'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | 'NONE',
  { label: string; kind: BadgeKind }
> = {
  ACTIVE: { label: 'Live', kind: 'success' },
  SUSPENDED: { label: 'Paused', kind: 'warning' },
  DEACTIVATED: { label: 'Switched off', kind: 'danger' },
  NONE: { label: 'Not connected', kind: 'neutral' },
};

const Detail = ({ label, children }: { readonly label: string; readonly children: ReactNode }) => (
  <div className="flex min-w-0 flex-col gap-1">
    <dt className="text-muted text-xs">{label}</dt>
    <dd className="m-0 truncate font-semibold text-default text-sm">{children}</dd>
  </div>
);

export const AgentCard = ({
  mapping,
  status,
  lastCallAt,
  timeZone,
  range,
  onRangeChange,
}: {
  readonly mapping: SarvamMappingView | null;
  /** Undefined for a role that may not read analytics: the status is then not shown at all. */
  readonly status: AgentStatus | undefined;
  readonly lastCallAt: string | null | undefined;
  readonly timeZone: string;
  readonly range: OverviewRange | undefined;
  readonly onRangeChange: (next: OverviewRange) => void;
}) => {
  const state = mapping === null ? STATUS.NONE : STATUS[status ?? 'NONE'];

  return (
    <Panel
      className="mb-4 px-6 py-5"
      style={{
        backgroundImage: 'linear-gradient(120deg, rgb(255, 255, 255) 45%, rgb(234, 241, 255) 100%)',
      }}
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <span
            aria-hidden="true"
            className="grid size-12 shrink-0 place-items-center rounded-lg bg-accent text-inverse shadow-accent"
          >
            <AudioLines size={22} />
          </span>
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-2">
              <h2 className="m-0 font-bold text-default text-lg">AI Receptionist</h2>
              {status !== undefined && <Badge kind={state.kind}>{state.label}</Badge>}
            </div>
            <p className="m-0 text-muted text-xs">
              Voice agent powered by Sarvam. It answers, books, reschedules and cancels, and never
              gives clinical advice.
            </p>
          </div>
        </div>
        {range !== undefined && <PeriodSelect value={range} onChange={onRangeChange} />}
      </div>

      <dl className="m-0 mt-5 grid grid-cols-2 gap-4 border-border-chrome border-t pt-4 md:grid-cols-4">
        <Detail label="Agent number">
          {mapping?.agentPhone == null ? 'Not assigned' : formatPhone(mapping.agentPhone)}
        </Detail>
        <Detail label="Last call">
          {lastCallAt == null ? 'No calls yet' : formatDateTime(lastCallAt, timeZone)}
        </Detail>
        <Detail label="Sarvam app version">{mapping?.sarvamAppVersion ?? 'Not set'}</Detail>
        <Detail label="Prompt version">{mapping?.promptVersion ?? 'Not set'}</Detail>
      </dl>
    </Panel>
  );
};

const Metric = ({
  label,
  icon,
  tile,
  value,
  detail,
  trend,
  colour,
}: {
  readonly label: string;
  readonly icon: ReactNode;
  readonly tile: string;
  readonly value: string;
  readonly detail: ReactNode;
  readonly trend?: readonly number[] | undefined;
  readonly colour?: string | undefined;
}) => (
  <Panel className="relative min-h-[118px] overflow-hidden px-[18px] py-[17px]">
    <div className="flex items-start justify-between">
      <h3 className="m-0 font-semibold text-default text-xs">{label}</h3>
      <span
        aria-hidden="true"
        className={cn('grid size-[30px] place-items-center rounded-md', tile)}
      >
        {icon}
      </span>
    </div>
    <p className="m-0 pt-1 font-bold text-[1.75rem] text-default leading-[34px] tracking-[-0.5px]">
      {value}
    </p>
    <p className="m-0 pr-20 text-xs">{detail}</p>
    {trend !== undefined && colour !== undefined && (
      <span className="absolute right-3 bottom-3">
        <Sparkline values={trend} colour={colour} />
      </span>
    )}
  </Panel>
);

/**
 * Bookings over answered calls. Undefined with no calls, because 0 of 0 is not 0%.
 */
export const bookingRate = (overview: OverviewResult): number | undefined =>
  overview.kpis.callsAnswered.value === 0
    ? undefined
    : Math.round((overview.kpis.aiBookings.value / overview.kpis.callsAnswered.value) * 100);

export const VoiceMetrics = ({ overview }: { readonly overview: OverviewResult | undefined }) => {
  const rate = overview === undefined ? undefined : bookingRate(overview);

  return (
    <div className="mb-4 grid grid-cols-2 gap-4 xl:grid-cols-4">
      <Metric
        label="Calls answered"
        icon={<PhoneIncoming size={17} />}
        tile="bg-accent-surface text-accent"
        value={overview === undefined ? '—' : String(overview.kpis.callsAnswered.value)}
        detail={
          overview === undefined ? null : (
            <Change metric={overview.kpis.callsAnswered} range={overview.range} />
          )
        }
        trend={overview?.daily.map((day) => day.callsAnswered)}
        colour="#356AE6"
      />
      <Metric
        label="Booked by the agent"
        icon={<CalendarCheck size={17} />}
        tile="bg-[#f0ecff] text-[#8b6ae8]"
        value={overview === undefined ? '—' : String(overview.kpis.aiBookings.value)}
        detail={
          overview === undefined ? null : (
            <Change metric={overview.kpis.aiBookings} range={overview.range} />
          )
        }
        trend={overview?.daily.map((day) => day.aiBookings)}
        colour="#8B6AE8"
      />
      <Metric
        label="Booking rate"
        icon={<Percent size={17} />}
        tile="bg-success-surface text-success"
        value={rate === undefined ? '—' : `${String(rate)}%`}
        detail={<span className="text-muted">of answered calls ended in a booking</span>}
      />
      <Metric
        label="Handed to staff"
        icon={<Headset size={17} />}
        tile="bg-warning-surface text-warning"
        value={overview === undefined ? '—' : String(overview.outcomes.TRANSFERRED)}
        detail={<span className="text-muted">calls the agent passed to a person</span>}
      />
    </div>
  );
};
