import { useState } from 'react';
import { clinicHoursSchema } from '@clinicai/shared';
import type { DoctorView } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { SelectField } from '../../components/ui/Input';
import { Spinner } from '../../components/ui/Spinner';
import { errorMessage } from '../../lib/problem';
import { useCan } from '../../lib/useCan';
import { useDoctorHoursQuery, useReplaceDoctorHoursMutation } from '../clinic/api';
import { WeeklyHoursEditor } from './WeeklyHoursEditor';

/**
 * Each doctor's working week, from the availability reference: a doctor chosen at the top
 * and the same week editor as the clinic's below it.
 *
 * ─── THE TWO WEEKS ARE INTERSECTED, NOT ONE ─────────────────────────────────────
 *
 * A slot is offered only where the clinic is open AND the doctor is working. The sentence
 * under the picker says so, because a doctor's 08:00 start inside a clinic that opens at
 * 09:00 is not an error to refuse, it is simply never offered, and a receptionist who does
 * not know that will think the setting is broken.
 */
export const DoctorAvailability = ({
  organisationId,
  doctors,
}: {
  readonly organisationId: string;
  readonly doctors: readonly DoctorView[];
}) => {
  const canWrite = useCan('doctors_services_hours', 'write');
  const active = doctors.filter((doctor) => doctor.active);
  const [doctorId, setDoctorId] = useState(active[0]?.id ?? '');
  const doctor = active.find((candidate) => candidate.id === doctorId);

  const hours = useDoctorHoursQuery({ organisationId, doctorId }, { skip: doctorId === '' });
  const [replace, replacing] = useReplaceDoctorHoursMutation();

  if (active.length === 0) {
    return (
      <Alert kind="info">
        This clinic has no active doctor yet. A platform administrator adds one in the admin
        console, and their week is set here.
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2 rounded-lg border border-border-chrome bg-surface-sunken p-4">
        <div className="max-w-md">
          <SelectField
            label="Doctor"
            value={doctorId}
            onChange={(event) => {
              setDoctorId(event.target.value);
            }}
            options={active.map((candidate) => ({
              value: candidate.id,
              label:
                candidate.specialty === null
                  ? candidate.fullName
                  : `${candidate.fullName} · ${candidate.specialty}`,
            }))}
          />
        </div>
        <p className="m-0 text-muted text-xs">
          A slot is offered only where the clinic is open and this doctor is working.
        </p>
      </div>

      {hours.isError && (
        <Alert kind="danger">
          {errorMessage(hours.error, "The doctor's hours could not be loaded.")}
        </Alert>
      )}
      {hours.isLoading && <Spinner />}

      {hours.data !== undefined && doctor !== undefined && (
        <WeeklyHoursEditor
          week={hours.data.days}
          canWrite={canWrite}
          saving={replacing.isLoading}
          noun={doctor.fullName}
          onSave={async (week) => {
            const parsed = clinicHoursSchema.safeParse({
              days: week.map((day) => ({ weekday: day.weekday, segments: [...day.segments] })),
            });
            if (!parsed.success) {
              return parsed.error.issues.map((issue) => issue.message).join(' ');
            }
            try {
              await replace({ organisationId, doctorId, input: parsed.data }).unwrap();
              return undefined;
            } catch (caught) {
              return errorMessage(caught, "The doctor's hours were not saved.");
            }
          }}
        />
      )}
    </div>
  );
};
