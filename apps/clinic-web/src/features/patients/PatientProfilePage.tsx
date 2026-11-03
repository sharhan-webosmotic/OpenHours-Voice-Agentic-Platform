import { useState } from 'react';
import { Link, useParams } from 'react-router';
import { ArrowLeft } from 'lucide-react';
import { Alert } from '../../components/ui/Alert';
import { Avatar } from '../../components/ui/Avatar';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Spinner } from '../../components/ui/Spinner';
import { useCan } from '../../lib/useCan';
import { errorMessage, isNotFound } from '../../lib/problem';
import { ageOn, clinicToday, formatDateOfBirth } from '../../lib/clinicTime';
import { formatPhone } from '../../lib/phone';
import { useClinic } from '../clinic/api';
import { PatientForm } from './PatientForm';
import { usePatientQuery } from './api';
import { AppointmentOverlay, NextAppointmentCard, PatientTimeline } from './profile';

/**
 * One patient, built from the profile reference: a back link, an identity card on the left
 * with the contact details and notes under it, and the next appointment and the patient's
 * timeline on the right.
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
 * 4. AGE WHERE THE REFERENCE SHOWS SEX. Sex is not stored; the age is, through the date of
 *    birth, and it is the thing a receptionist checks a caller against.
 *
 * Follow-ups, documents and uploads are not on the timeline: see `profile.tsx`.
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
  const [openAppointmentId, setOpenAppointmentId] = useState<string | undefined>(undefined);

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
          <div className="flex flex-col items-center gap-2 text-center">
            <Avatar name={patient.fullName} size="xl" />
            <strong className="pt-1 font-semibold text-default text-md">
              {patient.fullName ?? 'Name hidden'}
            </strong>
            {patient.dateOfBirth !== null && (
              <span className="text-muted text-xs">
                {`${String(ageOn(patient.dateOfBirth, clinicToday(timeZone)))} years old`}
              </span>
            )}
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

          <dl className="m-0 flex flex-col gap-4 border-border-chrome border-t pt-5">
            <div className="flex flex-col gap-1">
              <dt className="text-muted text-xs uppercase tracking-[0.4px]">Phone</dt>
              <dd className="m-0 font-semibold text-default text-sm tabular-nums">
                {patient.phone === null ? 'Hidden' : formatPhone(patient.phone)}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted text-xs uppercase tracking-[0.4px]">Date of birth</dt>
              <dd className="m-0 font-semibold text-default text-sm">
                {formatDateOfBirth(patient.dateOfBirth)}
              </dd>
            </div>
            <div className="flex flex-col gap-1">
              <dt className="text-muted text-xs uppercase tracking-[0.4px]">Notes</dt>
              <dd className="m-0 whitespace-pre-wrap text-default text-sm">
                {patient.notes ?? 'No notes recorded.'}
              </dd>
            </div>
          </dl>
        </Card>

        <div className="flex min-w-0 flex-col gap-4">
          <NextAppointmentCard
            patient={patient}
            timeZone={timeZone}
            onOpen={setOpenAppointmentId}
          />
          <PatientTimeline patient={patient} timeZone={timeZone} onOpen={setOpenAppointmentId} />
        </div>
      </div>

      {openAppointmentId !== undefined && (
        <AppointmentOverlay
          appointmentId={openAppointmentId}
          timeZone={timeZone}
          onClose={() => {
            setOpenAppointmentId(undefined);
          }}
        />
      )}

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
