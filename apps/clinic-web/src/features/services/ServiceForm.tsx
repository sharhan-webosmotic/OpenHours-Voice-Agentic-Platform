import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { serviceSchema, type ServiceInput } from '@clinicai/shared';
import type { ServiceView } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Overlay } from '../../components/ui/Overlay';
import { applyServerErrors } from '../../lib/problem';
import { useCreateServiceMutation, useUpdateServiceMutation } from '../clinic/api';

/**
 * Add and edit a service, from `docs/prototype/laptop-13-service-form.png`.
 *
 * ─── THE PRICE IS IN RUPEES HERE AND PAISE EVERYWHERE ELSE ──────────────────────
 *
 * Money is stored in integer minor units (root CLAUDE.md), and a receptionist types rupees.
 * The conversion happens at this edge and nowhere else: the field takes `1200`, the request
 * carries `120000`. Doing it anywhere deeper would mean two places that both think they know
 * the unit, which is how a clinic's prices end up a hundred times too large.
 *
 * AN EMPTY PRICE IS "NOT SET", NOT ZERO. A clinic that has not decided what to charge is a
 * different thing from one that charges nothing, and the schema's nullable `priceMinor` keeps
 * them apart.
 */

type ServiceFormValues = {
  readonly name: string;
  readonly durationMinutes: number;
  readonly priceRupees: string;
  readonly active: boolean;
};

export const ServiceForm = ({
  organisationId,
  service,
  onClose,
}: {
  readonly organisationId: string;
  /** Absent for a new service. */
  readonly service?: ServiceView | undefined;
  readonly onClose: () => void;
}) => {
  const [createService, creating] = useCreateServiceMutation();
  const [updateService, updating] = useUpdateServiceMutation();
  const [formError, setFormError] = useState<string | undefined>(undefined);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<ServiceFormValues>({
    defaultValues: {
      name: service?.name ?? '',
      durationMinutes: service?.durationMinutes ?? 30,
      priceRupees:
        service?.priceMinor === null || service?.priceMinor === undefined
          ? ''
          : String(service.priceMinor / 100),
      active: service?.active ?? true,
    },
  });

  const submit = handleSubmit(async (values) => {
    setFormError(undefined);

    const input: ServiceInput = {
      name: values.name.trim(),
      durationMinutes: Number(values.durationMinutes),
      priceMinor:
        values.priceRupees.trim() === '' ? null : Math.round(Number(values.priceRupees) * 100),
      active: values.active,
    };

    /**
     * Parsed against the SHARED schema before sending, so the form refuses what the API
     * would refuse and says the same thing about it. Without this the price conversion above
     * could send a fraction of a paisa and the failure would arrive as a server error.
     */
    const parsed = serviceSchema.safeParse(input);

    if (!parsed.success) {
      setFormError(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }

    try {
      if (service === undefined) {
        await createService({ organisationId, input: parsed.data }).unwrap();
      } else {
        await updateService({
          organisationId,
          serviceId: service.id,
          input: parsed.data,
        }).unwrap();
      }

      onClose();
    } catch (error) {
      setFormError(applyServerErrors(error, setError, 'The service was not saved.'));
    }
  });

  const saving = isSubmitting || creating.isLoading || updating.isLoading;

  return (
    <Overlay
      eyebrow={service === undefined ? 'NEW SERVICE' : 'EDIT SERVICE'}
      title={service === undefined ? 'Add service' : 'Edit service'}
      onClose={onClose}
      footer={
        <>
          <Button kind="secondary" onClick={onClose} disabled={saving}>
            Cancel
          </Button>
          <Button
            loading={saving}
            onClick={() => {
              void submit();
            }}
          >
            Save service
          </Button>
        </>
      }
    >
      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void submit();
        }}
      >
        {formError !== undefined && <Alert kind="danger">{formError}</Alert>}

        <Field
          label="Service name"
          error={errors.name?.message}
          {...register('name', { required: 'is required' })}
        />

        <Field
          label="Duration in minutes"
          hint="How long the appointment takes. It is what the slot grid is built from."
          type="number"
          min={5}
          max={480}
          step={5}
          error={errors.durationMinutes?.message}
          {...register('durationMinutes', { valueAsNumber: true })}
        />

        <Field
          label="Price in rupees"
          hint="Optional. Leave it empty if the clinic has not set a price."
          type="number"
          min={0}
          step={1}
          error={errors.priceRupees?.message}
          {...register('priceRupees')}
        />

        <label className="flex items-center gap-2 text-default text-xs">
          <input type="checkbox" {...register('active')} />
          Bookable
        </label>
      </form>
    </Overlay>
  );
};
