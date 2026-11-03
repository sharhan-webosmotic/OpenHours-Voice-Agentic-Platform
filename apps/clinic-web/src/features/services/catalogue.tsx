import type { ReactNode } from 'react';
import type { ServiceView } from '@clinicai/api-client';
import { Clock, HeartPulse, IndianRupee, Plus, RotateCw, Stethoscope } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Table';
import { cn } from '../../components/ui/cn';
import { formatDuration, formatMoney } from '../../lib/clinicTime';

/**
 * The care catalogue's pieces, from the services reference.
 *
 * ─── WHAT THE REFERENCE CARD HAS THAT THIS ONE DOES NOT ─────────────────────────
 *
 * Its cards carry a category, a description, a visit type, and "included", "before the visit"
 * and "follow-up" lines. A service here stores a name, a length, a fee and whether it is
 * active, and nothing else, so those lines would have to be invented. Patient-facing wording
 * about what a visit includes is clinical content the clinic must write, not the product.
 *
 * ─── THE SUMMARY COUNTS ACTIVE SERVICES ONLY ────────────────────────────────────
 *
 * The average length and the fee range describe what a patient can book today. An inactive
 * service cannot be booked, so including it would quote a fee nobody can be charged.
 */

const TONES = [
  { tile: 'bg-accent-surface text-accent', Icon: Stethoscope },
  { tile: 'bg-success-surface text-success', Icon: RotateCw },
  { tile: 'bg-[#f0ecff] text-[#8b6ae8]', Icon: HeartPulse },
] as const;

export type CatalogueSummary = {
  readonly active: number;
  readonly total: number;
  readonly averageMinutes: number | null;
  readonly feeRange: { readonly low: number; readonly high: number } | null;
};

export const summarise = (services: readonly ServiceView[]): CatalogueSummary => {
  const active = services.filter((service) => service.active);
  const fees = active
    .map((service) => service.priceMinor)
    .filter((fee): fee is number => fee !== null);

  return {
    active: active.length,
    total: services.length,
    averageMinutes:
      active.length === 0
        ? null
        : Math.round(
            active.reduce((sum, service) => sum + service.durationMinutes, 0) / active.length,
          ),
    feeRange: fees.length === 0 ? null : { low: Math.min(...fees), high: Math.max(...fees) },
  };
};

const Stat = ({
  icon,
  tile,
  label,
  children,
}: {
  readonly icon: ReactNode;
  readonly tile: string;
  readonly label: string;
  readonly children: ReactNode;
}) => (
  <Card padded={false} className="flex items-center gap-4 px-5 py-4">
    <span
      aria-hidden="true"
      className={cn('grid size-10 shrink-0 place-items-center rounded-lg', tile)}
    >
      {icon}
    </span>
    <div className="flex flex-col gap-0.5">
      <span className="text-muted text-xs">{label}</span>
      <span className="font-bold text-default text-lg">{children}</span>
    </div>
  </Card>
);

const feeRangeLabel = (range: CatalogueSummary['feeRange']): string => {
  if (range === null) {
    return 'Not set';
  }
  return range.low === range.high
    ? formatMoney(range.low)
    : `${formatMoney(range.low)} to ${formatMoney(range.high)}`;
};

export const CatalogueStats = ({ summary }: { readonly summary: CatalogueSummary }) => (
  <div className="mb-6 grid grid-cols-1 gap-4 md:grid-cols-3">
    <Stat icon={<Plus size={18} />} tile="bg-accent-surface text-accent" label="Active services">
      {summary.active}
      <span className="pl-1 font-normal text-muted text-xs">of {summary.total}</span>
    </Stat>
    <Stat
      icon={<Clock size={18} />}
      tile="bg-success-surface text-success"
      label="Average appointment"
    >
      {summary.averageMinutes === null ? 'None active' : formatDuration(summary.averageMinutes)}
    </Stat>
    <Stat
      icon={<IndianRupee size={18} />}
      tile="bg-warning-surface text-warning"
      label="Current fee range"
    >
      {feeRangeLabel(summary.feeRange)}
    </Stat>
  </div>
);

export const ServiceCard = ({
  service,
  index,
  canWrite,
  busy,
  onEdit,
  onToggle,
}: {
  readonly service: ServiceView;
  /** Picks the tile's colour, so neighbouring cards are told apart at a glance. */
  readonly index: number;
  readonly canWrite: boolean;
  readonly busy: boolean;
  readonly onEdit: () => void;
  readonly onToggle: () => void;
}) => {
  const tone = TONES[index % TONES.length] ?? TONES[0];

  return (
    <Card
      padded={false}
      className={cn('flex h-full flex-col p-5', !service.active && 'opacity-75')}
    >
      <div className="flex items-start justify-between gap-3">
        <span
          aria-hidden="true"
          className={cn('grid size-11 place-items-center rounded-lg', tone.tile)}
        >
          <tone.Icon size={20} />
        </span>
        <Badge kind={service.active ? 'success' : 'neutral'}>
          {service.active ? 'Active' : 'Inactive'}
        </Badge>
      </div>

      <h3 className="m-0 pt-4 font-bold text-default text-md">{service.name}</h3>
      <p className="m-0 pt-1 text-muted text-xs">
        {service.active ? 'Bookable by phone and at the desk.' : 'Not offered for booking.'}
      </p>

      <dl className="m-0 mt-4 grid grid-cols-2 gap-4 border-border-chrome border-t pt-4">
        <div className="flex flex-col gap-1">
          <dt className="text-muted text-xs">Appointment length</dt>
          <dd className="m-0 font-semibold text-default text-sm">
            {formatDuration(service.durationMinutes)}
          </dd>
        </div>
        <div className="flex flex-col gap-1">
          <dt className="text-muted text-xs">Fee</dt>
          <dd className="m-0 font-bold text-default text-md">{formatMoney(service.priceMinor)}</dd>
        </div>
      </dl>

      {canWrite && (
        <div className="mt-auto flex items-center justify-between gap-3 pt-5">
          <button
            type="button"
            onClick={onEdit}
            className="h-9 rounded-control border border-border-chrome bg-surface px-3.5 font-semibold text-default text-sm shadow-control hover:border-accent/40 hover:text-accent"
          >
            Edit service
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onToggle}
            className={cn(
              'rounded-control px-2 py-1.5 font-semibold text-sm disabled:opacity-50',
              service.active
                ? 'text-danger hover:bg-danger-surface'
                : 'text-accent hover:bg-accent-surface',
            )}
          >
            {service.active ? 'Deactivate' : 'Activate'}
          </button>
        </div>
      )}
    </Card>
  );
};
