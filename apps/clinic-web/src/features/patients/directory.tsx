import type { PatientSummary } from '@clinicai/api-client';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Table';
import { formatDate, formatTime24 } from '../../lib/clinicTime';
import { statusBadge, statusLabel } from '../appointments/status';
import { usePatientSummaryQuery } from './api';

/**
 * The pieces of the patient directory that are more than a table cell, from the patients
 * reference.
 *
 * ─── THE HEADER COUNTS COME FROM THEIR OWN ENDPOINT ─────────────────────────────
 *
 * The list is paged and searched, so its length is neither the clinic's patient count nor
 * stable while someone types. The counts are fetched once, under the same doctor scope as the
 * list, and do not move with the search box.
 */

const plural = (count: number, one: string, many: string): string =>
  `${String(count)} ${count === 1 ? one : many}`;

export const DirectoryHeader = () => {
  const { data } = usePatientSummaryQuery();

  return (
    <Card
      padded={false}
      className="mb-4 flex flex-wrap items-center justify-between gap-4 px-6 py-5"
    >
      <div className="flex flex-col gap-1">
        <p className="m-0 font-bold text-accent text-xs uppercase tracking-[1px]">
          Patient directory
        </p>
        <h2 className="m-0 font-bold text-default text-lg">
          {data === undefined
            ? 'Registered patients'
            : plural(data.registered, 'registered patient', 'registered patients')}
        </h2>
        <p className="m-0 text-muted text-xs">
          Review contact details and each patient&apos;s next visit.
        </p>
      </div>

      {data !== undefined && (
        <div className="flex items-center gap-3 rounded-lg border border-border-chrome bg-surface-sunken px-4 py-3">
          <strong className="font-bold text-2xl text-accent leading-none">
            {data.upcomingVisits}
          </strong>
          <span className="text-muted text-xs">
            {data.upcomingVisits === 1 ? 'upcoming visit' : 'upcoming visits'}
          </span>
        </div>
      )}
    </Card>
  );
};

/**
 * The next visit as a small panel: when, what, and where it stands.
 *
 * The status is the appointment's, labelled the way the appointment screens label it, so an
 * AI booking awaiting confirmation reads the same here as it does in the calendar.
 */
export const NextVisit = ({
  next,
  timeZone,
}: {
  readonly next: PatientSummary['nextAppointment'];
  readonly timeZone: string;
}) => {
  if (next === null) {
    return <span className="text-muted">Nothing booked</span>;
  }

  return (
    <div className="flex max-w-[340px] flex-col gap-1 rounded-lg border border-border-chrome bg-surface-sunken px-3.5 py-2.5">
      <div className="flex items-center justify-between gap-3">
        <strong className="font-semibold text-default text-sm">
          {formatDate(next.startAt, timeZone)}
        </strong>
        <Badge kind={statusBadge(next.status, next.source)}>
          {statusLabel(next.status, next.source)}
        </Badge>
      </div>
      <span className="text-muted text-xs">
        {[formatTime24(next.startAt, timeZone), next.serviceName]
          .filter((part) => part !== null)
          .join(' · ')}
      </span>
    </div>
  );
};
