import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { useCan } from '../../lib/useCan';
import { errorMessage, isNotFound } from '../../lib/problem';
import { formatDateOfBirth, formatDateTime } from '../../lib/clinicTime';
import { statusBadge, statusLabel } from '../appointments/status';
import { useClinic } from '../clinic/api';
import { PatientForm } from './PatientForm';
import { usePatientQuery } from './api';

/**
 * One patient, built from `docs/prototype/state-36-patient-profile.png`.
 *
 * The capture's layout is kept: a back link, an identity card on the left with the contact
 * details under it, and appointment history, follow-ups and notes stacked on the right.
 *
 * ─── THREE DEVIATIONS, ALL RECORDED IN THE FEATURE DOC ──────────────────────────
 *
 * 1. NO EMAIL FIELD. `patients` has no email column. The capture shows one, and showing an
 *    empty row under every patient would be worse than not showing it.
 * 2. NO "Patient #1" LINE. The prototype numbers patients sequentially; real ids are uuids,
 *    and putting one on screen is noise a receptionist cannot use. The record is identified
 *    by name and number, which is what a clinic identifies a person by.
 * 3. AN EDIT BUTTON, WHICH THE PROTOTYPE DOES NOT HAVE. Its "Add Patient" opens the same
 *    modal with empty fields and there is no path to edit an existing record anywhere in it.
 *    The feature brief requires patients to be editable, so the entry point had to go
 *    somewhere, and the identity card is where the fields it edits are shown. Say if it
 *    belongs on the list row instead.
 *
 * FOLLOW-UPS ARE AN HONEST EMPTY STATE. There is no follow-up endpoint, so the panel says
 * the feature is not available rather than showing an empty list that implies there is
 * nothing to show.
 */

export const PatientProfilePage = () => {
  const { patientId } = useParams<{ patientId: string }>();
  /**
   * The clinic is read for its TIME ZONE, and the screen waits for it.
   *
   * `useClinicTimeZone` falls back to UTC while the query is in flight, which on this screen
   * meant the appointment history rendered 3:30 am for a 9:00 am appointment until the clinic
   * arrived, and kept it if the clinic query failed. A test caught it. Every screen that
   * renders a time now holds until it knows which clock it is rendering in.
   */
  const { data: clinic, isLoading: clinicLoading } = useClinic();
  const timeZone = clinic?.organisation.timezone ?? 'UTC';
  const canWrite = useCan('patients', 'write');
  const [editing, setEditing] = useState(false);

  const {
    data: patient,
    isLoading,
    isError,
    error,
    refetch,
  } = usePatientQuery(patientId ?? '', {
    skip: patientId === undefined,
  });

  if (isLoading || clinicLoading) {
    return <Spinner />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert kind="danger">
          {isNotFound(error)
            ? 'That patient was not found.'
            : errorMessage(error, 'The patient could not be loaded.')}
        </Alert>
        <div className="flex items-center gap-3">
          {!isNotFound(error) && (
            <Button
              kind="secondary"
              onClick={() => {
                void refetch();
              }}
            >
              Try again
            </Button>
          )}
          <Link to="/patients" className="text-muted text-xs hover:underline">
            Back to patients
          </Link>
        </div>
      </div>
    );
  }

  if (patient === undefined) {
    return <Spinner />;
  }

  return (
    <>
      <Link
        to="/patients"
        className="mb-4 inline-flex items-center gap-1.5 font-semibold text-accent text-xs hover:underline"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        Back to patients
      </Link>

      <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[20rem_minmax(0,1fr)]">
        <Card className="flex flex-col gap-5">
          <div className="flex flex-col items-center gap-3 text-center">
            <Avatar name={patient.fullName} className="size-16 rounded-xl text-md" />
            <strong className="font-semibold text-default text-md">
              {patient.fullName ?? 'Name hidden'}
            </strong>
          </div>

          {canWrite && (
            <div className="flex flex-col gap-2">
              <Link to={`/appointments?patientId=${patient.id}&book=1`}>
                <Button fullWidth>＋ Create appointment</Button>
              </Link>
              <Button
                kind="secondary"
                onClick={() => {
                  setEditing(true);
                }}
              >
                Edit patient
              </Button>
            </div>
          )}

          <dl className="flex flex-col gap-4 border-border border-t pt-5">
            <div className="flex flex-col gap-1">
              <dt className="font-semibold text-[0.6875rem] text-muted uppercase">Phone</dt>
              <dd className="m-0 font-semibold text-default text-xs">
                {patient.phone ?? 'Hidden'}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="font-semibold text-[0.6875rem] text-muted uppercase">Date of birth</dt>
              <dd className="m-0 font-semibold text-default text-xs">
                {formatDateOfBirth(patient.dateOfBirth)}
              </dd>
            </div>
          </dl>
        </Card>

        <div className="flex flex-col gap-4">
          <Card padded={false} className="p-0">
            <div className="flex flex-col gap-0.5 px-6 py-4">
              <h2 className="m-0 font-semibold text-default text-md">Appointment history</h2>
              <p className="m-0 text-muted text-xs">
                Every appointment on this record, newest first.
              </p>
            </div>

            {patient.appointments.length === 0 ? (
              <div className="border-border border-t px-6 py-10 text-center text-muted text-xs">
                No appointments yet.
              </div>
            ) : (
              <ul className="m-0 list-none p-0">
                {patient.appointments.map((appointment) => (
                  <li
                    key={appointment.id}
                    className="flex items-center justify-between gap-4 border-border border-t px-6 py-4"
                  >
                    <span className="flex flex-col gap-0.5">
                      <strong className="font-semibold text-default text-xs">
                        {formatDateTime(appointment.startAt, timeZone)}
                      </strong>
                      <small className="text-muted text-xs">
                        {appointment.doctorName}
                        {appointment.serviceName === null ? '' : ` · ${appointment.serviceName}`}
                      </small>
                    </span>
                    <Badge kind={statusBadge(appointment.status, appointment.source)}>
                      {statusLabel(appointment.status, appointment.source)}
                    </Badge>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card padded={false} className="p-0">
            <div className="flex flex-col gap-0.5 px-6 py-4">
              <h2 className="m-0 font-semibold text-default text-md">Follow-ups</h2>
              <p className="m-0 text-muted text-xs">Tasks linked to this patient.</p>
            </div>

            <div className="border-border border-t px-6 py-6">
              <EmptyState
                title="Follow-ups are not available yet"
                body="There is no follow-up endpoint in the platform, so nothing is shown here rather than an empty list that would imply this patient has none. Follow-ups arrive as their own feature."
              />
            </div>
          </Card>

          <Card>
            <h2 className="m-0 mb-2 font-semibold text-default text-md">Notes</h2>
            <p className="m-0 whitespace-pre-wrap text-muted text-xs">
              {patient.notes ?? 'No notes recorded.'}
            </p>
          </Card>
        </div>
      </div>

      {editing && (
        <PatientForm
          patient={patient}
          onClose={() => {
            setEditing(false);
          }}
        />
      )}
    </>
  );
};
