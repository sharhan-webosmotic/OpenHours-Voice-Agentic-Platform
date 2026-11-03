import type { ServiceView } from '@clinicai/api-client';
import { HeartPulse, RotateCw, Stethoscope } from 'lucide-react';
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
 */

const TONES = [
  { tile: 'bg-accent-surface text-accent', Icon: Stethoscope },
  { tile: 'bg-success-surface text-success', Icon: RotateCw },
  { tile: 'bg-[#f0ecff] text-[#8b6ae8]', Icon: HeartPulse },
] as const;

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
