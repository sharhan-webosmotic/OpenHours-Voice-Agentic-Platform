import { useState } from 'react';
import type { PromptPreviewView } from '@clinicai/api-client';
import { Alert } from '../../../components/ui/Alert';
import { Button } from '../../../components/ui/Button';
import { Card } from '../../../components/ui/Card';
import { CopyButton } from '../../../components/ui/CopyButton';
import { Badge } from '../../../components/ui/Table';
import { clinicsApi } from '../../../lib/clinicsApi';
import { toProblemDetails } from '../useClinics';

/**
 * The clinic's master prompt, rendered exactly as `pnpm prompt:render` would print it.
 *
 * READ-ONLY. It changes nothing, including the version the clinic is marked with: only saving
 * the Sarvam mapping records what was pasted (D-014). It says which version it came from,
 * whether that wording is approved, and when no version is recorded yet that the default was
 * used, so nobody pastes a placeholder believing it is the clinic's own.
 *
 * RENDERED ON REQUEST, not on page load, because every render is an audited read of the
 * clinic's whole configuration. Held in this component only, never in a cache.
 */
export const PromptPreviewSection = ({ organisationId }: { readonly organisationId: string }) => {
  const [preview, setPreview] = useState<PromptPreviewView | undefined>(undefined);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>(undefined);

  const render = (): void => {
    setLoading(true);
    setError(undefined);

    clinicsApi
      .previewPrompt(organisationId)
      .then(setPreview)
      .catch((caught: unknown) => {
        const problem = toProblemDetails(caught);
        setError(problem?.detail ?? 'The prompt could not be rendered.');
      })
      .finally(() => {
        setLoading(false);
      });
  };

  return (
    <Card className="scroll-mt-6">
      <div id="promptPreview" className="mb-4 flex flex-col gap-1">
        <h2 className="m-0 text-md font-semibold text-default">Master prompt</h2>
        <p className="m-0 max-w-prose text-xs text-muted">
          What to paste into the clinic&rsquo;s Sarvam application, rendered from what is saved
          above. Rendering it changes nothing.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {error !== undefined && <Alert kind="danger">{error}</Alert>}

        <div>
          <Button kind="secondary" loading={loading} onClick={render}>
            {preview === undefined ? 'Render the prompt' : 'Render it again'}
          </Button>
        </div>

        {preview !== undefined && (
          <>
            <div className="flex flex-wrap items-center gap-2 text-xs text-default">
              <span>
                Master prompt version <strong>{preview.version}</strong>
              </span>
              {preview.approved ? (
                <Badge kind="success">approved wording</Badge>
              ) : (
                <Badge kind="warning">placeholder wording, not for real callers</Badge>
              )}
            </div>

            {!preview.versionRecorded && (
              <Alert kind="info">
                No version is recorded for this clinic yet, so this is the default version. Record
                the version you paste in the Sarvam mapping above.
              </Alert>
            )}

            {preview.readiness.missing.length > 0 && (
              <Alert kind="warning">
                <strong>Not ready for real callers. Still missing:</strong>
                <ul className="m-0 mt-1 list-disc pl-5">
                  {preview.readiness.missing.map((requirement) => (
                    <li key={requirement.key}>{requirement.label}</li>
                  ))}
                </ul>
              </Alert>
            )}

            <pre
              aria-label="Rendered master prompt"
              className="m-0 max-h-96 overflow-auto whitespace-pre-wrap rounded-md border border-border bg-background p-3 font-mono text-xs text-default"
            >
              {preview.text}
            </pre>

            <CopyButton value={preview.text} label="Copy the prompt" />
          </>
        )}
      </div>
    </Card>
  );
};
