import { RECORDING_CONSENT_MODES, telephonySchema, type TelephonyInput } from '@clinicai/shared';
import type { ClinicDetailView } from '@clinicai/api-client';
import { Field } from '../../../components/ui/Field';
import { SelectField, TextAreaField } from '../../../components/ui/Input';
import { clinicsApi } from '../../../lib/clinicsApi';
import { SectionCard } from '../SectionCard';
import { useSaveSection } from '../useClinics';
import { useSectionForm } from '../useSectionForm';

/**
 * Recording and consent.
 *
 * A LEGAL POSITION RATHER THAN A PREFERENCE, which is why it is its own section and why the
 * announcement text is stored verbatim: the point of keeping the exact words is that the
 * caller hears those words and not a paraphrase of them, and that what they heard can be
 * shown later.
 *
 * CONFIRMING IS AN ATTRIBUTED ACT. The checkbox becomes a timestamp and a name on the
 * server, because "consent arrangement confirmed" with nobody attached to it is not evidence
 * of anything. The two move together or not at all, enforced by a CHECK constraint as well
 * as by the schema.
 */

const MODE_LABELS: Record<(typeof RECORDING_CONSENT_MODES)[number], string> = {
  NOT_RECORDED: 'Calls are not recorded',
  ANNOUNCEMENT: 'Play a notice, then continue',
  EXPLICIT_OPT_IN: 'Ask for consent before recording',
};

export const TelephonySection = ({
  clinic,
  canWrite,
  missingCount,
}: {
  readonly clinic: ClinicDetailView;
  readonly canWrite: boolean;
  readonly missingCount: number;
}) => {
  const save = useSaveSection<TelephonyInput>(clinic.organisation.id, clinicsApi.saveTelephony);

  const { form, submit, saving, error, success } = useSectionForm<TelephonyInput>({
    schema: telephonySchema,
    defaultValues: {
      recordingConsentMode: clinic.telephony?.recordingConsentMode ?? null,
      consentAnnouncement: clinic.telephony?.consentAnnouncement ?? '',
      consentConfirmed: clinic.telephony?.consentConfirmed ?? false,
      consentConfirmedByName: clinic.telephony?.consentConfirmedByName ?? '',
    } as never,
    save: (input) => save.mutateAsync(input),
    successMessage: 'Recording and consent saved.',
  });

  const { register, formState } = form;
  const fieldError = (name: keyof TelephonyInput): string | undefined =>
    formState.errors[name]?.message;

  return (
    <SectionCard
      id="telephony"
      title="Recording and consent"
      description="Whether calls are recorded and how the caller is told. Required before go-live even when the answer is that nothing is recorded."
      missingCount={missingCount}
      canWrite={canWrite}
      saving={saving}
      error={error}
      success={success}
      onSubmit={canWrite ? submit : undefined}
    >
      {/* The object-level refinement, such as a notice mode with no notice written, is
          attached to the form root by the resolver, so it has to be rendered. */}
      {formState.errors.root?.message !== undefined && (
        <p className="m-0 text-xs text-danger" role="alert">
          {formState.errors.root.message}
        </p>
      )}

      <SelectField
        label="Recording and consent"
        placeholder="Not decided yet"
        disabled={!canWrite}
        error={fieldError('recordingConsentMode')}
        options={RECORDING_CONSENT_MODES.map((mode) => ({ value: mode, label: MODE_LABELS[mode] }))}
        {...register('recordingConsentMode' as never, {
          setValueAs: (value: unknown) => (value === '' ? null : value),
        })}
      />

      <TextAreaField
        label="The notice, word for word"
        hint="Exactly what the caller hears. Required for either mode that plays a notice."
        rows={2}
        disabled={!canWrite}
        error={fieldError('consentAnnouncement')}
        {...register('consentAnnouncement' as never)}
      />

      <label className="flex items-center gap-2 text-xs text-default">
        <input type="checkbox" disabled={!canWrite} {...register('consentConfirmed' as never)} />
        Someone at the clinic has confirmed this arrangement
      </label>

      <Field
        label="Confirmed by"
        hint="The name of the person at the clinic who agreed to it. Staff only, never a patient."
        disabled={!canWrite}
        error={fieldError('consentConfirmedByName')}
        {...register('consentConfirmedByName' as never)}
      />

      {clinic.telephony?.consentConfirmedAt !== null &&
        clinic.telephony?.consentConfirmedAt !== undefined && (
          <p className="m-0 text-xs text-muted">
            Last confirmed on{' '}
            {new Date(clinic.telephony.consentConfirmedAt).toLocaleString('en-IN')} by{' '}
            {clinic.telephony.consentConfirmedByName ?? 'an unnamed person'}.
          </p>
        )}
    </SectionCard>
  );
};
