import { useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { patientSchema, type PatientInput, type PatientSex } from '@clinicai/shared';
import type { PatientDetail } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { TextAreaField } from '../../components/ui/Input';
import { Overlay } from '../../components/ui/Overlay';
import { cn } from '../../components/ui/cn';
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

const SEX_OPTIONS: readonly { readonly value: PatientSex | null; readonly label: string }[] = [
  { value: null, label: 'Not recorded' },
  { value: 'FEMALE', label: 'Female' },
  { value: 'MALE', label: 'Male' },
];

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
    control,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<PatientInput>({
    resolver: zodResolver<PatientInput>(patientSchema),
    defaultValues: {
      fullName: patient?.fullName ?? '',
      phone: patient?.phone ?? '',
      dateOfBirth: patient?.dateOfBirth ?? '',
      sex: patient?.sex ?? null,
      email: patient?.email ?? '',
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

        {/*
         * A segmented choice rather than a select, so "Not recorded" is visibly one of the
         * answers. It is optional, and a select defaulting to it reads as a field left blank.
         */}
        <Controller
          control={control}
          name="sex"
          render={({ field }) => (
            <fieldset className="m-0 flex flex-col gap-1.5 border-0 p-0">
              <legend className="mb-1.5 p-0 font-semibold text-default text-xs">Sex</legend>
              <div role="radiogroup" aria-label="Sex" className="flex gap-2">
                {SEX_OPTIONS.map((option) => {
                  const checked = (field.value ?? null) === option.value;

                  return (
                    <button
                      key={option.label}
                      type="button"
                      role="radio"
                      aria-checked={checked}
                      onClick={() => {
                        field.onChange(option.value);
                      }}
                      className={cn(
                        'h-9 flex-1 rounded-control border font-semibold text-sm transition-colors',
                        checked
                          ? 'border-accent bg-accent-surface text-accent'
                          : 'border-border bg-surface text-muted hover:text-default',
                      )}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <span className="text-muted text-xs">
                Optional. Recorded by staff only: the AI receptionist never asks.
              </span>
            </fieldset>
          )}
        />

        <Field
          label="Email"
          hint="Optional."
          type="email"
          error={errors.email?.message}
          {...register('email')}
          autoComplete="off"
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
