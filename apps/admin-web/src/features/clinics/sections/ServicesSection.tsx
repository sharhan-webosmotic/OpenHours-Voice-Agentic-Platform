import { useState } from 'react';
import { serviceSchema, type ServiceInput } from '@clinicai/shared';
import type { ClinicDetailView } from '@clinicai/api-client';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Badge, Cell, Row, Table } from '../../../components/ui/Table';
import { clinicsApi } from '../../../lib/clinicsApi';
import { SectionCard } from '../SectionCard';
import { applyServerErrors, useSaveSection } from '../useClinics';

/**
 * The services a patient can book.
 *
 * ROWS ARE ADDED AND TOGGLED INDIVIDUALLY, unlike the sections that replace a whole list.
 * A service is referenced by appointments, so it has an identity worth keeping: replacing
 * the list wholesale would mean deleting and recreating rows that bookings point at. That is
 * also why there is no delete control. Switching a service off removes it from what the agent
 * offers and leaves the history of what was booked intact.
 *
 * AN INTERNAL ADMIN SEES THIS AND CANNOT CHANGE IT. The matrix gives that role read on
 * `doctors_services_hours`, and the brief accepted that for the pilot rather than widening
 * the cell. A super admin does the editing, and `docs/features/pilot-clinic.md` records that
 * the limit needs revisiting when support staff start onboarding clinics.
 */

const formatPrice = (priceMinor: number | null): string =>
  priceMinor === null ? 'Not recorded' : `${String(Math.round(priceMinor / 100))} rupees`;

export const ServicesSection = ({
  clinic,
  canWrite,
  missingCount,
}: {
  readonly clinic: ClinicDetailView;
  readonly canWrite: boolean;
  readonly missingCount: number;
}) => {
  const [name, setName] = useState('');
  const [duration, setDuration] = useState('30');
  const [price, setPrice] = useState('');
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);

  const add = useSaveSection<ServiceInput, { readonly serviceId: string }>(
    clinic.organisation.id,
    clinicsApi.createService,
  );

  const toggle = useSaveSection<{ readonly id: string; readonly active: boolean }>(
    clinic.organisation.id,
    (organisationId, input) =>
      clinicsApi.updateService(organisationId, input.id, { active: input.active }),
  );

  const submit = (): void => {
    setError(undefined);
    setSuccess(undefined);

    const parsed = serviceSchema.safeParse({
      name,
      // An empty price is "not recorded", which is not the same as free.
      durationMinutes: duration === '' ? Number.NaN : Number(duration),
      priceMinor: price === '' ? null : Math.round(Number(price) * 100),
      active: true,
    });

    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }

    add
      .mutateAsync(parsed.data)
      .then(() => {
        setSuccess(`${parsed.data.name} added.`);
        setName('');
        setPrice('');
      })
      .catch((caught: unknown) => {
        setError(applyServerErrors(caught, () => undefined) ?? 'The service was not added.');
      });
  };

  return (
    <SectionCard
      id="services"
      title="Services"
      description="What can be booked, and how long each takes. A service switched off is no longer offered but its bookings are kept."
      missingCount={missingCount}
      canWrite={canWrite}
      saving={add.isPending}
      error={error}
      success={success}
      onSubmit={undefined}
    >
      {clinic.services.length === 0 ? (
        <p className="m-0 text-xs text-muted">
          No services yet, so there is nothing for the agent to book.
        </p>
      ) : (
        <Table
          caption="Services this clinic offers"
          head={['Service', 'Duration', 'Price', 'Status', '']}
        >
          {clinic.services.map((service) => (
            <Row key={service.id}>
              <Cell>{service.name}</Cell>
              <Cell muted>{service.durationMinutes} minutes</Cell>
              <Cell muted={service.priceMinor === null}>{formatPrice(service.priceMinor)}</Cell>
              <Cell>
                <Badge kind={service.active ? 'success' : 'neutral'}>
                  {service.active ? 'offered' : 'not offered'}
                </Badge>
              </Cell>
              <Cell>
                {canWrite && (
                  <button
                    type="button"
                    className="text-xs text-default hover:underline"
                    disabled={toggle.isPending}
                    onClick={() => {
                      void toggle.mutateAsync({ id: service.id, active: !service.active });
                    }}
                  >
                    {service.active ? 'Stop offering' : 'Offer again'}
                  </button>
                )}
              </Cell>
            </Row>
          ))}
        </Table>
      )}

      {canWrite && (
        <div className="mt-4 flex flex-col gap-3 rounded-md border border-border border-dashed p-3">
          <strong className="font-semibold text-xs text-default">Add a service</strong>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field
              label="Name"
              placeholder="Consultation"
              value={name}
              onChange={(event) => {
                setName(event.target.value);
              }}
            />
            <Field
              label="Duration, in minutes"
              type="number"
              min={5}
              max={480}
              value={duration}
              onChange={(event) => {
                setDuration(event.target.value);
              }}
            />
            <Field
              label="Price, in rupees"
              type="number"
              min={0}
              hint="Leave empty if the clinic does not want a price quoted."
              value={price}
              onChange={(event) => {
                setPrice(event.target.value);
              }}
            />
          </div>
          <div>
            <Button loading={add.isPending} onClick={submit}>
              Add service
            </Button>
          </div>
        </div>
      )}
    </SectionCard>
  );
};
