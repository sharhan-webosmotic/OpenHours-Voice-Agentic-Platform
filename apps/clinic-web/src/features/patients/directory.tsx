import type { PatientSummary } from '@clinicai/api-client';
import { ChevronRight } from 'lucide-react';
import { Link } from 'react-router';
import { Avatar } from '../../components/ui/Avatar';
import { Card } from '../../components/ui/Card';
import { Badge, Cell, Row } from '../../components/ui/Table';
import { ageOn, formatDate, formatDateOfBirth, formatTime24 } from '../../lib/clinicTime';
import { formatPhone } from '../../lib/phone';
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
 *
 * ─── EVERY ROW IS TWO LINES ─────────────────────────────────────────────────────
 *
 * A primary line and a muted one in every column that has something to add, so rows are one
 * height whether or not a visit is booked, and the eye can run down any column. The status
 * has a column of its own for the same reason: a badge buried at the end of a panel cannot
 * be scanned.
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

export const DIRECTORY_COLUMNS = [
  'Patient',
  'Contact',
  'Last appointment',
  'Next appointment',
  'Status',
  'Profile',
] as const;

const Quiet = ({ children }: { readonly children: string }) => (
  <span className="text-subtle">{children}</span>
);

export const PatientRow = ({
  patient,
  timeZone,
  today,
}: {
  readonly patient: PatientSummary;
  readonly timeZone: string;
  readonly today: string;
}) => {
  const next = patient.nextAppointment;

  return (
    <Row>
      <Cell>
        <span className="flex items-center gap-3">
          <Avatar name={patient.fullName} size="md" />
          <span className="flex min-w-0 flex-col gap-0.5">
            <strong className="font-semibold text-default text-sm">
              {/* Masked for a platform role, which is a state and not an error. */}
              {patient.fullName ?? 'Name hidden'}
            </strong>
            <span className="text-muted text-xs">
              {patient.dateOfBirth === null
                ? 'Date of birth not recorded'
                : `${formatDateOfBirth(patient.dateOfBirth)} · ${String(ageOn(patient.dateOfBirth, today))} yrs`}
            </span>
          </span>
        </span>
      </Cell>

      <Cell>
        {patient.phone === null ? (
          <Quiet>Hidden</Quiet>
        ) : (
          <span className="whitespace-nowrap font-medium text-default tabular-nums">
            {formatPhone(patient.phone)}
          </span>
        )}
      </Cell>

      <Cell>
        {patient.lastAppointmentAt === null ? (
          <Quiet>None yet</Quiet>
        ) : (
          <span className="whitespace-nowrap">
            {formatDate(patient.lastAppointmentAt, timeZone)}
          </span>
        )}
      </Cell>

      <Cell>
        {next === null ? (
          <Quiet>Not booked</Quiet>
        ) : (
          <span className="flex flex-col gap-0.5">
            <span className="whitespace-nowrap font-medium text-default">
              {`${formatDate(next.startAt, timeZone)} · ${formatTime24(next.startAt, timeZone)}`}
            </span>
            <span className="text-muted text-xs">{next.serviceName ?? 'No service named'}</span>
          </span>
        )}
      </Cell>

      <Cell>
        {next === null ? (
          <Quiet>—</Quiet>
        ) : (
          <Badge kind={statusBadge(next.status, next.source)}>
            {statusLabel(next.status, next.source)}
          </Badge>
        )}
      </Cell>

      <Cell>
        <Link
          to={`/patients/${patient.id}`}
          className="inline-flex h-8 items-center gap-1 whitespace-nowrap rounded-control border border-border-chrome bg-surface px-3 font-semibold text-default text-xs shadow-control hover:border-accent/40 hover:text-accent"
        >
          View profile
          <ChevronRight size={14} aria-hidden="true" />
        </Link>
      </Cell>
    </Row>
  );
};
