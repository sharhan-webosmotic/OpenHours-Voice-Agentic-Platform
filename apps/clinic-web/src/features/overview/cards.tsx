import type { ReactNode } from 'react';
import {
  CalendarDays,
  ChevronDown,
  Inbox,
  Phone,
  TriangleAlert,
  type LucideIcon,
} from 'lucide-react';
import type { OverviewRange, OverviewResult } from '@clinicai/api-client';
import { cn } from '../../components/ui/cn';
import { formatMoney } from '../../lib/clinicTime';
import { ActivityBars, Donut, RevenueBars, Sparkline, type DonutSegment } from './charts';

/**
 * The overview's cards, each measured from the dashboard design's Figma export.
 *
 * ─── THE CARD ───────────────────────────────────────────────────────────────────
 *
 * White, the card radius, a hairline at 90% of the chrome border, and the card shadow. Both
 * were tightened from the export's 18px and long 30px blur (see tokens.css). One component,
 * so the eight cards on this screen cannot drift apart.
 *
 * ─── EVERY NUMBER IS THE API'S ──────────────────────────────────────────────────
 *
 * The reference shows 286 calls and $12,480. Those were the prototype's invented figures;
 * these cards show the clinic's own, from `GET /api/v1/analytics/overview`, in rupees,
 * including zero when zero is the truth.
 */

export const Panel = ({
  children,
  className,
  style,
}: {
  readonly children: ReactNode;
  readonly className?: string | undefined;
  readonly style?: React.CSSProperties | undefined;
}) => (
  <section
    className={cn(
      'rounded-card border border-[rgba(233,237,245,0.9)] bg-surface shadow-card',
      className,
    )}
    style={style}
  >
    {children}
  </section>
);

export const RANGE_LABELS: Record<OverviewRange, string> = {
  today: 'Today',
  '7d': 'Last 7 days',
  '30d': 'Last 30 days',
  month: 'This month',
  'last-month': 'Last month',
};

/** What a delta is measured against, in words, for each range. */
const COMPARED_WITH: Record<OverviewRange, string> = {
  today: 'vs yesterday',
  '7d': 'vs last week',
  '30d': 'vs previous 30 days',
  month: 'vs last month',
  'last-month': 'vs the month before',
};

/**
 * A change as the design writes it, `+12.4%`, or the honest alternative.
 *
 * A percentage of zero is undefined, so a measure that was zero last period and is not now
 * reads "New" rather than "+Infinity%", and two zeros read "No change". Inventing a number
 * here would be the one figure on the screen that is not the clinic's.
 */
export const deltaOf = (
  value: number,
  previous: number,
): { readonly text: string; readonly direction: 'up' | 'down' | 'flat' } => {
  if (previous === 0) {
    return value === 0
      ? { text: 'No change', direction: 'flat' }
      : { text: 'New', direction: 'up' };
  }

  const change = ((value - previous) / previous) * 100;
  const rounded = Math.round(change * 10) / 10;

  if (rounded === 0) {
    return { text: '0%', direction: 'flat' };
  }

  return {
    text: `${rounded > 0 ? '+' : '−'}${String(Math.abs(rounded))}%`,
    direction: rounded > 0 ? 'up' : 'down',
  };
};

const DELTA_COLOUR = { up: 'text-[#20b486]', down: 'text-[#ef5350]', flat: 'text-muted' } as const;

/** The design's period dropdown: 127 by 33, a 9px radius, the chrome border. */
export const PeriodSelect = ({
  value,
  onChange,
}: {
  readonly value: OverviewRange;
  readonly onChange: (next: OverviewRange) => void;
}) => (
  <label className="relative block">
    <span className="sr-only">Period</span>
    <select
      value={value}
      onChange={(event) => {
        onChange(event.target.value as OverviewRange);
      }}
      className="h-[33px] w-[127px] cursor-pointer appearance-none rounded-control border border-border-chrome bg-surface pr-7 pl-3.5 text-muted text-xs"
    >
      {(Object.keys(RANGE_LABELS) as OverviewRange[]).map((range) => (
        <option key={range} value={range}>
          {RANGE_LABELS[range]}
        </option>
      ))}
    </select>
    <ChevronDown
      size={14}
      aria-hidden="true"
      className="-translate-y-1/2 pointer-events-none absolute top-1/2 right-2.5 text-muted"
    />
  </label>
);

/** "2 min ago", "3 h ago", "4 days ago": how the reference words the agent's last activity. */
const relative = (instant: string, now: Date): string => {
  const minutes = Math.max(0, Math.round((now.getTime() - new Date(instant).getTime()) / 60_000));

  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${String(minutes)} min ago`;
  }
  if (minutes < 60 * 24) {
    return `${String(Math.round(minutes / 60))} h ago`;
  }

  const days = Math.round(minutes / (60 * 24));
  return `${String(days)} day${days === 1 ? '' : 's'} ago`;
};

/** Morning until noon, afternoon until five, evening after, in the CLINIC's hours. */
const greetingFor = (now: Date, timeZone: string): string => {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(now),
  );

  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
};

/**
 * The greeting card, from node `1:138`: a white-to-lavender wash, the weekday as an eyebrow,
 * the greeting, the agent's state as chips, and the AI receptionist illustration.
 *
 * ─── THE CHIPS SAY ONLY WHAT IS TRUE ────────────────────────────────────────────
 *
 * "Online" is the agent's own status. "Last active" is when it last took a call, or "No
 * calls yet". The reference's third chip, "Call Forwarding active", is NOT drawn: forwarding
 * is the Android app, which is built last and does not exist, and a green chip asserting it
 * is on would be the most confident claim on the screen.
 */
export const HeroCard = ({
  personName,
  timeZone,
  agent,
  range,
  onRangeChange,
  now,
}: {
  readonly personName: string;
  readonly timeZone: string;
  readonly agent: OverviewResult['agent'] | undefined;
  readonly range: OverviewRange;
  readonly onRangeChange: (next: OverviewRange) => void;
  readonly now: Date;
}) => {
  const weekday = new Intl.DateTimeFormat('en-GB', { timeZone, weekday: 'long' }).format(now);
  const online = agent?.status === 'ACTIVE';

  return (
    <Panel
      className="relative flex h-[170px] min-w-[300px] flex-1 flex-col overflow-hidden px-[25px] py-[23px]"
      style={{
        backgroundImage:
          'linear-gradient(155deg, rgb(255, 255, 255) 16.8%, rgb(231, 222, 255) 91.5%)',
      }}
    >
      <div className="relative z-10 flex max-w-[525px] flex-col">
        <p className="m-0 font-medium text-default text-sm uppercase tracking-[0.8px] leading-[20px]">
          {weekday} overview
        </p>
        <p className="m-0 pb-2 font-bold text-[1.5625rem] text-default leading-[30px] tracking-[-0.7px]">
          {greetingFor(now, timeZone)}, {personName}
        </p>
        <p className="m-0 text-muted text-sm leading-[20px]">
          {agent === undefined
            ? 'Checking on your AI receptionist…'
            : online
              ? 'Your AI receptionist is managing calls and bookings.'
              : 'Your AI receptionist is not taking calls right now.'}
        </p>

        <div className="flex flex-wrap items-center gap-2 pt-5">
          <span
            className={cn(
              'flex h-[25px] items-center gap-1.5 rounded-full px-[9px] font-bold text-xs',
              online ? 'bg-success-surface text-[#128461]' : 'bg-background text-muted',
            )}
          >
            <span
              className={cn(
                'size-1.5 rounded-[3px]',
                online ? 'bg-success shadow-[0px_0px_0px_3px_rgba(32,180,134,0.13)]' : 'bg-subtle',
              )}
            />
            {online
              ? 'Online'
              : agent?.status === undefined || agent.status === null
                ? 'Not connected'
                : 'Offline'}
          </span>
          <span className="font-semibold text-muted text-xs leading-[13px]">
            {agent?.lastCallAt === null || agent?.lastCallAt === undefined
              ? 'No calls yet'
              : `Last active ${relative(agent.lastCallAt, now)}`}
          </span>
        </div>
      </div>

      <div className="absolute top-3 right-3 z-10">
        <PeriodSelect value={range} onChange={onRangeChange} />
      </div>

      <img
        src="/illustrations/ai-receptionist.png"
        alt=""
        width={145}
        height={133}
        className="pointer-events-none absolute right-[38px] bottom-[-8px] hidden h-[133px] w-[145px] object-contain @4xl:block"
      />
    </Panel>
  );
};

/**
 * "Estimated Revenue Impact", from node `1:178`: the listed price of what the agent booked.
 *
 * ESTIMATE IS THE DESIGN'S OWN WORD AND IT IS THE RIGHT ONE. This is the price on the
 * service list for each booking the agent made, not money taken: a booking can be cancelled,
 * a price can be waived, and nothing on this platform records payment.
 */
export const RevenueCard = ({ overview }: { readonly overview: OverviewResult | undefined }) => {
  const delta =
    overview === undefined
      ? undefined
      : deltaOf(overview.revenue.valueMinor, overview.revenue.previousMinor);

  return (
    <Panel
      className="relative h-[170px] w-full shrink-0 overflow-hidden px-5 py-[19px] @2xl:w-[340px]"
      style={{
        backgroundImage:
          'linear-gradient(139deg, rgb(255, 255, 255) 28.9%, rgb(243, 240, 255) 92.3%)',
      }}
    >
      <div className="flex items-start justify-between gap-2">
        <h2 className="m-0 font-bold text-default text-md tracking-[-0.25px]">
          Estimated Revenue Impact
        </h2>
        {delta !== undefined && (
          <span
            className={cn(
              'flex h-[22px] shrink-0 items-center rounded-full px-2 font-semibold text-xs',
              delta.direction === 'down'
                ? 'bg-danger-surface text-[#ef5350]'
                : 'bg-success-surface text-[#128461]',
            )}
          >
            {delta.text}
          </span>
        )}
      </div>
      <p className="m-0 pt-[5px] text-muted text-xs leading-[13px]">
        AI-booked appointments ·{' '}
        {overview === undefined ? '' : RANGE_LABELS[overview.range].toLowerCase()}
      </p>

      <div className="flex items-start gap-2 py-1">
        <strong className="font-bold text-[2rem] text-default tracking-[-1.2px]">
          {overview === undefined ? '—' : formatMoney(overview.revenue.valueMinor)}
        </strong>
        <span className="mt-2 rounded-sm bg-[#f0ecff] px-1.5 py-0.5 font-bold text-[#8b6ae8] text-xs">
          ESTIMATE
        </span>
      </div>

      <RevenueBars values={overview?.revenue.series ?? Array.from({ length: 12 }, () => 0)} />

      <span
        aria-hidden="true"
        className="absolute top-[90px] left-[254px] size-[125px] rounded-full bg-[rgba(139,106,232,0.09)]"
      />
    </Panel>
  );
};

type KpiTone = { readonly tile: string; readonly icon: string; readonly spark: string };

const TONES = {
  blue: { tile: 'bg-accent-surface', icon: 'text-accent', spark: '#356AE6' },
  violet: { tile: 'bg-[#f0ecff]', icon: 'text-[#8b6ae8]', spark: '#8B6AE8' },
  orange: { tile: 'bg-warning-surface', icon: 'text-[#f3a64a]', spark: '#F3A64A' },
  red: { tile: 'bg-[#ffefef]', icon: 'text-[#ef5350]', spark: '#EF5350' },
} as const satisfies Record<string, KpiTone>;

/**
 * One of the four KPI cards, from node `1:186`: 126px tall, the label and a tinted icon tile
 * across the top, the figure at 29px, the change under it, and the trend at the corner.
 */
export const KpiCard = ({
  label,
  icon: Icon,
  tone,
  value,
  detail,
  trend,
}: {
  readonly label: string;
  readonly icon: LucideIcon;
  readonly tone: keyof typeof TONES;
  readonly value: number | undefined;
  readonly detail: ReactNode;
  readonly trend: readonly number[];
}) => (
  <Panel className="relative h-[126px] overflow-hidden px-[18px] py-[17px]">
    <div className="flex items-start justify-between">
      <h3 className="m-0 font-semibold text-default text-xs">{label}</h3>
      <span className={cn('grid size-[30px] place-items-center rounded-md', TONES[tone].tile)}>
        <Icon size={18} aria-hidden="true" className={TONES[tone].icon} />
      </span>
    </div>
    <p className="m-0 pt-[5px] font-bold text-[1.8125rem] text-default leading-[35px] tracking-[-1px]">
      {value ?? '—'}
    </p>
    <p className="m-0 text-xs">{detail}</p>
    <span className="absolute right-3 bottom-3">
      <Sparkline values={trend} colour={TONES[tone].spark} />
    </span>
  </Panel>
);

/** "+12.4% vs last week", coloured by its direction, as the design writes it. */
export const Change = ({
  metric,
  range,
}: {
  readonly metric: { readonly value: number; readonly previous: number } | undefined;
  readonly range: OverviewRange;
}) => {
  if (metric === undefined) {
    return <span className="text-muted">&nbsp;</span>;
  }

  const delta = deltaOf(metric.value, metric.previous);

  return (
    <>
      <span className={cn('font-bold', DELTA_COLOUR[delta.direction])}>{delta.text}</span>
      <span className="text-muted"> {COMPARED_WITH[range]}</span>
    </>
  );
};

export const KpiRow = ({
  overview,
  range,
}: {
  readonly overview: OverviewResult | undefined;
  readonly range: OverviewRange;
}) => {
  const daily = overview?.daily ?? [];

  return (
    <div className="grid grid-cols-2 gap-3.5 xl:grid-cols-4">
      <KpiCard
        label="Calls Answered"
        icon={Phone}
        tone="blue"
        value={overview?.kpis.callsAnswered.value}
        detail={<Change metric={overview?.kpis.callsAnswered} range={range} />}
        trend={daily.map((day) => day.callsAnswered)}
      />
      <KpiCard
        label="AI Bookings"
        icon={CalendarDays}
        tone="violet"
        value={overview?.kpis.aiBookings.value}
        detail={<Change metric={overview?.kpis.aiBookings} range={range} />}
        trend={daily.map((day) => day.aiBookings)}
      />
      <KpiCard
        label="Booking Requests"
        icon={Inbox}
        tone="orange"
        value={overview?.kpis.bookingRequests.value}
        detail={
          overview === undefined ? (
            <span>&nbsp;</span>
          ) : (
            <>
              <span className="font-bold text-[#20b486]">
                +{overview.kpis.bookingRequests.today} today
              </span>
              <span className="text-muted"> awaiting review</span>
            </>
          )
        }
        trend={daily.map((day) => day.bookingRequests)}
      />
      <KpiCard
        label="Needs Attention"
        icon={TriangleAlert}
        tone="red"
        value={overview?.kpis.needsAttention.value}
        detail={<Change metric={overview?.kpis.needsAttention} range={range} />}
        trend={daily.map((day) => day.needsAttention)}
      />
    </div>
  );
};

/** `Mon` for a week of days, `3` for a month of them. */
const columnLabel = (day: string, dense: boolean): string =>
  dense
    ? String(Number(day.slice(-2)))
    : new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: 'UTC' }).format(
        new Date(`${day}T12:00:00.000Z`),
      );

/** "AI Call Activity", from node `1:279`: answered calls and AI bookings, day by day. */
export const ActivityCard = ({ overview }: { readonly overview: OverviewResult | undefined }) => {
  const daily = overview?.daily ?? [];
  const dense = daily.length > 7;

  return (
    <Panel className="min-w-0 p-5">
      <div className="flex flex-wrap items-end justify-between gap-x-2 gap-y-3">
        <div className="min-w-0">
          <h2 className="m-0 font-bold text-default text-md tracking-[-0.25px]">
            AI Call Activity
          </h2>
          <p className="m-0 pt-[5px] text-muted text-xs">
            Answered calls and AI-secured bookings ·{' '}
            {overview === undefined ? '' : RANGE_LABELS[overview.range].toLowerCase()}
          </p>
        </div>
        <div className="flex shrink-0 gap-3.5">
          <span className="flex items-center gap-[5px] font-medium text-default text-xs">
            <span className="size-2 rounded-[3px] bg-accent" />
            Calls answered
          </span>
          <span className="flex items-center gap-[5px] font-medium text-default text-xs">
            <span className="size-2 rounded-[3px] bg-[#8b6ae8]" />
            AI bookings
          </span>
        </div>
      </div>

      {/* Room above the plot for the top axis label, which sits on the top gridline. */}
      <div className="pt-5">
        <ActivityBars
          columns={daily.map((day) => ({
            label: columnLabel(day.day, dense),
            calls: day.callsAnswered,
            bookings: day.aiBookings,
          }))}
        />
      </div>
    </Panel>
  );
};

/**
 * "Call Outcomes", from node `1:378`.
 *
 * The design's five labels map onto the five outcomes the platform records. "Other" is the
 * honest home for a call nobody classified, which today is every call: nothing writes
 * `calls.outcome` yet, so until the outcome work lands this ring is one colour.
 */
export const OutcomesCard = ({ overview }: { readonly overview: OverviewResult | undefined }) => {
  const outcomes = overview?.outcomes;
  const segments: readonly DonutSegment[] = [
    { label: 'Booked', value: outcomes?.BOOKED ?? 0, colour: '#356ae6' },
    { label: 'Enquiries', value: outcomes?.INFORMATION ?? 0, colour: '#8b6ae8' },
    { label: 'Reschedules', value: outcomes?.RESCHEDULED ?? 0, colour: '#20b486' },
    { label: 'Cancellations', value: outcomes?.CANCELLED ?? 0, colour: '#f3a64a' },
    {
      label: 'Other',
      value: (outcomes?.NONE ?? 0) + (outcomes?.TRANSFERRED ?? 0),
      colour: '#b7c0d1',
    },
  ];
  const total = segments.reduce((sum, segment) => sum + segment.value, 0);

  return (
    <Panel className="p-5">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="m-0 font-bold text-default text-md tracking-[-0.25px]">Call Outcomes</h2>
          <p className="m-0 pt-[5px] text-muted text-xs">
            All {total} calls ·{' '}
            {overview === undefined ? '' : RANGE_LABELS[overview.range].toLowerCase()}
          </p>
        </div>
        <a href="/calls" className="font-bold text-accent text-xs hover:underline">
          Details
        </a>
      </div>

      <div className="flex flex-wrap items-center gap-6 pt-10">
        <Donut segments={segments} total={total} caption="Total calls" />

        <ul className="m-0 flex min-w-[170px] flex-1 list-none flex-col gap-2.5 p-0">
          {segments.map((segment) => (
            <li key={segment.label} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex items-center gap-2 text-default">
                <span
                  className="size-[7px] rounded-full"
                  style={{ backgroundColor: segment.colour }}
                />
                {segment.label}
              </span>
              <span className="font-semibold text-default">
                {segment.value} · {total === 0 ? 0 : Math.round((segment.value / total) * 100)}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </Panel>
  );
};
