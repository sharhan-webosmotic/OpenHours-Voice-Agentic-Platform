import { useState } from 'react';
import { doctorSchema, type DoctorInput } from '@clinicai/shared';
import type { ClinicDetailView } from '@clinicai/api-client';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Badge, Cell, Row, Table } from '../../../components/ui/Table';
import { clinicsApi } from '../../../lib/clinicsApi';
import { SectionCard } from '../SectionCard';
import { applyServerErrors, useSaveSection } from '../useClinics';

/**
 * The doctors a patient can be booked with.
 *
 * SAME SHAPE AS SERVICES, AND FOR THE SAME REASON: a doctor is referenced by appointments
 * and prescriptions, so the row has an identity and is switched off rather than deleted.
 * A doctor who leaves must not take their patients' appointment history with them.
 *
 * A DOCTOR HERE IS NOT A LOGIN. `doctors.user_id` links a bookable doctor to a DOCTOR-role
 * account when one exists, and the schema deliberately allows a doctor without one, because
 * a clinic needs its visiting consultant to be bookable long before anybody gets round to
 * issuing them a password. Creating accounts belongs to the clinic users feature.
 */
export const DoctorsSection = ({
  clinic,
  canWrite,
  missingCount,
}: {
  readonly clinic: ClinicDetailView;
  readonly canWrite: boolean;
  readonly missingCount: number;
}) => {
  const [fullName, setFullName] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [buffer, setBuffer] = useState('0');
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);

  const add = useSaveSection<DoctorInput, { readonly doctorId: string }>(
    clinic.organisation.id,
    clinicsApi.createDoctor,
  );

  const toggle = useSaveSection<{ readonly id: string; readonly active: boolean }>(
    clinic.organisation.id,
    (organisationId, input) =>
      clinicsApi.updateDoctor(organisationId, input.id, { active: input.active }),
  );

  const submit = (): void => {
    setError(undefined);
    setSuccess(undefined);

    const parsed = doctorSchema.safeParse({
      fullName,
      specialty: specialty === '' ? null : specialty,
      bufferMinutes: buffer === '' ? 0 : Number(buffer),
      active: true,
    });

    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }

    add
      .mutateAsync(parsed.data)
      .then(() => {
        setSuccess(`${parsed.data.fullName} added.`);
        setFullName('');
        setSpecialty('');
      })
      .catch((caught: unknown) => {
        setError(applyServerErrors(caught, () => undefined) ?? 'The doctor was not added.');
      });
  };

  return (
    <SectionCard
      id="doctors"
      title="Doctors"
      description="Who a patient can be booked with. A doctor does not need a login to be bookable."
      missingCount={missingCount}
      canWrite={canWrite}
      saving={add.isPending}
      error={error}
      success={success}
      onSubmit={undefined}
    >
      {clinic.doctors.length === 0 ? (
        <p className="m-0 text-xs text-muted">
          No doctors yet, so a booking would have nobody to be with.
        </p>
      ) : (
        <Table
          caption="Doctors at this clinic"
          head={['Doctor', 'Specialty', 'Buffer', 'Status', '']}
        >
          {clinic.doctors.map((doctor) => (
            <Row key={doctor.id}>
              <Cell>{doctor.fullName}</Cell>
              <Cell muted={doctor.specialty === null}>{doctor.specialty ?? 'Not recorded'}</Cell>
              <Cell muted>{doctor.bufferMinutes} minutes</Cell>
              <Cell>
                <Badge kind={doctor.active ? 'success' : 'neutral'}>
                  {doctor.active ? 'bookable' : 'not bookable'}
                </Badge>
              </Cell>
              <Cell>
                {canWrite && (
                  <button
                    type="button"
                    className="text-xs text-default hover:underline"
                    disabled={toggle.isPending}
                    onClick={() => {
                      void toggle.mutateAsync({ id: doctor.id, active: !doctor.active });
                    }}
                  >
                    {doctor.active ? 'Stop booking' : 'Make bookable'}
                  </button>
                )}
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      {canWrite && (
        <div className="mt-4 flex flex-col gap-3 rounded-md border border-border border-dashed p-3">
          <strong className="font-semibold text-xs text-default">Add a doctor</strong>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Full name"
              placeholder="Dr Asha Rao"
              value={fullName}
              onChange={(event) => {
                setFullName(event.target.value);
              }}
            />
            <Field
              label="Specialty"
              placeholder="Orthodontics"
              value={specialty}
              onChange={(event) => {
                setSpecialty(event.target.value);
              }}
            />
            <Field
              label="Buffer after each appointment, in minutes"
              type="number"
              min={0}
              max={120}
              hint="Overrides the clinic default for this doctor."
              value={buffer}
              onChange={(event) => {
                setBuffer(event.target.value);
              }}
            />
          </div>
          <div>
            <Button loading={add.isPending} onClick={submit}>
              Add doctor
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
};
