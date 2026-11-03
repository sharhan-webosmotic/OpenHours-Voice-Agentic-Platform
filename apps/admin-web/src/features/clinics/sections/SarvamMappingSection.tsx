import { useState } from 'react';
import { sarvamMappingSchema } from '@clinicai/shared';
import type { ClinicDetailView, SarvamSecretRegeneration } from '@clinicai/api-client';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { SectionCard } from '../SectionCard';
import { applyServerErrors, useSaveSarvamMapping } from '../useClinics';

/**
 * The Sarvam mapping, copied by hand out of Sarvam's console into ours.
 *
 * NOTHING HERE PROVISIONS ANYTHING. The agent, its deployment and its phone number are
 * created in Sarvam by a person (D-004, D-005), and this records what they created so that an
 * inbound call can be resolved to a clinic and a tool call can be authenticated.
 * `docs/features/pilot-clinic.md` has the order those manual steps go in.
 *
 * THE TOOL SECRET IS OURS TO GENERATE AND IS SHOWN ONCE. It is minted on the first save,
 * returned in that one response, and stored only as a hash: the same arrangement as a
 * temporary password (D-003) and for the same reason, which is that a secret the platform
 * can read back is a secret an attacker can read back. It is the entire authentication for
 * the tool endpoints the agent calls, so an operator-supplied one would be as strong as
 * whoever typed it felt like making it.
 *
 * THE WEBHOOK SECRET IS THE SAME ARRANGEMENT, FOR A DIFFERENT JOB. It is the path segment of
 * the URL Sarvam posts call events to, so it is minted on its own: the first time the mapping
 * is saved, or on the next save for a clinic set up before webhook secrets existed.
 *
 * REGENERATING ASKS FIRST, AND SAYS WHAT BREAKS. Each secret is replaced on its own, never as a
 * side effect of the other, because they break different things until the new value is pasted
 * into Sarvam: a new tool secret stops the agent checking availability and booking, and a new
 * webhook secret stops calls reaching the call history. The confirmation names exactly that.
 */

type Secret = 'toolSecret' | 'webhookSecret';

/** What replacing each secret breaks, said plainly, for the confirmation. */
const REGENERATION_WARNING: Readonly<Record<Secret, string>> = {
  toolSecret:
    'The agent keeps answering calls, but it cannot check availability, book, reschedule or cancel until the new tool secret is pasted into Sarvam. The webhook secret is not changed, so calls keep reaching the call history.',
  webhookSecret:
    "Calls stop reaching this clinic's call history, and are not recorded here, until the new webhook URL is pasted into Sarvam. The tool secret is not changed, so the agent keeps answering and booking.",
};

const SECRET_LABEL: Readonly<Record<Secret, string>> = {
  toolSecret: 'tool secret',
  webhookSecret: 'webhook secret',
};
export const SarvamMappingSection = ({
  clinic,
  canWrite,
  missingCount,
}: {
  readonly clinic: ClinicDetailView;
  readonly canWrite: boolean;
  readonly missingCount: number;
}) => {
  const mapping = clinic.sarvamMapping;

  const [draft, setDraft] = useState({
    sarvamAppId: mapping?.sarvamAppId ?? '',
    sarvamAppVersion: mapping?.sarvamAppVersion ?? '',
    sarvamDeploymentId: mapping?.sarvamDeploymentId ?? '',
    sarvamConnectionId: mapping?.sarvamConnectionId ?? '',
    agentPhone: mapping?.agentPhone ?? '',
    clinicPhone: clinic.organisation.clinicPhone ?? '',
    promptVersion: mapping?.promptVersion ?? '',
  });

  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);
  /** Shown once, in this component's state only. Never stored anywhere. */
  const [issuedSecret, setIssuedSecret] = useState<string | undefined>(undefined);
  const [issuedWebhookSecret, setIssuedWebhookSecret] = useState<string | undefined>(undefined);
  const [confirmingRegenerate, setConfirmingRegenerate] = useState<Secret | undefined>(undefined);

  const save = useSaveSarvamMapping(clinic.organisation.id);

  const set = (field: keyof typeof draft, value: string): void => {
    setDraft((previous) => ({ ...previous, [field]: value }));
  };

  const submit = (regenerate: SarvamSecretRegeneration): void => {
    setError(undefined);
    setSuccess(undefined);
    setIssuedSecret(undefined);
    setIssuedWebhookSecret(undefined);

    // Empty means "not collected yet", which is a legitimate state for every field here:
    // the ids arrive one at a time as the manual setup progresses.
    const blankToNull = (value: string): string | null => (value.trim() === '' ? null : value);

    const parsed = sarvamMappingSchema.safeParse({
      sarvamAppId: blankToNull(draft.sarvamAppId),
      sarvamAppVersion: blankToNull(draft.sarvamAppVersion),
      sarvamDeploymentId: blankToNull(draft.sarvamDeploymentId),
      sarvamConnectionId: blankToNull(draft.sarvamConnectionId),
      agentPhone: blankToNull(draft.agentPhone),
      clinicPhone: blankToNull(draft.clinicPhone),
      promptVersion: blankToNull(draft.promptVersion),
    });

    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }

    save
      .mutateAsync({ mapping: parsed.data, regenerate })
      .then((result) => {
        setConfirmingRegenerate(undefined);

        if (result.toolSecret !== undefined || result.webhookSecret !== undefined) {
          setIssuedSecret(result.toolSecret);
          setIssuedWebhookSecret(result.webhookSecret);
          setSuccess(undefined);
          return;
        }

        setSuccess('Mapping saved.');
      })
      .catch((caught: unknown) => {
        setConfirmingRegenerate(undefined);
        setError(applyServerErrors(caught, () => undefined) ?? 'The mapping was not saved.');
      });
  };

  return (
    <SectionCard
      id="sarvamMapping"
      title="Sarvam mapping"
      description="What was created by hand in Sarvam. Nothing on this page provisions anything: it records the ids so a call can be matched to this clinic."
      missingCount={missingCount}
      canWrite={canWrite}
      saving={save.isPending}
      error={error}
      success={success}
      onSubmit={canWrite ? () => submit({}) : undefined}
    >
      {issuedSecret !== undefined && (
        <Alert kind="success">
          <strong>Copy this tool secret into Sarvam now. It is shown once.</strong>
          <code className="mt-2 block break-all rounded-md bg-surface px-2 py-1.5 font-mono text-xs text-default">
            {issuedSecret}
          </code>
          It is stored only as a hash, so it cannot be shown again. A lost one has to be
          regenerated, which also means pasting the new value into Sarvam before the agent will
          work.
        </Alert>
      )}

      {issuedWebhookSecret !== undefined && (
        <Alert kind="success">
          <strong>And this webhook secret, also shown once.</strong>
          <code className="mt-2 block break-all rounded-md bg-surface px-2 py-1.5 font-mono text-xs text-default">
            {issuedWebhookSecret}
          </code>
          {/*
           * The path, not the whole URL: the host differs per environment and this console
           * does not know which one Sarvam is being pointed at. Written out so nobody has to
           * guess where the secret goes.
           */}
          It belongs at the end of this clinic&rsquo;s webhook URL, as
          <code className="mx-1 rounded bg-surface px-1 font-mono text-xs">
            /webhooks/sarvam/&lt;secret&gt;
          </code>
          in the deployment&rsquo;s webhook configuration. Without it, the agent will answer calls
          normally and none of them will reach the call history.
        </Alert>
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <Field
          label="Sarvam app id"
          disabled={!canWrite}
          value={draft.sarvamAppId}
          onChange={(event) => {
            set('sarvamAppId', event.target.value);
          }}
        />
        <Field
          label="App version"
          disabled={!canWrite}
          value={draft.sarvamAppVersion}
          onChange={(event) => {
            set('sarvamAppVersion', event.target.value);
          }}
        />
        <Field
          label="Deployment id"
          disabled={!canWrite}
          value={draft.sarvamDeploymentId}
          onChange={(event) => {
            set('sarvamDeploymentId', event.target.value);
          }}
        />
        <Field
          label="Connection id"
          disabled={!canWrite}
          value={draft.sarvamConnectionId}
          onChange={(event) => {
            set('sarvamConnectionId', event.target.value);
          }}
        />
        <Field
          label="Agent phone number"
          hint="The number patients dial. Unique across the platform, because an inbound call is matched to a clinic by it."
          disabled={!canWrite}
          value={draft.agentPhone}
          onChange={(event) => {
            set('agentPhone', event.target.value);
          }}
        />
        <Field
          label="Clinic phone number"
          hint="The clinic's own line, which the agent forwards to."
          disabled={!canWrite}
          value={draft.clinicPhone}
          onChange={(event) => {
            set('clinicPhone', event.target.value);
          }}
        />
        <Field
          label="Master prompt version"
          hint="Which version is loaded in Sarvam right now. Render it with pnpm prompt:render."
          disabled={!canWrite}
          value={draft.promptVersion}
          onChange={(event) => {
            set('promptVersion', event.target.value);
          }}
        />
      </div>

      <div className="flex flex-col gap-2 rounded-md border border-border p-3">
        <strong className="font-semibold text-xs text-default">Secrets</strong>

        {mapping?.toolSecretSet === true ? (
          <p className="m-0 text-xs text-muted">
            Tool secret set
            {mapping.toolSecretSetAt === null
              ? ''
              : ` on ${new Date(mapping.toolSecretSetAt).toLocaleString('en-IN')}`}
            . Neither secret can be shown again.
          </p>
        ) : (
          <p className="m-0 text-xs text-muted">
            Not set yet. Both are generated and shown the first time this mapping is saved.
          </p>
        )}

        {canWrite && mapping?.toolSecretSet === true && confirmingRegenerate === undefined && (
          <div className="flex flex-wrap gap-3">
            {(['toolSecret', 'webhookSecret'] as const).map((secret) => (
              <Button
                key={secret}
                kind="secondary"
                onClick={() => {
                  setConfirmingRegenerate(secret);
                }}
              >
                Regenerate the {SECRET_LABEL[secret]}
              </Button>
            ))}
          </div>
        )}

        {canWrite && confirmingRegenerate !== undefined && (
          <div className="flex flex-col gap-2">
            <Alert kind="danger">
              <strong>Regenerate the {SECRET_LABEL[confirmingRegenerate]}?</strong>{' '}
              {REGENERATION_WARNING[confirmingRegenerate]} Only do this if the current one has been
              lost or exposed.
            </Alert>
            <div className="flex items-center gap-3">
              <Button
                kind="danger"
                loading={save.isPending}
                onClick={() => {
                  submit({ [confirmingRegenerate]: true });
                }}
              >
                Regenerate the {SECRET_LABEL[confirmingRegenerate]}
              </Button>
              <button
                type="button"
                className="text-xs text-muted hover:underline"
                onClick={() => {
                  setConfirmingRegenerate(undefined);
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </SectionCard>
  );
};
