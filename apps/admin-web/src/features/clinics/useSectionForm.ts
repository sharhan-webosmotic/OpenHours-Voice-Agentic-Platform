import { useState } from 'react';
import { useForm, type DefaultValues, type FieldValues, type UseFormReturn } from 'react-hook-form';
import type { ZodType } from 'zod';
import { zodResolver } from '../../lib/zodResolver';
import { applyServerErrors } from './useClinics';

/**
 * One section's form: validation against the shared schema, submit, and the three states a
 * save can be in.
 *
 * Nine sections need the same wiring, and writing it nine times is how one of them ends up
 * without a failure message or with a submit that can be pressed twice.
 *
 * IT RESETS TO THE PARSED VALUES AFTER A SUCCESSFUL SAVE, NOT TO THE RAW INPUT. The shared
 * schemas transform as well as validate: a phone number typed as `98765 43210` is stored as
 * `+919876543210` and an email is lower-cased. Resetting to what was typed would leave the
 * form showing something different from what is now stored, and the next save would send
 * the typed form again.
 *
 * IT DOES NOT TRACK SERVER STATE. The form is initialised from the clinic query once, and
 * `react-hook-form`'s `values` option is deliberately not used: that would re-synchronise
 * the form on every refetch, and since saving any section invalidates the whole clinic, a
 * save in one section would wipe half-finished typing in another.
 */
export const useSectionForm = <TInput extends FieldValues>({
  schema,
  defaultValues,
  save,
  successMessage,
}: {
  readonly schema: ZodType;
  readonly defaultValues: DefaultValues<TInput>;
  readonly save: (input: TInput) => Promise<unknown>;
  readonly successMessage: string;
}): {
  readonly form: UseFormReturn<TInput>;
  readonly submit: () => void;
  readonly saving: boolean;
  readonly error: string | undefined;
  readonly success: string | undefined;
} => {
  const form = useForm<TInput>({
    resolver: zodResolver<TInput>(schema),
    defaultValues,
  });

  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);

  const submit = form.handleSubmit(async (values) => {
    setError(undefined);
    setSuccess(undefined);
    setSaving(true);

    try {
      await save(values);
      setSuccess(successMessage);
      // The parsed values, so the form shows what was stored rather than what was typed.
      form.reset(values);
    } catch (caught) {
      setError(
        applyServerErrors(caught, form.setError) ??
          'The section was not saved. Check the fields marked below.',
      );
    } finally {
      setSaving(false);
    }
  });

  return {
    form,
    submit: () => {
      void submit();
    },
    saving,
    error,
    success,
  };
};
