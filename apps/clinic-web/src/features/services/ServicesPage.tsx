import { useState } from 'react';
import { Briefcase } from 'lucide-react';
import type { ServiceView } from '@clinicai/api-client';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { Badge } from '../../components/ui/Table';
import { useCan } from '../../lib/useCan';
import { errorMessage } from '../../lib/problem';
import { formatDuration, formatMoney } from '../../lib/clinicTime';
import { useClinic, useUpdateServiceMutation } from '../clinic/api';
import { ServiceForm } from './ServiceForm';

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
      <Card className="mb-4 flex flex-wrap items-center justify-between gap-4 p-4">
        <div className="flex flex-col gap-0.5">
          <strong className="font-semibold text-default text-md">Clinic services</strong>
          <p className="m-0 text-muted text-xs">
            What this clinic offers, and how long each appointment takes. The duration is what the
            booking grid is built from.
          </p>
        </div>

        {canWrite && (
          <Button
            onClick={() => {
              setAdding(true);
            }}
          >
            ＋ Add Service
          </Button>
        )}
      </Card>

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
                ＋ Add Service
              </Button>
            ) : undefined
          }
        />
      ) : (
        <ul className="m-0 grid list-none grid-cols-1 gap-4 p-0 md:grid-cols-2 xl:grid-cols-3">
          {clinic.services.map((service) => (
            <li key={service.id}>
              <Card className="flex h-full flex-col gap-4">
                <div className="flex items-start justify-between gap-3">
                  <span
                    className="inline-flex size-10 items-center justify-center rounded-lg bg-accent-surface text-accent"
                    aria-hidden="true"
                  >
                    <Briefcase size={18} />
                  </span>
                  <Badge kind={service.active ? 'success' : 'neutral'}>
                    {service.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>

                <strong className="font-semibold text-default text-md">{service.name}</strong>

                <dl className="m-0 mt-auto grid grid-cols-2 gap-2 border-border border-t pt-4">
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted text-xs">Duration</dt>
                    <dd className="m-0 font-semibold text-default text-xs">
                      {formatDuration(service.durationMinutes)}
                    </dd>
                  </div>
                  <div className="flex flex-col gap-1">
                    <dt className="text-muted text-xs">Price</dt>
                    <dd className="m-0 font-semibold text-default text-xs">
                      {formatMoney(service.priceMinor)}
                    </dd>
                  </div>
                </dl>

                {canWrite && (
                  <div className="flex items-center gap-3">
                    <Button
                      kind="secondary"
                      onClick={() => {
                        setEditing(service);
                      }}
                    >
                      Edit details
                    </Button>
                    <button
                      type="button"
                      disabled={updating.isLoading}
                      onClick={() => {
                        void toggle(service);
                      }}
                      className="font-semibold text-accent text-xs hover:underline disabled:opacity-50"
                    >
                      {service.active ? 'Deactivate' : 'Activate'}
                    </button>
                  </div>
                )}
              </Card>
            </li>
          ))}
        </ul>
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
