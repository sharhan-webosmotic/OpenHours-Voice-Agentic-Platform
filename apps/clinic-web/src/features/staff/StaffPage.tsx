import { Link } from 'react-router';
import { Clock } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { errorMessage } from '../../lib/problem';
import { formatDuration } from '../../lib/clinicTime';
import { useClinic } from '../clinic/api';

/**
 * Doctors and staff, from `docs/prototype/laptop-11-staff.png`.
 *
 * The capture's two columns are kept: the doctor on the left with their details under them,
 * the hours editor and the staff list on the right.
 *
 * ─── THE HOURS ARE EDITED IN CLINIC SETTINGS ────────────────────────────────────
 *
 * This screen had its own opening-hours editor, a second one beside Settings. Two editors for
 * one record is two things to keep in step, so it now points at Settings, where the week is
 * edited a day at a time.
 *
 * ─── TWO DEVIATIONS ───────────────────────────────────────────────────────────
 *
 * 1. NO EMAIL OR PHONE ON THE DOCTOR CARD. `doctors` holds a name, a specialty and a buffer.
 *    The login that belongs to a doctor has an email, and it is a different record.
 * 2. THE CLINIC STAFF LIST IS AN HONEST EMPTY STATE. There is no endpoint that lists a
 *    clinic's users.
 */

export const StaffPage = () => {
  const { data: clinic, isLoading, isError, error, refetch } = useClinic();

  if (isLoading) {
    return <Spinner />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert kind="danger">{errorMessage(error, 'The clinic could not be loaded.')}</Alert>
        <Button
          kind="secondary"
          onClick={() => {
            void refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (clinic === undefined) {
    return <Spinner />;
  }

  const doctor = clinic.doctors.find((candidate) => candidate.active) ?? clinic.doctors[0];

  return (
    <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[22rem_minmax(0,1fr)]">
      <Card className="flex flex-col gap-5">
        {doctor === undefined ? (
          <EmptyState
            title="No doctor yet"
            body="A clinic needs a doctor before anything can be booked: the slot engine answers per doctor. A platform administrator adds one in the admin console."
          />
        ) : (
          <>
            <div className="flex items-center gap-3">
              <Avatar name={doctor.fullName} size="lg" />
              <div className="flex flex-col gap-0.5">
                <span className="font-semibold text-[0.6875rem] text-accent uppercase tracking-wide">
                  Clinic doctor
                </span>
                <strong className="font-semibold text-default text-md">{doctor.fullName}</strong>
                <small className="text-muted text-xs">
                  {doctor.specialty ?? 'Specialty not recorded'}
                </small>
              </div>
            </div>

            <dl className="m-0 flex flex-col gap-4 border-border border-t pt-5">
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-[0.6875rem] text-muted uppercase">Status</dt>
                <dd className="m-0">
                  <Badge kind={doctor.active ? 'success' : 'neutral'}>
                    {doctor.active ? 'Active' : 'Inactive'}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-[0.6875rem] text-muted uppercase">
                  Gap after each appointment
                </dt>
                <dd className="m-0 font-semibold text-default text-xs">
                  {doctor.bufferMinutes === 0 ? 'None' : formatDuration(doctor.bufferMinutes)}
                </dd>
              </div>
              <div className="flex items-baseline justify-between gap-4">
                <dt className="font-semibold text-[0.6875rem] text-muted uppercase">
                  Bookable services
                </dt>
                <dd className="m-0 text-right font-semibold text-default text-xs">
                  {clinic.services.filter((service) => service.active).length === 0
                    ? 'None yet'
                    : clinic.services
                        .filter((service) => service.active)
                        .map((service) => service.name)
                        .join(', ')}
                </dd>
              </div>
            </dl>

            <Alert kind="info">
              This clinic is configured for one doctor, so every appointment is assigned to{' '}
              {doctor.fullName}. A second doctor needs a column in the appointment list, a step in
              the booking form and a filter, which is recorded in the feature document.
            </Alert>
          </>
        )}
      </Card>

      <div className="flex flex-col gap-4">
        <Card className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span
              aria-hidden="true"
              className="grid size-10 place-items-center rounded-lg bg-accent-surface text-accent"
            >
              <Clock size={18} />
            </span>
            <div className="flex flex-col gap-0.5">
              <h2 className="m-0 font-semibold text-default text-md">Opening hours</h2>
              <p className="m-0 text-muted text-xs">
                Set a day at a time, with breaks, in Clinic Settings.
              </p>
            </div>
          </div>
          <Link
            to="/settings?section=hours"
            className="font-semibold text-accent text-sm hover:underline"
          >
            Open opening hours
          </Link>
        </Card>

        <Card className="flex flex-col gap-4">
          <h2 className="m-0 font-semibold text-default text-md">Clinic staff</h2>
          <EmptyState
            title="The staff list is not available yet"
            body="There is no endpoint that lists a clinic's users, so nothing is shown rather than an empty list implying this clinic has no staff. Clinic users are created in the admin console today."
          />
        </Card>
      </div>
    </div>
  );
};
