import { useState } from 'react';
import {
  ORGANISATION_STATUSES,
  updateOrganisationSchema,
  type OrganisationStatus,
} from '@clinicai/shared';
import type { ClinicDetailView } from '@clinicai/api-client';
import { Alert } from '../../../components/ui/Alert';
import { Field } from '../../../components/ui/Field';
import { SelectField } from '../../../components/ui/Input';
import { clinicsApi } from '../../../lib/clinicsApi';
import { SectionCard } from '../SectionCard';
import { applyServerErrors, useSaveSection } from '../useClinics';

/**
 * The clinic's name, time zone and status.
 *
 * THE TIME ZONE IS THE DANGEROUS FIELD HERE, and the hint says so. Every appointment instant
 * is stored in UTC and converted using this value, so changing it moves every booking the
 * clinic has. It is editable because a clinic entered with the wrong zone has to be
 * correctable, and the alternative, leaving it uneditable, would mean deleting and
 * recreating the clinic.
 *
 * SUSPENDING OR DEACTIVATING ASKS FIRST. A suspended clinic's staff cannot sign in and its
 * agent stops, which is a destructive action in the sense the admin console rules mean, so
 * it is confirmed rather than applied on a select change.
 */

const STATUS_LABELS: Record<OrganisationStatus, string> = {
  ACTIVE: 'Active',
  SUSPENDED: 'Suspended, staff cannot sign in',
  DEACTIVATED: 'Deactivated',
};

export const IdentitySection = ({
  clinic,
  canWrite,
  missingCount,
}: {
  readonly clinic: ClinicDetailView;
  readonly canWrite: boolean;
  readonly missingCount: number;
}) => {
  const [name, setName] = useState(clinic.organisation.name);
  const [timezone, setTimezone] = useState(clinic.organisation.timezone);
  const [status, setStatus] = useState<OrganisationStatus>(clinic.organisation.status);
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);

  /**
   * The patch type carries `| undefined` on every member, because `exactOptionalPropertyTypes`
   * distinguishes "absent" from "present and undefined" and the schema's output is the
   * second. The API treats an absent field as "leave it alone" either way.
   */
  const save = useSaveSection<{
    readonly name?: string | undefined;
    readonly timezone?: string | undefined;
    readonly status?: OrganisationStatus | undefined;
  }>(clinic.organisation.id, clinicsApi.update);

  // A status that stops the clinic working is confirmed before it is sent.
  const needsConfirmation = status !== 'ACTIVE' && status !== clinic.organisation.status;
  const [confirmed, setConfirmed] = useState(false);

  const submit = (): void => {
    setError(undefined);
    setSuccess(undefined);

    const parsed = updateOrganisationSchema.safeParse({ name, timezone, status });

    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }

    save
      .mutateAsync(parsed.data)
      .then(() => {
        setSuccess('Saved.');
        setConfirmed(false);
      })
      .catch((caught: unknown) => {
        setError(applyServerErrors(caught, () => undefined) ?? 'The clinic was not updated.');
      });
  };

  return (
    <SectionCard
      id="identity"
      title="Clinic"
      description="The name, the time zone every appointment is converted with, and whether the clinic is running."
      missingCount={missingCount}
      canWrite={canWrite}
      saving={save.isPending}
      error={error}
      success={success}
      onSubmit={canWrite ? submit : undefined}
      submitDisabled={needsConfirmation && !confirmed}
    >
      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Clinic name"
          disabled={!canWrite}
          value={name}
          onChange={(event) => {
            setName(event.target.value);
          }}
        />
        <Field
          label="Time zone"
          hint="An IANA name. Changing it re-interprets every appointment time for this clinic, so correct it early or not at all."
          disabled={!canWrite}
          value={timezone}
          onChange={(event) => {
            setTimezone(event.target.value);
          }}
        />
        <SelectField
          label="Status"
          disabled={!canWrite}
          value={status}
          options={ORGANISATION_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }))}
          onChange={(event) => {
            setStatus(event.target.value as OrganisationStatus);
            setConfirmed(false);
          }}
        />
      </div>

      {needsConfirmation && (
        <div className="flex flex-col gap-2">
          <Alert kind="danger">
            {status === 'SUSPENDED'
              ? "Suspending stops this clinic's staff signing in and takes its voice agent out of service."
              : 'Deactivating takes the clinic out of service entirely. Its records are kept.'}
          </Alert>
          <label className="flex items-center gap-2 text-xs text-default">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => {
                setConfirmed(event.target.checked);
              }}
            />
            I understand what this does to {clinic.organisation.name}.
          </label>
        </div>
      )}
    </SectionCard>
  );
};
