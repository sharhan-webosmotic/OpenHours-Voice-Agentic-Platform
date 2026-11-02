import { z } from 'zod';
import { normalisePhone } from '@clinicai/shared';
import { config } from '../../config.js';
import {
  ProviderContractError,
  ProviderNotConfiguredError,
  type CallEvent,
  type CallTranscriptTurn,
  type ProviderAgentRef,
  type ProviderInteraction,
  type VoiceProvider,
} from '../provider.js';

/**
 * The only file that knows what Sarvam's payloads look like.
 *
 * Written strictly from `docs/sarvam-contract.md`, which was read from Sarvam's own
 * documentation on 2026-10-27. Where that document says UNKNOWN, this file either does not
 * rely on the thing or says so in a comment. Nothing here is inferred from what a payload
 * "probably" contains.
 *
 * ─── PROVISIONAL UNTIL THE FIRST REAL CALL ──────────────────────────────────────
 *
 * The contract itself records a documentation inconsistency (`phone_numbers[]` in examples
 * against `agent_phone_number` in the schema, section 3) and gives no sample payload for a
 * tool request. So the parser is built to TOLERATE: unknown fields are ignored rather than
 * refused, every field the platform does not strictly need is optional, and the raw body is
 * stored next to the parsed form in `webhook_events.payload`. After the pilot call, that
 * stored payload is the evidence to check this file against, which is the step
 * `docs/features/pilot-clinic.md` owns.
 *
 * ─── WHY ZOD RATHER THAN CASTS ──────────────────────────────────────────────────
 *
 * The body arrives from an unauthenticated POST (D-006: Sarvam documents no signature). It is
 * hostile input, not a typed object, so it is parsed before anything reads a property.
 */

/**
 * `.passthrough()` IS NOT USED AND NEITHER IS `.strict()`.
 *
 * Zod's default for an object is to ignore keys it does not describe, which is exactly the
 * behaviour wanted here: a new Sarvam field cannot fail a clinic's webhook, and it cannot
 * reach our code either. `.strict()` would reject the first field they add; `.passthrough()`
 * would carry unvalidated values deeper in.
 */
const transcriptTurnSchema = z.object({
  role: z.string().optional(),
  en_text: z.string().optional(),
  indic_text: z.string().optional(),
});

/**
 * The inbound call-finished webhook, from contract section 3.
 *
 * ONLY `interaction_id` IS REQUIRED. Everything else is optional, because it is the
 * idempotency key and the one field without which the event cannot be stored, deduplicated
 * or re-read. A payload missing a duration is still a call that happened; a payload missing
 * its identifier is not an event we can reason about at all.
 */
const inboundWebhookSchema = z.object({
  interaction_id: z.string().min(1),
  app_id: z.string().optional(),
  app_version: z.union([z.number(), z.string()]).optional(),
  deployment_id: z.string().optional(),
  user_phone_number: z.string().optional(),
  agent_phone_number: z.string().optional(),
  duration: z.union([z.number(), z.string()]).optional(),
  start_datetime: z.string().optional(),
  end_datetime: z.string().optional(),
  interaction_transcript: z.array(transcriptTurnSchema).optional(),
  /** Echoed back from `webhook_config.metadata`. OUR data, returning unauthenticated. */
  metadata: z.record(z.string(), z.unknown()).optional(),
  final_agent_variables: z.record(z.string(), z.unknown()).optional(),
  output_agent_variables: z.record(z.string(), z.unknown()).optional(),
  /** Present on an outbound attempt's completion webhook (contract section 4). */
  attempt_id: z.string().optional(),
  status: z.string().optional(),
  failure_reason: z.string().optional(),
});

/** An instant Sarvam sent as a string, or null. Never a wrong date: unparseable is null. */
const instant = (value: string | undefined): Date | null => {
  if (value === undefined || value.trim() === '') {
    return null;
  }

  const parsed = new Date(value);

  /**
   * The contract does not state the format of `start_datetime`, only that it exists. So an
   * unparseable value becomes null rather than an Invalid Date that would be written to a
   * timestamptz column and fail, or worse, be stored as 1970.
   */
  return Number.isNaN(parsed.getTime()) ? null : parsed;
};

const seconds = (value: number | string | undefined): number | null => {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? Math.round(value) : null;
  }

  if (typeof value !== 'string' || value.trim() === '') {
    return null;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.round(parsed) : null;
};

/**
 * A phone number as E.164, or the empty string.
 *
 * `calls.from_e164` and `to_e164` are NOT NULL, and a call that happened is a row worth
 * keeping even when the provider sent a number we cannot normalise (a withheld caller id,
 * for instance). The empty string is the honest value for "the provider did not give us a
 * usable number", and it cannot be confused with a real one.
 */
const e164 = (value: string | undefined): string => {
  if (value === undefined || value.trim() === '') {
    return '';
  }

  const result = normalisePhone(value);
  return result.ok ? result.e164 : '';
};

/**
 * Sarvam's `role` values, mapped onto ours.
 *
 * The contract gives `assistant` and `user` for the transcripts endpoint (section 5) and
 * does not enumerate them for the webhook's `interaction_transcript` (section 3). Anything
 * unrecognised becomes `OTHER` rather than being dropped: a turn whose speaker we cannot
 * label is still part of what was said, and silently discarding it would make the transcript
 * a clinician reads differ from the conversation that happened.
 */
const role = (value: string | undefined): CallTranscriptTurn['role'] => {
  switch (value?.toLowerCase()) {
    case 'assistant':
    case 'agent':
    case 'bot':
      return 'AGENT';
    case 'user':
    case 'caller':
    case 'customer':
      return 'CALLER';
    default:
      return 'OTHER';
  }
};

const turns = (
  raw: readonly z.infer<typeof transcriptTurnSchema>[] | undefined,
): readonly CallTranscriptTurn[] =>
  (raw ?? [])
    .map((turn) => ({
      role: role(turn.role),
      /**
       * `en_text` is the English rendering and `indic_text` the original (section 3). The
       * English one is used because every consumer of a transcript today is a staff member
       * reading the dashboard in English, and the fallback keeps a turn that only has the
       * Indic text rather than dropping it.
       */
      text: (turn.en_text ?? turn.indic_text ?? '').trim(),
    }))
    .filter((turn) => turn.text !== '');

const parseWebhook = (raw: unknown): CallEvent => {
  const result = inboundWebhookSchema.safeParse(raw);

  if (!result.success) {
    /**
     * The MESSAGE names the problem and never the payload. A webhook body is full of
     * patient data, and this error is logged.
     */
    throw new ProviderContractError(
      `sarvam webhook did not carry a usable interaction_id: ${result.error.issues
        .map((issue) => issue.path.join('.'))
        .join(', ')}`,
    );
  }

  const body = result.data;
  const claimed = body.metadata?.['clinic_id'];

  return {
    externalCallId: body.interaction_id,
    /**
     * `attempt_id` is the marker of an outbound attempt (contract section 4): the inbound
     * webhook has no such field. Outbound calls are not part of this phase, but an outbound
     * webhook arriving at this endpoint must not be filed as an inbound call, so the
     * direction is read rather than assumed.
     */
    direction: body.attempt_id === undefined ? 'INBOUND' : 'OUTBOUND',
    fromE164: e164(body.user_phone_number),
    toE164: e164(body.agent_phone_number),
    startedAt: instant(body.start_datetime),
    endedAt: instant(body.end_datetime),
    durationSeconds: seconds(body.duration),
    routing: {
      deploymentId: body.deployment_id ?? null,
      agentNumber: e164(body.agent_phone_number) === '' ? null : e164(body.agent_phone_number),
      claimedClinicId: typeof claimed === 'string' ? claimed : null,
    },
    transcript: turns(body.interaction_transcript),
  };
};

/**
 * The analytics path for one app, from contract section 1.
 *
 * ANALYTICS USES A DIFFERENT PATH SHAPE from the other services: `/v1/{org}/{ws}/{app}/...`
 * rather than `/v1/orgs/{org}/workspaces/{ws}/...`. Getting that wrong is a 404 that looks
 * like a missing interaction, so it is written once, here.
 */
const analyticsUrl = (agent: ProviderAgentRef, suffix: string): string => {
  const org = config.SARVAM_ORG_ID;
  const workspace = config.SARVAM_WORKSPACE_ID;

  if (config.SARVAM_API_KEY === undefined) {
    throw new ProviderNotConfiguredError('SARVAM_API_KEY');
  }
  if (org === undefined) {
    throw new ProviderNotConfiguredError('SARVAM_ORG_ID');
  }
  if (workspace === undefined) {
    throw new ProviderNotConfiguredError('SARVAM_WORKSPACE_ID');
  }

  return `${config.SARVAM_ANALYTICS_BASE_URL}/v1/${org}/${workspace}/${agent.appId}/${suffix}`;
};

/**
 * `interaction_id` CONTAINS A SLASH and must survive the trip.
 *
 * It is `<YYYYMMDD>/<id>` (contract section 1), and the contract says an id without a slash
 * is answered with a 400. `encodeURIComponent` turns the slash into `%2F`, which is what the
 * document says to send; leaving it bare would make the server read it as another path
 * segment.
 */
const idForPath = (externalCallId: string): string => encodeURIComponent(externalCallId);

const headers = (): Record<string, string> => {
  if (config.SARVAM_API_KEY === undefined) {
    throw new ProviderNotConfiguredError('SARVAM_API_KEY');
  }

  // `X-API-Key`, and not a bearer token: the contract is explicit that analytics does not
  // accept one (section 1).
  return { 'X-API-Key': config.SARVAM_API_KEY, accept: 'application/json' };
};

const interactionSchema = z.object({
  interaction_id: z.string().min(1),
  start_datetime: z.string().optional(),
  end_datetime: z.string().optional(),
  duration_in_seconds: z.union([z.number(), z.string()]).optional(),
  channel_direction: z.string().optional(),
  user_phone_number: z.string().optional(),
  agent_phone_number: z.string().optional(),
  ended_by: z.string().optional(),
  failure_reason: z.string().optional(),
});

/** The list endpoint's envelope is not documented, so three plausible shapes are accepted. */
const interactionListSchema = z.union([
  z.array(interactionSchema),
  z.object({ interactions: z.array(interactionSchema) }),
  z.object({ data: z.array(interactionSchema) }),
]);

const toInteraction = (row: z.infer<typeof interactionSchema>): ProviderInteraction => ({
  externalCallId: row.interaction_id,
  startedAt: instant(row.start_datetime),
  endedAt: instant(row.end_datetime),
  durationSeconds: seconds(row.duration_in_seconds),
  direction: row.channel_direction?.toLowerCase() === 'outbound' ? 'OUTBOUND' : 'INBOUND',
  fromE164: row.user_phone_number === undefined ? null : e164(row.user_phone_number),
  toE164: row.agent_phone_number === undefined ? null : e164(row.agent_phone_number),
  endedBy: row.ended_by ?? null,
  failureReason: row.failure_reason ?? null,
});

const rowsOf = (parsed: z.infer<typeof interactionListSchema>) =>
  Array.isArray(parsed) ? parsed : 'interactions' in parsed ? parsed.interactions : parsed.data;

/** A JSON GET against analytics, with the provider's error detail surfaced and no PHI logged. */
const getJson = async (url: string): Promise<unknown> => {
  const response = await fetch(url, { headers: headers() });

  if (!response.ok) {
    /**
     * The STATUS and the URL's path, never the body: an error body from a provider that
     * holds patient data may quote the patient. The contract says 429 carries `Retry-After`
     * and 5xx should be retried with backoff, which is the job's business rather than this
     * function's, so the status is in the message for it to read.
     */
    throw new ProviderContractError(
      `sarvam analytics answered ${String(response.status)} for ${new URL(url).pathname}`,
    );
  }

  return response.json();
};

const listInteractions = async (
  agent: ProviderAgentRef,
  window: { readonly from: Date; readonly to: Date },
): Promise<readonly ProviderInteraction[]> => {
  const url = new URL(analyticsUrl(agent, 'interactions'));
  url.searchParams.set('start_datetime', window.from.toISOString());
  url.searchParams.set('end_datetime', window.to.toISOString());
  // 1000 is the documented maximum (section 5). The catch-up job's window is hours, so a
  // clinic would have to place more than a thousand calls in it to need a second page.
  url.searchParams.set('limit', '1000');

  const parsed = interactionListSchema.safeParse(await getJson(url.toString()));

  if (!parsed.success) {
    throw new ProviderContractError(
      'sarvam interactions list did not match any documented or plausible envelope',
    );
  }

  return rowsOf(parsed.data).map(toInteraction);
};

/**
 * One interaction, by listing the window around it.
 *
 * THERE IS NO DOCUMENTED SINGLE-INTERACTION ENDPOINT (contract section 5 lists transcripts,
 * recordings, interactions and attempts). So the authoritative re-read that D-006 relies on
 * is a filtered list, and the window has to come from the payload we are trying to verify.
 * That is weaker than a direct read and it is still the strongest thing available: a forged
 * payload would have to name an interaction that genuinely exists in the clinic's own
 * workspace, in the window it claims.
 *
 * Question 3 in the contract's own list is what would replace this.
 */
const getInteraction = async (
  agent: ProviderAgentRef,
  externalCallId: string,
  around: Date = new Date(),
): Promise<ProviderInteraction | null> => {
  const from = new Date(around.getTime() - 6 * 60 * 60 * 1000);
  const to = new Date(around.getTime() + 60 * 60 * 1000);

  const interactions = await listInteractions(agent, { from, to });

  return interactions.find((row) => row.externalCallId === externalCallId) ?? null;
};

const transcriptSchema = z.object({
  interaction_id: z.string().optional(),
  messages: z
    .array(
      z.object({
        turn_id: z.union([z.number(), z.string()]).optional(),
        role: z.string().optional(),
        content: z.string().optional(),
        language_name: z.string().optional(),
      }),
    )
    .optional(),
});

const fetchTranscript = async (
  agent: ProviderAgentRef,
  externalCallId: string,
): Promise<readonly CallTranscriptTurn[]> => {
  const parsed = transcriptSchema.safeParse(
    await getJson(analyticsUrl(agent, `transcripts/${idForPath(externalCallId)}`)),
  );

  if (!parsed.success) {
    throw new ProviderContractError('sarvam transcript response did not match the contract');
  }

  /**
   * AN EMPTY LIST IS NOT AN ERROR. The contract is explicit: an unknown id answers 200 with
   * no messages, and the caller should retry later rather than treat it as a failure
   * (section 5). The job's retry is what turns that into a transcript a few minutes later.
   */
  return (parsed.data.messages ?? [])
    .map((message) => ({ role: role(message.role), text: (message.content ?? '').trim() }))
    .filter((turn) => turn.text !== '');
};

const fetchRecording = async (
  agent: ProviderAgentRef,
  externalCallId: string,
): Promise<{ readonly bytes: Uint8Array; readonly contentType: string } | null> => {
  const url = analyticsUrl(agent, `recordings/${idForPath(externalCallId)}`);
  const response = await fetch(url, {
    headers: { 'X-API-Key': config.SARVAM_API_KEY ?? '', accept: 'audio/wav' },
  });

  if (response.status === 404) {
    // No recording for this interaction. A real answer, not a failure: consent may have been
    // declined, or the call may have ended before anything was recorded.
    return null;
  }

  if (!response.ok) {
    throw new ProviderContractError(
      `sarvam recording answered ${String(response.status)} for ${new URL(url).pathname}`,
    );
  }

  /**
   * READ INTO MEMORY, NOT STREAMED THROUGH US. D-007 bans streaming a response through the
   * API, and this is a job rather than a route, so it buffers the file and writes it to
   * object storage. A call recording is minutes of mono speech, on the order of a few
   * megabytes; the job runs one at a time.
   */
  const bytes = new Uint8Array(await response.arrayBuffer());

  if (bytes.byteLength === 0) {
    throw new ProviderContractError('sarvam recording was empty');
  }

  return {
    bytes,
    contentType: response.headers.get('content-type') ?? 'audio/wav',
  };
};

export const sarvamProvider: VoiceProvider = {
  name: 'SARVAM',
  parseWebhook,
  getInteraction: (agent, externalCallId) => getInteraction(agent, externalCallId),
  listInteractions,
  fetchTranscript,
  fetchRecording,
};

/** Exported for the adapter's own contract tests, which drive the parser directly. */
export const internals = { parseWebhook, idForPath, e164, instant, seconds, role, turns };
