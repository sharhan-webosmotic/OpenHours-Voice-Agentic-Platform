import { clinicProfileSchema, type ClinicProfileInput } from '@clinicai/shared';
import type { ClinicDetailView } from '@clinicai/api-client';
import { Field } from '../../../components/ui/Field';
import { clinicsApi } from '../../../lib/clinicsApi';
import { SectionCard } from '../SectionCard';
import { useSaveSection } from '../useClinics';
import { useSectionForm } from '../useSectionForm';

/**
 * Identity, contact details, address and map link.
 *
 * EVERY FIELD IS NULLABLE AND THE FORM BINDS EMPTY STRINGS TO THEM, which needs saying
 * because the two are not the same thing. An uncollected field is `null` in the database; an
 * HTML input has no null, only `''`. The schema's `.nullable()` accepts both, and the empty
 * strings a form sends are stored as empty rather than as null. That is deliberate and
 * harmless for text, and it is why `readiness` tests for a non-blank value rather than for
 * `!== null`: a clinic whose address is a space is not a clinic with an address.
 */
export const ProfileSection = ({
  clinic,
  canWrite,
  missingCount,
}: {
  readonly clinic: ClinicDetailView;
  readonly canWrite: boolean;
  readonly missingCount: number;
}) => {
  const save = useSaveSection<ClinicProfileInput>(clinic.organisation.id, clinicsApi.saveProfile);

  const { form, submit, saving, error, success } = useSectionForm<ClinicProfileInput>({
    schema: clinicProfileSchema,
    defaultValues: {
      legalName: clinic.profile?.legalName ?? '',
      contactEmail: clinic.profile?.contactEmail ?? '',
      contactPhone: clinic.profile?.contactPhone ?? '',
      website: clinic.profile?.website ?? '',
      addressLine1: clinic.profile?.addressLine1 ?? '',
      addressLine2: clinic.profile?.addressLine2 ?? '',
      city: clinic.profile?.city ?? '',
      state: clinic.profile?.state ?? '',
      postalCode: clinic.profile?.postalCode ?? '',
      country: clinic.profile?.country ?? 'IN',
      mapUrl: clinic.profile?.mapUrl ?? '',
    },
    save: (input) => save.mutateAsync(input),
    successMessage: 'Profile saved.',
  });

  const { register, formState } = form;
  const fieldError = (name: keyof ClinicProfileInput): string | undefined =>
    formState.errors[name]?.message;

  return (
    <SectionCard
      id="profile"
      title="Identity and address"
      description="What the clinic is called, where it is, and how a patient reaches a person. The agent reads the address out when asked where you are."
      missingCount={missingCount}
      canWrite={canWrite}
      saving={saving}
      error={error}
      success={success}
      onSubmit={canWrite ? submit : undefined}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Legal name"
          hint="Only if it differs from the name patients know."
          disabled={!canWrite}
          error={fieldError('legalName')}
          {...register('legalName')}
        />
        <Field
          label="Contact email"
          type="email"
          disabled={!canWrite}
          error={fieldError('contactEmail')}
          {...register('contactEmail')}
        />
        <Field
          label="Contact phone"
          hint="This also becomes the clinic's public line, so the number patients are given and the number we store stay the same."
          disabled={!canWrite}
          error={fieldError('contactPhone')}
          {...register('contactPhone')}
        />
        <Field
          label="Website"
          hint="https:// only."
          disabled={!canWrite}
          error={fieldError('website')}
          {...register('website')}
        />
        <Field
          label="Address line 1"
          disabled={!canWrite}
          error={fieldError('addressLine1')}
          {...register('addressLine1')}
        />
        <Field
          label="Address line 2"
          disabled={!canWrite}
          error={fieldError('addressLine2')}
          {...register('addressLine2')}
        />
        <Field label="City" disabled={!canWrite} error={fieldError('city')} {...register('city')} />
        <Field
          label="State"
          disabled={!canWrite}
          error={fieldError('state')}
          {...register('state')}
        />
        <Field
          label="Postal code"
          disabled={!canWrite}
          error={fieldError('postalCode')}
          {...register('postalCode')}
        />
        <Field
          label="Country"
          hint="Two-letter code, such as IN."
          disabled={!canWrite}
          error={fieldError('country')}
          {...register('country')}
        />
        <Field
          label="Map link"
          hint="A link the agent can offer to send. https:// only."
          disabled={!canWrite}
          error={fieldError('mapUrl')}
          {...register('mapUrl')}
        />
      </div>
    </SectionCard>
  );
};
