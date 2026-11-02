import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useNavigate } from 'react-router';
import {
  SUGGESTED_TIME_ZONES,
  createOrganisationSchema,
  type CreateOrganisationInput,
} from '@clinicai/shared';
import { PageHeading } from '../../app/AppShell';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Field } from '../../components/ui/Field';
import { zodResolver } from '../../lib/zodResolver';
import { applyServerErrors, useCreateClinic } from './useClinics';

/**
 * Creating a clinic: the three things we cannot configure without.
 *
 * DELIBERATELY NOT A WIZARD. The brief says no wizard, and the reason holds up: the rest of
 * a clinic's configuration arrives over several conversations, so a nine-step form would be
 * abandoned at step three and the clinic would not exist at all. This creates the clinic,
 * and the detail page is where it gets filled in, with a readiness indicator saying what is
 * still outstanding.
 *
 * THE DOUBLE SUBMIT IS GUARDED TWICE. `Button` disables itself while `loading`, so the
 * control cannot be pressed again, and that is a courtesy rather than a control: a slow
 * network, a double click landing before React re-renders, or a browser retry all produce a
 * second POST the server cannot distinguish by intent. The real guard is the unique index on
 * the clinic name, which answers the second request with a 409 that this form shows.
 */
export const CreateClinicPage = () => {
  const navigate = useNavigate();
  const create = useCreateClinic();
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<CreateOrganisationInput>({
    resolver: zodResolver<CreateOrganisationInput>(createOrganisationSchema),
    defaultValues: { name: '', timezone: SUGGESTED_TIME_ZONES[0], clinicPhone: '' },
  });

  const onSubmit = handleSubmit(async (values) => {
    setFormError(undefined);

    try {
      const created = await create.mutateAsync(values);
      // Straight to the clinic that was just created, which is where the work continues.
      void navigate(`/clinics/${created.organisationId}`);
    } catch (error) {
      setFormError(applyServerErrors(error, setError));
    }
  });

  return (
    <>
      <PageHeading
        title="Add a clinic"
        description="The three details we cannot configure a clinic without. Everything else is collected afterwards."
      />

      <Card className="max-w-xl">
        <form
          onSubmit={(event) => {
            void onSubmit(event);
          }}
          className="flex flex-col gap-4"
          noValidate
        >
          {formError !== undefined && <Alert kind="danger">{formError}</Alert>}

          <Field
            label="Clinic name"
            placeholder="Sunrise Dental"
            hint="As patients know it. Two clinics cannot share a name."
            error={errors.name?.message}
            {...register('name')}
          />

          <Field
            label="Time zone"
            placeholder="Asia/Kolkata"
            hint="An IANA name such as Asia/Kolkata. Every appointment time is converted using this, so an abbreviation like IST is refused."
            error={errors.timezone?.message}
            {...register('timezone')}
          />

          <Field
            label="Clinic phone number"
            placeholder="98765 43210"
            hint="The clinic's own line. Typed however is convenient: it is stored as +91 followed by the number."
            error={errors.clinicPhone?.message}
            {...register('clinicPhone')}
          />

          <div className="flex items-center gap-3">
            {/* Disabled while in flight, so the button cannot produce a second request. */}
            <Button type="submit" loading={isSubmitting || create.isPending}>
              Create clinic
            </Button>
            <Link to="/clinics" className="text-xs text-muted hover:underline">
              Cancel
            </Link>
          </div>
        </form>
      </Card>
    </>
  );
};
