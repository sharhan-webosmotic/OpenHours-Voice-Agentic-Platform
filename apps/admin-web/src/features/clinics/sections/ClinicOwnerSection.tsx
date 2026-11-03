import { useState } from 'react';
import { createClinicOwnerSchema } from '@clinicai/shared';
import type { CreatedClinicOwner } from '@clinicai/api-client';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Field } from '../../../components/ui/Field';
import { clinicsApi } from '../../../lib/clinicsApi';
import { applyServerErrors, useSaveSection } from '../useClinics';

/**
 * Creates the clinic owner's login, with a temporary password shown once.
 *
 * THE SAME PATH AS `pnpm provision:clinic` on the server: the same generator, hashed the same
 * way, and `mustChangePassword` set so the first sign-in replaces it (D-003). The password is
 * held in this component's state only, never in the Redux store or any cache, and is gone when
 * the page is left or another owner is created. That is the point: it is a handover, not a
 * credential anyone should be able to find again.
 *
 * Shown only to a role the matrix lets create a clinic's logins. The server enforces the same
 * cell, so hiding the form is a courtesy, not the control.
 */
export const ClinicOwnerSection = ({ organisationId }: { readonly organisationId: string }) => {
  const [draft, setDraft] = useState({ fullName: '', email: '' });
  const [fieldErrors, setFieldErrors] = useState<{ fullName?: string; email?: string }>({});
  const [error, setError] = useState<string | undefined>(undefined);
  const [created, setCreated] = useState<CreatedClinicOwner | undefined>(undefined);

  const save = useSaveSection(organisationId, (id, input: typeof draft) =>
    clinicsApi.createOwner(id, input),
  );

  const submit = (): void => {
    setError(undefined);
    setCreated(undefined);

    const parsed = createClinicOwnerSchema.safeParse(draft);

    if (!parsed.success) {
      const errors: { fullName?: string; email?: string } = {};
      for (const issue of parsed.error.issues) {
        const field = issue.path[0];
        if (field === 'fullName' || field === 'email') {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setFieldErrors({});

    save
      .mutateAsync(parsed.data)
      .then((result) => {
        setCreated(result);
        setDraft({ fullName: '', email: '' });
      })
      .catch((caught: unknown) => {
        setError(applyServerErrors(caught, () => undefined) ?? 'The owner was not created.');
      });
  };

  return (
    <Card className="scroll-mt-6">
      <div id="clinicOwner" className="mb-4 flex flex-col gap-1">
        <h2 className="m-0 text-md font-semibold text-default">Clinic owner</h2>
        <p className="m-0 max-w-prose text-xs text-muted">
          Creates the owner&rsquo;s sign-in for the clinic dashboard. A temporary password is
          generated and shown here once. They must replace it the first time they sign in.
        </p>
      </div>

      <form
        noValidate
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
        className="flex flex-col gap-4"
      >
        {error !== undefined && <Alert kind="danger">{error}</Alert>}

        {created !== undefined && (
          <Alert kind="warning">
            <strong>
              Copy this temporary password for {created.fullName} now. It is shown once.
            </strong>
            <code className="my-2 block break-all rounded-md bg-surface px-2 py-1.5 font-mono text-xs text-default">
              {created.temporaryPassword}
            </code>
            It is stored only as a hash, so it cannot be shown again, and leaving this page clears
            it. Hand it to {created.email} out of band, not in a chat or a ticket. If it is lost,
            the account has to be removed and created again.
            <div className="mt-2">
              <CopyButton value={created.temporaryPassword} label="Copy the password" />
            </div>
          </Alert>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label="Owner's full name"
            value={draft.fullName}
            error={fieldErrors.fullName}
            onChange={(event) => {
              setDraft((previous) => ({ ...previous, fullName: event.target.value }));
            }}
          />
          <Field
            label="Owner's email address"
            type="email"
            value={draft.email}
            error={fieldErrors.email}
            onChange={(event) => {
              setDraft((previous) => ({ ...previous, email: event.target.value }));
            }}
          />
        </div>

        <div>
          <Button type="submit" loading={save.isPending}>
            Create the clinic owner
          </Button>
        </div>
      </form>
    </Card>
  );
};
