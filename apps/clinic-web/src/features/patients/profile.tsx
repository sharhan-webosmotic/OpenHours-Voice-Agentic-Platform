import { useState } from 'react';
import type { PatientDetail } from '@clinicai/api-client';
import { CalendarCheck, CalendarX } from 'lucide-react';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Table';
import { cn } from '../../components/ui/cn';
import { formatLongDate, formatTime24 } from '../../lib/clinicTime';
import { AppointmentDetail } from '../appointments/AppointmentDetail';
import { RescheduleForm } from '../appointments/RescheduleForm';
import { useAppointmentQuery } from '../appointments/api';
import { sourceLabel, statusBadge, statusLabel } from '../appointments/status';

/**
 * The right-hand column of the patient profile, from the profile reference: the next
 * appointment, then the patient's timeline.
 *
 * ─── WHAT THE REFERENCE HAS THAT THIS DOES NOT ──────────────────────────────────
 *
 * Its timeline also carries documents, a prescription picker, an upload button and an
 * "Add follow-up" action. None of those has an endpoint, and a control that does nothing is
 * worse than no control: a receptionist who uploads a report that goes nowhere believes it
 * is on file. They arrive with their own features. The timeline here is appointments only,
 * and says so.
 */

type HistoryItem = PatientDetail['appointments'][number];

const LIVE = new Set(['SCHEDULED', 'CONFIRMED', 'COMPLETED']);

export const NextAppointmentCard = ({
  patient,
  timeZone,
  onOpen,
}: {
  readonly patient: PatientDetail;
  readonly timeZone: string;
  readonly onOpen: (appointmentId: string) => void;
}) => {
  const next = patient.nextAppointment;

  if (next === null) {
    return (
      <Card padded={false} className="px-6 py-5">
        <p className="m-0 font-bold text-accent text-xs uppercase tracking-[1px]">
          Next appointment
        </p>
        <p className="m-0 pt-2 text-muted text-sm">Nothing is booked for this patient.</p>
      </Card>
    );
  }

  /**
   * The history is the full record of this patient's appointments, newest first, so the next
   * one is in it; matching it there supplies the doctor and the id the summary does not carry.
   */
  const row = patient.appointments.find(
    (item) => item.startAt === next.startAt && item.status === next.status,
  );

  return (
    <Card
      padded={false}
      className="flex flex-wrap items-center justify-between gap-4 bg-accent-surface/40 px-6 py-5"
    >
      <div className="flex flex-col gap-1">
        <p className="m-0 font-bold text-accent text-xs uppercase tracking-[1px]">
          Next appointment
        </p>
        <h2 className="m-0 font-bold text-default text-lg">{next.serviceName ?? 'Appointment'}</h2>
        <p className="m-0 text-muted text-xs">
          {[
            `${formatLongDate(next.startAt, timeZone)} at ${formatTime24(next.startAt, timeZone)}`,
            row?.doctorName,
          ]
            .filter((part) => part !== undefined)
            .join(' · ')}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <Badge kind={statusBadge(next.status, next.source)}>
          {statusLabel(next.status, next.source)}
        </Badge>
        {row !== undefined && (
          <button
            type="button"
            onClick={() => {
              onOpen(row.id);
            }}
            className="h-9 rounded-control border border-border-chrome bg-surface px-3.5 font-semibold text-default text-sm shadow-control hover:border-accent/40 hover:text-accent"
          >
            View details
          </button>
        )}
      </div>
    </Card>
  );
};

const TimelineEntry = ({
  item,
  last,
  timeZone,
  onOpen,
}: {
  readonly item: HistoryItem;
  /** The last entry draws no rail below its marker and no rule under its body. */
  readonly last: boolean;
  readonly timeZone: string;
  readonly onOpen: (appointmentId: string) => void;
}) => {
  const live = LIVE.has(item.status);
  const Icon = live ? CalendarCheck : CalendarX;

  return (
    <li className="relative flex gap-4">
      {!last && (
        <span
          aria-hidden="true"
          className="absolute top-8 bottom-0 left-[13px] w-px bg-border-chrome"
        />
      )}
      <span
        aria-hidden="true"
        className={cn(
          'relative z-10 grid size-7 shrink-0 place-items-center rounded-full',
          live ? 'bg-accent text-inverse' : 'bg-background text-muted',
        )}
      >
        <Icon size={14} />
      </span>

      <div
        className={cn(
          'flex min-w-0 flex-1 flex-col gap-1',
          !last && 'mb-6 border-border-chrome border-b pb-6',
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="text-muted text-xs">
            {`${formatLongDate(item.startAt, timeZone)} · ${formatTime24(item.startAt, timeZone)}`}
          </span>
          <Badge kind={statusBadge(item.status, item.source)}>
            {statusLabel(item.status, item.source)}
          </Badge>
        </div>
        <strong className="font-semibold text-default text-md">
          {item.serviceName ?? 'Appointment'}
        </strong>
        <span className="text-muted text-xs">
          {`${item.doctorName} · ${sourceLabel(item.source)}`}
        </span>
        <div className="pt-2">
          <button
            type="button"
            onClick={() => {
              onOpen(item.id);
            }}
            className="font-semibold text-accent text-sm hover:underline"
          >
            View appointment
          </button>
        </div>
      </div>
    </li>
  );
};

export const PatientTimeline = ({
  patient,
  timeZone,
  onOpen,
}: {
  readonly patient: PatientDetail;
  readonly timeZone: string;
  readonly onOpen: (appointmentId: string) => void;
}) => (
  <Card padded={false}>
    <div className="flex flex-col gap-0.5 border-border-chrome border-b px-6 py-5">
      <h2 className="m-0 font-bold text-default text-lg">Patient timeline</h2>
      <p className="m-0 text-muted text-xs">Every appointment on this record, newest first.</p>
    </div>

    {patient.appointments.length === 0 ? (
      <p className="m-0 px-6 py-10 text-center text-muted text-sm">No appointments yet.</p>
    ) : (
      <ol className="m-0 list-none px-6 py-6">
        {patient.appointments.map((item, index) => (
          <TimelineEntry
            key={item.id}
            item={item}
            last={index === patient.appointments.length - 1}
            timeZone={timeZone}
            onOpen={onOpen}
          />
        ))}
      </ol>
    )}
  </Card>
);

/**
 * The appointment drawer, opened from the profile.
 *
 * The SAME drawer the appointments screen uses, loaded by id, so confirming, rescheduling
 * and cancelling behave identically wherever a receptionist starts from.
 */
export const AppointmentOverlay = ({
  appointmentId,
  timeZone,
  onClose,
}: {
  readonly appointmentId: string;
  readonly timeZone: string;
  readonly onClose: () => void;
}) => {
  const { data } = useAppointmentQuery(appointmentId);
  const [rescheduling, setRescheduling] = useState(false);

  if (data === undefined) {
    return null;
  }

  return rescheduling ? (
    <RescheduleForm appointment={data} timeZone={timeZone} onClose={onClose} />
  ) : (
    <AppointmentDetail
      appointment={data}
      timeZone={timeZone}
      onClose={onClose}
      onReschedule={() => {
        setRescheduling(true);
      }}
    />
  );
};
