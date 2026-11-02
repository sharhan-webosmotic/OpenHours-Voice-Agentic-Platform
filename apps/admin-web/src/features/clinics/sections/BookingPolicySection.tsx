import { bookingPolicySchema, type BookingPolicyInput } from '@clinicai/shared';
import type { ClinicDetailView } from '@clinicai/api-client';
import { Field } from '../../../components/ui/Field';
import { SelectField } from '../../../components/ui/Input';
import { TextAreaField } from '../../../components/ui/Input';
import { clinicsApi } from '../../../lib/clinicsApi';
import { SectionCard } from '../SectionCard';
import { useSaveSection } from '../useClinics';
import { useSectionForm } from '../useSectionForm';

/**
 * The rules that decide whether a requested appointment is bookable.
 *
 * NUMBERS ARE REGISTERED WITH `valueAsNumber`, and an empty field becomes `null` rather
 * than `0` or `NaN`. That distinction is the whole point of this section: a maximum advance
 * of `0` days means no booking is ever possible, and `null` means nobody has told us yet.
 * `react-hook-form` hands back `NaN` for an empty numeric input, which is neither, so each
 * one is converted explicitly.
 */
export const BookingPolicySection = ({
  clinic,
  canWrite,
  missingCount,
}: {
  readonly clinic: ClinicDetailView;
  readonly canWrite: boolean;
  readonly missingCount: number;
}) => {
  const save = useSaveSection<BookingPolicyInput>(
    clinic.organisation.id,
    clinicsApi.saveBookingPolicy,
  );

  const { form, submit, saving, error, success } = useSectionForm<BookingPolicyInput>({
    schema: bookingPolicySchema,
    defaultValues: {
      slotGranularityMinutes: clinic.bookingPolicy?.slotGranularityMinutes ?? null,
      minimumNoticeMinutes: clinic.bookingPolicy?.minimumNoticeMinutes ?? null,
      maximumAdvanceDays: clinic.bookingPolicy?.maximumAdvanceDays ?? null,
      cancellationWindowHours: clinic.bookingPolicy?.cancellationWindowHours ?? null,
      acceptsNewPatients: clinic.bookingPolicy?.acceptsNewPatients ?? null,
      defaultBufferMinutes: clinic.bookingPolicy?.defaultBufferMinutes ?? null,
      maxPerSlot: clinic.bookingPolicy?.maxPerSlot ?? null,
      noShowPolicy: clinic.bookingPolicy?.noShowPolicy ?? '',
    },
    save: (input) => save.mutateAsync(input),
    successMessage: 'Booking policy saved.',
  });

  const { register, formState } = form;

  /**
   * A numeric field whose empty state is `null`.
   *
   * `setValueAs` runs before validation, so the schema sees `null` for an empty input
   * instead of `NaN`, which it would reject with a message about expecting a number: true
   * but unhelpful for a field that is legitimately not yet collected.
   */
  const numeric = (name: keyof BookingPolicyInput) =>
    register(name as never, {
      setValueAs: (value: unknown) =>
        value === '' || value === null || value === undefined ? null : Number(value),
    });

  const fieldError = (name: keyof BookingPolicyInput): string | undefined =>
    formState.errors[name]?.message;

  return (
    <SectionCard
      id="bookingPolicy"
      title="Booking policy"
      description="How far ahead, how late, and in what size of slot. The agent is told these rules and will contradict any rule it does not know."
      missingCount={missingCount}
      canWrite={canWrite}
      saving={saving}
      error={error}
      success={success}
      onSubmit={canWrite ? submit : undefined}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Slot length, in minutes"
          type="number"
          min={5}
          max={120}
          disabled={!canWrite}
          error={fieldError('slotGranularityMinutes')}
          {...numeric('slotGranularityMinutes')}
        />
        <Field
          label="Minimum notice, in minutes"
          type="number"
          min={0}
          hint="How soon before a slot a booking may still be made."
          disabled={!canWrite}
          error={fieldError('minimumNoticeMinutes')}
          {...numeric('minimumNoticeMinutes')}
        />
        <Field
          label="Maximum advance, in days"
          type="number"
          min={1}
          max={365}
          disabled={!canWrite}
          error={fieldError('maximumAdvanceDays')}
          {...numeric('maximumAdvanceDays')}
        />
        <Field
          label="Cancellation window, in hours"
          type="number"
          min={0}
          max={168}
          hint="How late a patient may cancel without it counting against them."
          disabled={!canWrite}
          error={fieldError('cancellationWindowHours')}
          {...numeric('cancellationWindowHours')}
        />
        <Field
          label="Default buffer after an appointment, in minutes"
          type="number"
          min={0}
          max={120}
          disabled={!canWrite}
          error={fieldError('defaultBufferMinutes')}
          {...numeric('defaultBufferMinutes')}
        />
        <Field
          label="Appointments per slot"
          type="number"
          min={1}
          max={10}
          hint="More than one only if the clinic deliberately overbooks."
          disabled={!canWrite}
          error={fieldError('maxPerSlot')}
          {...numeric('maxPerSlot')}
        />
        <SelectField
          label="Accepting new patients"
          placeholder="Not asked yet"
          disabled={!canWrite}
          error={fieldError('acceptsNewPatients')}
          options={[
            { value: 'true', label: 'Yes' },
            { value: 'false', label: 'No' },
          ]}
          {...register('acceptsNewPatients' as never, {
            /**
             * A tri-state select: not asked, yes, no. The empty option is "not asked",
             * which is NOT the same answer as "no".
             *
             * THE NULL AND UNDEFINED CASES ARE THE BUG THIS GUARDS, and a rendered prompt
             * is what exposed it. React Hook Form passes the STORED value here when the
             * control has never been touched, not the DOM's empty string, so a clinic
             * nobody had asked arrived as `null`, fell past the `=== ''` test, and
             * `null === 'true'` evaluated to `false`. The clinic was then stored as not
             * accepting new patients, and the agent would have told callers exactly that.
             */
            setValueAs: (value: unknown) =>
              value === '' || value === null || value === undefined ? null : value === 'true',
          })}
        />
      </div>

      <TextAreaField
        label="No-show policy"
        hint="In the words the agent should use if a caller asks."
        rows={2}
        disabled={!canWrite}
        error={fieldError('noShowPolicy')}
        {...register('noShowPolicy' as never)}
      />
    </SectionCard>
  );
};
