import { useState } from 'react';
import { clinicFaqsSchema, type ClinicFaqsInput } from '@clinicai/shared';
import type { ClinicDetailView } from '@clinicai/api-client';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { TextAreaField } from '../../../components/ui/Input';
import { clinicsApi } from '../../../lib/clinicsApi';
import { SectionCard } from '../SectionCard';
import { applyServerErrors, useSaveSection } from '../useClinics';

/**
 * Answers the clinic wants given verbatim.
 *
 * SAVED AS A WHOLE LIST, in the order shown, because the order is the data: it is the order
 * the rendered prompt presents them in. Editing one entry therefore submits all of them,
 * which is also what makes removing one actually remove it rather than leaving an orphan.
 *
 * SWITCHING AN ANSWER OFF KEEPS IT. A clinic that stops offering something usually wants the
 * wording back later, and an inactive answer is excluded from the prompt entirely, so
 * leaving it stored costs nothing and deleting it loses work.
 *
 * Local state rather than a field array, for the same reason as the hours section: a list of
 * pairs with an add and a remove is less code written directly than wired through a form
 * library, and the shared schema still validates the payload.
 */

type Draft = { readonly question: string; readonly answer: string; readonly active: boolean };

export const FaqsSection = ({
  clinic,
  canWrite,
  missingCount,
}: {
  readonly clinic: ClinicDetailView;
  readonly canWrite: boolean;
  readonly missingCount: number;
}) => {
  const [drafts, setDrafts] = useState<readonly Draft[]>(() =>
    clinic.faqs.map((faq) => ({ question: faq.question, answer: faq.answer, active: faq.active })),
  );
  const [error, setError] = useState<string | undefined>(undefined);
  const [success, setSuccess] = useState<string | undefined>(undefined);

  const save = useSaveSection<ClinicFaqsInput>(clinic.organisation.id, clinicsApi.saveFaqs);

  const update = (index: number, changes: Partial<Draft>): void => {
    setDrafts((previous) =>
      previous.map((draft, position) => (position === index ? { ...draft, ...changes } : draft)),
    );
  };

  const submit = (): void => {
    setError(undefined);
    setSuccess(undefined);

    const parsed = clinicFaqsSchema.safeParse({ faqs: drafts });

    if (!parsed.success) {
      setError(parsed.error.issues.map((issue) => issue.message).join(' '));
      return;
    }

    save
      .mutateAsync(parsed.data)
      .then(() => {
        setSuccess(
          drafts.length === 0 ? 'All answers removed.' : `${String(drafts.length)} answers saved.`,
        );
      })
      .catch((caught: unknown) => {
        setError(applyServerErrors(caught, () => undefined) ?? 'The answers were not saved.');
      });
  };

  return (
    <SectionCard
      id="faqs"
      title="Frequently asked answers"
      description="Questions the clinic wants answered in its own words. Given to the caller exactly as written, in this order."
      missingCount={missingCount}
      canWrite={canWrite}
      saving={save.isPending}
      error={error}
      success={success}
      onSubmit={canWrite ? submit : undefined}
    >
      {drafts.length === 0 && (
        <p className="m-0 text-xs text-muted">
          No answers recorded. The agent will say it has to check rather than inventing one.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {drafts.map((draft, index) => (
          <div
            key={`faq-${String(index)}`}
            className="flex flex-col gap-3 rounded-md border border-border p-3"
          >
            <Field
              label={`Question ${String(index + 1)}`}
              disabled={!canWrite}
              value={draft.question}
              onChange={(event) => {
                update(index, { question: event.target.value });
              }}
            />
            <TextAreaField
              label="Answer, word for word"
              rows={2}
              disabled={!canWrite}
              value={draft.answer}
              onChange={(event) => {
                update(index, { answer: event.target.value });
              }}
            />
            <div className="flex items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-xs text-default">
                <input
                  type="checkbox"
                  checked={draft.active}
                  disabled={!canWrite}
                  onChange={(event) => {
                    update(index, { active: event.target.checked });
                  }}
                />
                In use. An answer switched off is kept but never given to a caller.
              </label>

              {canWrite && (
                <button
                  type="button"
                  className="text-xs text-danger hover:underline"
                  onClick={() => {
                    setDrafts((previous) => previous.filter((_, position) => position !== index));
                  }}
                >
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Fifty is the schema's maximum: enough for any clinic and still a bounded payload. */}
      {canWrite && drafts.length < 50 && (
        <div>
          <Button
            kind="secondary"
            onClick={() => {
              setDrafts((previous) => [...previous, { question: '', answer: '', active: true }]);
            }}
          >
            Add an answer
          </Button>
        </div>
      )}
    </SectionCard>
  );
};
