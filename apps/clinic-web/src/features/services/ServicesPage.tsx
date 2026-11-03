import { useState } from 'react';
import type { ServiceView } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import { useClinic, useUpdateServiceMutation } from '../clinic/api';
import { ServiceForm } from './ServiceForm';
import { CatalogueStats, ServiceCard, summarise } from './catalogue';

/**
 * The services a clinic offers, from `docs/prototype/laptop-12-services.png`.
 *
 * The capture's shape is kept: a header card with the primary action, then a grid of cards,
 * each with a status badge, a name, a divider, duration and price, and two actions.
 *
 * ─── THREE DEVIATIONS, ALL FROM THE SAME PLACE ──────────────────────────────────
 *
 * 1. NO DESCRIPTION LINE. `services` has no description column. The capture shows one under
 *    every name.
 * 2. "Price", not "Sample price", and real rupees rather than dollars. The prototype's prices
 *    are demo values and say so; these are the clinic's own.
 * 3. THE HEADER CARD'S COPY IS NOT THE PROTOTYPE'S. It reads "Sample clinic services / Prices
 *    are fictional demo values", which is a sentence about the prototype rather than about
 *    the clinic. Repeating it in the product would be the one kind of dishonesty this feature
 *    is most careful about.
 *
 * DEACTIVATING IS NOT DELETING, which is why the action says what it does. A service with
 * appointments against it cannot be removed without taking the history with it, so the
 * product hides it from new bookings instead, and the API has no delete to call.
 */

export const ServicesPage = () => {
  const { data: clinic, isLoading, isError, error, refetch } = useClinic();
  const [updateService, updating] = useUpdateServiceMutation();
  const canWrite = useCan('doctors_services_hours', 'write');

  const [editing, setEditing] = useState<ServiceView | undefined>(undefined);
  const [adding, setAdding] = useState(false);
  const [problem, setProblem] = useState<string | undefined>(undefined);

  if (isLoading) {
    return <Spinner />;
  }

  if (isError) {
    return (
      <div className="flex flex-col items-start gap-3">
        <Alert kind="danger">{errorMessage(error, 'The services could not be loaded.')}</Alert>
        <Button
          kind="secondary"
          onClick={() => {
            void refetch();
          }}
        >
          Try again
        </Button>
      </div>
    );
  }

  if (clinic === undefined) {
    return <Spinner />;
  }

  const toggle = async (service: ServiceView): Promise<void> => {
    setProblem(undefined);

    try {
      await updateService({
        organisationId: clinic.organisation.id,
        serviceId: service.id,
        input: { active: !service.active },
      }).unwrap();
    } catch (caught) {
      setProblem(errorMessage(caught, 'The service was not updated.'));
    }
  };

  return (
    <>
      <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1">
          <p className="m-0 font-bold text-accent text-xs uppercase tracking-[1px]">
            Care catalogue
          </p>
          <p className="m-0 text-muted text-sm">
            {`Manage the appointments patients can book at ${clinic.organisation.name}. Each service's length is what the booking grid is built from.`}
          </p>
        </div>

        {canWrite && (
          <Button
            onClick={() => {
              setAdding(true);
            }}
          >
            ＋ Add service
          </Button>
        )}
      </div>

      {clinic.services.length > 0 && <CatalogueStats summary={summarise(clinic.services)} />}

      {problem !== undefined && (
        <div className="mb-4">
          <Alert kind="danger">{problem}</Alert>
        </div>
      )}

      {clinic.services.length === 0 ? (
        <EmptyState
          title="No services yet"
          body="A service is what a patient books: its duration decides the slots the clinic can offer, so nothing can be booked until one exists."
          action={
            canWrite ? (
              <Button
                onClick={() => {
                  setAdding(true);
                }}
              >
                ＋ Add service
              </Button>
            ) : undefined
          }
        />
      ) : (
        <section aria-labelledby="services-heading">
          <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
            <div className="flex flex-col gap-0.5">
              <h2 id="services-heading" className="m-0 font-bold text-default text-lg">
                Services
              </h2>
              <p className="m-0 text-muted text-xs">
                What the AI receptionist and the front desk can book.
              </p>
            </div>
            <span className="text-muted text-xs">
              {`${String(summarise(clinic.services).active)} bookable`}
            </span>
          </div>

          <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
            {clinic.services.map((service, index) => (
              <li key={service.id}>
                <ServiceCard
                  service={service}
                  index={index}
                  canWrite={canWrite}
                  busy={updating.isLoading}
                  onEdit={() => {
                    setEditing(service);
                  }}
                  onToggle={() => {
                    void toggle(service);
                  }}
                />
              </li>
            ))}
          </ul>
        </section>
      )}

      {(adding || editing !== undefined) && (
        <ServiceForm
          organisationId={clinic.organisation.id}
          service={editing}
          onClose={() => {
            setAdding(false);
            setEditing(undefined);
          }}
        />
      )}
    </>
  );
};
