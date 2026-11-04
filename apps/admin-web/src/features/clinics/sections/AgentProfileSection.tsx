import {
  AGENT_TONES,
  SUGGESTED_AGENT_LANGUAGES,
  agentProfileSchema,
  type AgentProfileInput,
} from '@clinicai/shared';
import type { ClinicDetailView } from '@clinicai/api-client';
import { SelectField, TextAreaField } from '../../../components/ui/Input';
import { clinicsApi } from '../../../lib/clinicsApi';
import { SectionCard } from '../SectionCard';
import { useSaveSection } from '../useClinics';
import { useSectionForm } from '../useSectionForm';

/**
 * How the agent behaves: its words, its languages, and its refusals.
 *
 * THE NEVER-PROMISE LIST IS THE CLINICALLY IMPORTANT FIELD on this page. The agent never
 * diagnoses or prescribes whatever is in it, because that is a platform rule rather than a
 * clinic preference (root CLAUDE.md rule 9). This is where a clinic adds its own refusals on
 * top, and each line renders as a separate instruction in the prompt, which is why the field
 * is one item per line rather than a paragraph: a paragraph becomes one long sentence the
 * model weighs as a whole.
 *
 * LANGUAGES AND THE NEVER-PROMISE LIST ARE TEXTAREAS PARSED INTO ARRAYS, one per line. A tag
 * editor would be nicer and is not worth building for a pilot where a clinic names two
 * languages once. The schema validates each line, so a mistyped tag is named rather than
 * silently stored.
 */

const linesToArray = (value: unknown): readonly string[] =>
  typeof value === 'string'
    ? value
        .split('\n')
        .map((line) => line.trim())
        .filter((line) => line !== '')
    : [];

const arrayToLines = (value: readonly string[]): string => value.join('\n');

export const AgentProfileSection = ({
  clinic,
  canWrite,
  missingCount,
}: {
  readonly clinic: ClinicDetailView;
  readonly canWrite: boolean;
  readonly missingCount: number;
}) => {
  const save = useSaveSection<AgentProfileInput>(
    clinic.organisation.id,
    clinicsApi.saveAgentProfile,
  );

  const { form, submit, saving, error, success } = useSectionForm<AgentProfileInput>({
    schema: agentProfileSchema,
    defaultValues: {
      greeting: clinic.agentProfile?.greeting ?? '',
      languages: clinic.agentProfile?.languages ?? [],
      tone: clinic.agentProfile?.tone ?? null,
      fullyBookedResponse: clinic.agentProfile?.fullyBookedResponse ?? '',
      escalationRules: clinic.agentProfile?.escalationRules ?? '',
      neverPromise: clinic.agentProfile?.neverPromise ?? [],
    } as never,
    save: (input) => save.mutateAsync(input),
    successMessage: 'Agent behaviour saved.',
  });

  const { register, formState } = form;
  const fieldError = (name: keyof AgentProfileInput): string | undefined =>
    formState.errors[name]?.message;

  return (
    <SectionCard
      id="agentProfile"
      title="Agent behaviour"
      description="What the agent says, in which languages, and what it must never promise. These words are read out to patients, so they are stored exactly as written."
      missingCount={missingCount}
      canWrite={canWrite}
      saving={saving}
      error={error}
      success={success}
      onSubmit={canWrite ? submit : undefined}
    >
      <TextAreaField
        label="Greeting"
        hint="The first thing a caller hears."
        rows={2}
        disabled={!canWrite}
        error={fieldError('greeting')}
        {...register('greeting' as never)}
      />

      <div className="grid gap-4 sm:grid-cols-2">
        <TextAreaField
          label="Languages"
          hint={`One tag per line, such as ${SUGGESTED_AGENT_LANGUAGES.slice(0, 2).join(' and ')}. Which codes Sarvam accepts is confirmed during the manual setup.`}
          rows={3}
          disabled={!canWrite}
          error={fieldError('languages')}
          defaultValue={arrayToLines(clinic.agentProfile?.languages ?? [])}
          {...register('languages' as never, { setValueAs: linesToArray })}
        />

        <SelectField
          label="Tone"
          placeholder="Not decided"
          disabled={!canWrite}
          error={fieldError('tone')}
          options={AGENT_TONES.map((tone) => ({
            value: tone,
            label: tone.charAt(0) + tone.slice(1).toLowerCase(),
          }))}
          {...register('tone' as never, {
            setValueAs: (value: unknown) => (value === '' ? null : value),
          })}
        />
      </div>

      <TextAreaField
        label="When nothing is available"
        hint="What the agent says when there is no slot to offer. It must not guess at availability."
        rows={2}
        disabled={!canWrite}
        error={fieldError('fullyBookedResponse')}
        {...register('fullyBookedResponse' as never)}
      />

      <TextAreaField
        label="When to hand the call to a person"
        hint="In the clinic's own words."
        rows={3}
        disabled={!canWrite}
        error={fieldError('escalationRules')}
        {...register('escalationRules' as never)}
      />

      <TextAreaField
        label="What the agent must never say or promise"
        hint="One rule per line. Each becomes a separate instruction. The agent never diagnoses or prescribes regardless of what is here; this is for the clinic's own refusals."
        rows={4}
        disabled={!canWrite}
        error={fieldError('neverPromise')}
        defaultValue={arrayToLines(clinic.agentProfile?.neverPromise ?? [])}
        {...register('neverPromise' as never, { setValueAs: linesToArray })}
      />
    </SectionCard>
  );
};
