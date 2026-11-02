import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { patientSchema, type PatientInput } from '@clinicai/shared';
import type { PatientDetail } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { TextAreaField } from '../../components/ui/Input';
import { Overlay } from '../../components/ui/Overlay';
import { zodResolver } from '../../lib/zodResolver';
import { applyServerErrors } from '../../lib/problem';
import { useCreatePatientMutation, useUpdatePatientMutation } from './api';

/**
 * Add and edit a patient, as the prototype's modal has it.
 *
 * ONE FORM FOR BOTH, because they are the same four fields and the prototype draws them
 * identically, with only the heading and the button differing. Two components would be two
 * places to forget the phone normalisation.
 *
 * VALIDATED AGAINST THE SHARED SCHEMA, which is the same object the API parses with, so the
 * rules cannot disagree: `+91` is applied by `patientSchema`'s own transform rather than by
 * anything here, and a blank optional field becomes null in the client exactly as it does on
 * the server.
 */

export const PatientForm = ({
  patient,
  onClose,
  onSaved,
}: {
  /** Absent for a new patient. */
  readonly patient?: PatientDetail | undefined;
  readonly onClose: () => void;
  readonly onSaved?: ((patientId: string) => void) | undefined;
}) => {
  const [createPatient, creating] = useCreatePatientMutation();
  const [updatePatient, updating] = useUpdatePatientMutation();
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PatientInput>({
    resolver: zodResolver<PatientInput>(patientSchema),
    defaultValues: {
      fullName: patient?.fullName ?? '',
      phone: patient?.phone ?? '',
      dateOfBirth: patient?.dateOfBirth ?? '',
      notes: patient?.notes ?? '',
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(undefined);

    try {
      if (patient === undefined) {
        const created = await createPatient(values).unwrap();
        onSaved?.(created.patientId);
      } else {
        await updatePatient({ patientId: patient.id, changes: values }).unwrap();
        onSaved?.(patient.id);
      }

      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, 'The patient was not saved.'));
    }
  });

  const saving = isSubmitting || creating.isLoading || updating.isLoading;

  return (
    <Overlay
      eyebrow={patient === undefined ? 'NEW PATIENT' : 'EDIT PATIENT'}
      title={patient === undefined ? 'Add patient' : 'Edit patient'}
      onClose={onClose}
      footer={
        <>
          <Button kind="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            type="submit"
            form="patient-form"
            loading={saving}
            onClick={() => {
              void submit();
            }}
          >
            Save patient
          </Button>
        </>
      }
    >
      <form
        id="patient-form"
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {formError !== undefined && <Alert kind="danger">{formError}</Alert>}

        <Field
          label="Full name"
          error={errors.fullName?.message}
          {...register('fullName')}
          autoComplete="off"
        />

        <Field
          label="Phone number"
          hint="A ten-digit Indian mobile number, or one with its country code."
          error={errors.phone?.message}
          {...register('phone')}
          inputMode="tel"
          autoComplete="off"
        />

        <Field
          label="Date of birth"
          hint="Optional. It is how two people with the same name are told apart."
          type="date"
          error={errors.dateOfBirth?.message}
          {...register('dateOfBirth')}
        />

        <TextAreaField
          label="Notes"
          hint="Optional. Anything the clinic should know before the visit."
          rows={3}
          error={errors.notes?.message}
          {...register('notes')}
        />
      </form>
    </Overlay>
  );
};
