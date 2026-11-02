import { useState } from 'react';
import { useSearchParams } from 'react-router';
import type { AppointmentView } from '@clinicai/api-client';
import { APPOINTMENT_STATUSES, startOfClinicDay, addDays } from '@clinicai/shared';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Badge, Cell, Row, Table } from '../../components/ui/Table';
import { DateInput, FilterSelect, Pager, Toolbar } from '../../components/ui/Toolbar';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import { formatDate, formatTime } from '../../lib/clinicTime';
import { useClinic } from '../clinic/api';
import { AppointmentDetail } from './AppointmentDetail';
import { BookingForm } from './BookingForm';
import { RescheduleForm } from './RescheduleForm';
import { useAppointmentsQuery } from './api';
import { statusBadge, statusLabel } from './status';

/**
 * The appointment list, built from `docs/prototype/laptop-04-appointments-list.png`.
 *
 * The capture's toolbar is a date, a status filter and the primary action; its table is date
 * and time, patient, service, status and a "View details" link; and its footer is a count and
 * a pager. All of that is kept.
 *
 * ─── WHAT IS FILTERED WHERE, AND WHY NONE OF IT IS LOCAL ────────────────────────
 *
 * The date and the status go to the server as `?from=`, `?to=` and `?status=`. A clinic has
 * more appointments than a page, so filtering what happens to be loaded would show a
 * receptionist an empty Tuesday that simply was not in the page they had.
 *
 * THE SEARCH BOX IS NOT HERE, and its absence is deliberate rather than an omission. The
 * prototype has one labelled "Search patient or service" and the appointments endpoint has no
 * text search: adding one locally would search a single page and claim to search the clinic.
 * The patient list searches properly, and a patient's appointments are on their profile. The
 * feature doc records it, and it is a small API change rather than a design question.
 */

const PAGE_SIZE = 25;

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  ...APPOINTMENT_STATUSES.map((status) => ({
    value: status,
    label: status.charAt(0) + status.slice(1).toLowerCase().replace('_', ' '),
  })),
];

export const AppointmentsPage = () => {
  const { data: clinic, isLoading: clinicLoading } = useClinic();
  const timeZone = clinic?.organisation.timezone ?? 'UTC';
  const canWrite = useCan('appointments', 'write');

  const [params, setParams] = useSearchParams();

  const [day, setDay] = useState('');
  const [status, setStatus] = useState('');
  const [cursors, setCursors] = useState<readonly (string | undefined)[]>([undefined]);
  const [selected, setSelected] = useState<AppointmentView | undefined>(undefined);
  const [rescheduling, setRescheduling] = useState<AppointmentView | undefined>(undefined);

  /**
   * The booking form opens from a link as well as from the button.
   *
   * A patient's profile links here with `?book=1&patientId=`, which is how "Create
   * appointment" on a profile reaches a form that lives on this screen. The parameters are
   * cleared as soon as they are read, so a refresh does not reopen the form.
   */
  const bookingFromLink = params.get('book') === '1';
  const [booking, setBooking] = useState(bookingFromLink);
  const initialPatientId = params.get('patientId') ?? undefined;

  if (bookingFromLink) {
    const next = new URLSearchParams(params);
    next.delete('book');
    setParams(next, { replace: true });
  }

  const cursor = cursors[cursors.length - 1];

  const { data, isLoading, isFetching, isError, error, refetch } = useAppointmentsQuery(
    {
      ...(day === ''
        ? {}
        : {
            // A clinic day, converted here because the list endpoint takes instants: the
            // server cannot know which day a browser means without the clinic's zone.
            from: startOfClinicDay(day, timeZone).toISOString(),
            to: startOfClinicDay(addDays(day, 1), timeZone).toISOString(),
          }),
      ...(status === '' ? {} : { status: [status] as never }),
      ...(initialPatientId === undefined ? {} : { patientId: initialPatientId }),
      cursor,
      limit: PAGE_SIZE,
    },
    { skip: clinicLoading },
  );

  return (
    <>
      <Card className="mb-4 p-4">
        <Toolbar
          action={
            canWrite ? (
              <Button
                onClick={() => {
                  setBooking(true);
                }}
              >
                ＋ New Appointment
              </Button>
            ) : undefined
          }
        >
          <DateInput
            label="Date"
            value={day}
            onChange={(value) => {
              setDay(value);
              setCursors([undefined]);
            }}
          />
          <FilterSelect
            label="Status"
            value={status}
            onChange={(value) => {
              setStatus(value);
              setCursors([undefined]);
            }}
            options={STATUS_OPTIONS}
          />
          {day !== '' && (
            <Button
              kind="secondary"
              onClick={() => {
                setDay('');
                setCursors([undefined]);
              }}
            >
              Clear date
            </Button>
          )}
        </Toolbar>
      </Card>

      {(isLoading || clinicLoading) && <Spinner />}

      {isError && (
        <div className="flex flex-col items-start gap-3">
          <Alert kind="danger">
            {errorMessage(error, 'The appointments could not be loaded.')}
          </Alert>
          <Button
            kind="secondary"
            onClick={() => {
              void refetch();
            }}
          >
            Try again
          </Button>
        </div>
      )}

      {data !== undefined && data.items.length === 0 && (
        <EmptyState
          title={
            day === '' && status === '' ? 'No appointments yet' : 'Nothing matches that filter'
          }
          body={
            day === '' && status === ''
              ? 'Appointments booked here and by the voice agent both appear in this list.'
              : 'Try another date, or clear the filters to see the whole book.'
          }
          action={
            day === '' && status === '' ? (
              canWrite ? (
                <Button
                  onClick={() => {
                    setBooking(true);
                  }}
                >
                  ＋ New Appointment
                </Button>
              ) : undefined
            ) : (
              <Button
                kind="secondary"
                onClick={() => {
                  setDay('');
                  setStatus('');
                  setCursors([undefined]);
                }}
              >
                Clear the filters
              </Button>
            )
          }
        />
      )}

      {data !== undefined && data.items.length > 0 && (
        <>
          <Table
            caption="Appointments at this clinic, soonest first"
            head={['Date & time', 'Patient', 'Service', 'Status', 'Actions']}
          >
            {data.items.map((appointment) => (
              <Row key={appointment.id}>
                <Cell>
                  <span className="flex flex-col gap-0.5">
                    <strong className="font-semibold text-default">
                      {formatDate(appointment.startAt, timeZone)}
                    </strong>
                    <small className="text-muted">
                      {formatTime(appointment.startAt, timeZone)}
                    </small>
                  </span>
                </Cell>
                <Cell>{appointment.patient.fullName ?? 'Name hidden'}</Cell>
                <Cell muted={appointment.service === null}>
                  {appointment.service?.name ?? 'No service'}
                </Cell>
                <Cell>
                  <Badge kind={statusBadge(appointment.status)}>
                    {statusLabel(appointment.status, appointment.source)}
                  </Badge>
                </Cell>
                <Cell>
                  <button
                    type="button"
                    className="font-semibold text-accent text-xs hover:underline"
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
              hasNext={data.nextCursor !== null}
              busy={isFetching}
              onPrevious={() => {
                setCursors((previous) => previous.slice(0, -1));
              }}
              onNext={() => {
                setCursors((previous) =>
                  data.nextCursor === null ? previous : [...previous, data.nextCursor],
                );
              }}
            />
            <span className="text-muted text-xs">
              Showing {data.items.length} appointment{data.items.length === 1 ? '' : 's'}
            </span>
          </div>
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

      {booking && (
        <BookingForm
          initialPatientId={initialPatientId}
          onClose={() => {
            setBooking(false);
          }}
        />
      )}
    </>
  );
};
