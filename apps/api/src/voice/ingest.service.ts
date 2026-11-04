import { config } from '../config.js';
import { logger } from '../common/logger.js';
import { uuidV7 } from '../common/uuid.js';
import { asSystem, withTenant, type TenantDb } from '../db/tenant-client.js';
import { record } from '../modules/audit/audit.service.js';
import * as calls from '../modules/calls/calls.repository.js';
import {
  createObjectStorage,
  recordingKey,
  type StorageClient,
} from '../storage/object-storage.js';
import { ProviderContractError, type CallEvent, type VoiceProvider } from './provider.js';
import { sarvamProvider } from './providers/sarvam.js';
import * as repository from './voice.repository.js';

/**
 * Turning what a provider tells us into a call record, a transcript and a recording.
 *
 * ─── EVERY STEP IS IDEMPOTENT ON THE INTERACTION ID ─────────────────────────────
 *
 * A webhook may arrive twice, a job may be retried six times, and the catch-up may find the
 * same interaction the webhook already delivered. All three paths run this code, so "has this
 * already happened" is answered by unique indexes rather than by any of them checking: the
 * call row keys on `(provider, external_call_id)`, the transcript turns on
 * `(call_id, turn_index)`, and the recording key is written once and overwritten with the
 * same value.
 *
 * ─── THE PAYLOAD IS NEVER THE AUTHORITY (D-006) ─────────────────────────────────
 *
 * Sarvam documents no webhook signature, so the body is a hint that something happened. The
 * clinic comes from the URL secret, and with `SARVAM_REFETCH_BEFORE_ACTING` on, the
 * interaction is re-read from the authenticated analytics API and the provider's own figures
 * are preferred over the payload's. A forged webhook then cannot create a call that does not
 * exist in the clinic's workspace.
 */

export type IngestDependencies = {
  readonly provider: VoiceProvider;
  readonly storage: StorageClient;
  readonly now: () => Date;
};

/** Built lazily, so importing this module opens no S3 client and no connection. */
const defaults = (): IngestDependencies => ({
  provider: sarvamProvider,
  storage: createObjectStorage(),
  now: () => new Date(),
});

/** The provider's words, as one block of text, for `calls.transcript` and for an export. */
const asPlainText = (turns: readonly { readonly role: string; readonly text: string }[]): string =>
  turns
    .map(
      (turn) =>
        `${turn.role === 'AGENT' ? 'Agent' : turn.role === 'CALLER' ? 'Caller' : 'Other'}: ${turn.text}`,
    )
    .join('\n');

/**
 * A finished call's status, from what the provider said.
 *
 * `COMPLETED` for a call that connected and ran, `MISSED` for one with no duration at all. The
 * contract's richer outcome fields (`ended_by`, `failure_reason`, section 5) are read on the
 * re-fetch but are NOT mapped onto `CallOutcome` yet: that enum carries clinical meaning
 * (BOOKED, RESCHEDULED, CANCELLED) which is our business to decide from what the agent did,
 * not the provider's to tell us. Left at its default until the outcome work lands.
 */
const statusOf = (event: CallEvent): 'COMPLETED' | 'MISSED' =>
  (event.durationSeconds ?? 0) > 0 ? 'COMPLETED' : 'MISSED';

export type ProcessResult = {
  readonly callId: string | null;
  /** Carried out so the follow-on recording job does not have to resolve it again. */
  readonly organisationId: string | null;
  readonly outcome: 'processed' | 'already-processed' | 'unresolvable';
  readonly transcriptTurns: number;
  readonly recordingQueued: boolean;
};

/**
 * Processes one stored webhook event.
 *
 * Reads the event with `asSystem`, because the row's organisation is what tells us which
 * tenant to open, and writes everything else inside that tenant's scope. The audited escape
 * hatch is right here, unlike on the tool path: this runs once per call rather than once per
 * sentence, and a job reaching across tenants is exactly what should leave a record.
 */
export const processWebhookEvent = async (
  webhookEventId: string,
  dependencies: Partial<IngestDependencies> = {},
): Promise<ProcessResult> => {
  const { provider, now } = { ...defaults(), ...dependencies };

  const event = await asSystem('voice-webhook-event-read', (db) =>
    repository.findInboxEvent(db, webhookEventId),
  );

  if (event === null) {
    // The row is gone, which a retry after a manual clean-up can do. Nothing to process and
    // nothing to fail about.
    return {
      callId: null,
      organisationId: null,
      outcome: 'unresolvable',
      transcriptTurns: 0,
      recordingQueued: false,
    };
  }

  if (event.organisationId === null) {
    await asSystem('voice-webhook-event-unresolvable', (db) =>
      repository.markInboxEvent(db, webhookEventId, 'FAILED', 'event has no organisation'),
    );
    return {
      callId: null,
      organisationId: null,
      outcome: 'unresolvable',
      transcriptTurns: 0,
      recordingQueued: false,
    };
  }

  const organisationId = event.organisationId;

  if (event.status === 'PROCESSED') {
    return {
      callId: null,
      organisationId,
      outcome: 'already-processed',
      transcriptTurns: 0,
      recordingQueued: false,
    };
  }

  /**
   * Parsing happens HERE and not in the route, so a payload we cannot read is a stored row
   * with a recorded failure rather than a delivery the provider keeps retrying.
   */
  const parsed = provider.parseWebhook(event.payload);

  const agent = await asSystem('voice-webhook-agent-read', (db) =>
    repository.findAgentByOrganisation(db, organisationId),
  );

  /**
   * The cross-check the contract asks for (section 7, measure 3) and D-006 calls the measure
   * that holds. A mismatch is logged and the payload's claim is ignored: the clinic is the
   * one the URL secret resolved to, always.
   */
  if (
    parsed.routing.claimedClinicId !== null &&
    parsed.routing.claimedClinicId !== organisationId
  ) {
    logger.warn(
      { organisationId, voiceAgentId: agent?.id },
      'webhook metadata claimed a different clinic than its secret resolved to; ignoring the claim',
    );
  }

  let authoritative = parsed;

  if (config.SARVAM_REFETCH_BEFORE_ACTING && agent?.appId != null) {
    const fromProvider = await provider.getInteraction(
      { appId: agent.appId },
      parsed.externalCallId,
    );

    if (fromProvider === null) {
      /**
       * The payload named an interaction the provider does not have. With the re-fetch on,
       * that is the end of it: this is the forged-webhook case, and the whole point of the
       * measure is that we do not act on it.
       */
      await asSystem('voice-webhook-event-unverified', (db) =>
        repository.markInboxEvent(
          db,
          webhookEventId,
          'FAILED',
          'the provider has no such interaction',
        ),
      );

      return {
        callId: null,
        organisationId,
        outcome: 'unresolvable',
        transcriptTurns: 0,
        recordingQueued: false,
      };
    }

    // The provider's own figures win over the payload's, field by field, keeping the
    // payload's value only where the provider's record has none.
    authoritative = {
      ...parsed,
      direction: fromProvider.direction,
      fromE164: fromProvider.fromE164 ?? parsed.fromE164,
      toE164: fromProvider.toE164 ?? parsed.toE164,
      startedAt: fromProvider.startedAt ?? parsed.startedAt,
      endedAt: fromProvider.endedAt ?? parsed.endedAt,
      durationSeconds: fromProvider.durationSeconds ?? parsed.durationSeconds,
    };
  }

  /**
   * The transcript from the authenticated endpoint, preferred over the webhook's copy.
   *
   * The contract says an unknown id answers 200 with no messages and should be retried
   * (section 5), so an empty answer falls back to what the webhook carried rather than
   * storing nothing. Between the two, a clinician sees the conversation either way.
   */
  let turns = authoritative.transcript;

  if (agent?.appId != null) {
    try {
      const fetched = await provider.fetchTranscript({ appId: agent.appId }, parsed.externalCallId);
      if (fetched.length > 0) {
        turns = fetched;
      }
    } catch (error) {
      // Not fatal: the call row matters more than its transcript, and the job will retry.
      // The message, never the body.
      logger.warn({ err: error }, 'transcript fetch failed; keeping the webhook copy');
    }
  }

  const result = await withTenant({ organisationId }, async (db) => {
    const patientId = await calls.solePatientByPhone(db, organisationId, authoritative.fromE164);

    const call = await calls.upsertFromProvider(db, organisationId, {
      id: uuidV7(),
      externalCallId: authoritative.externalCallId,
      direction: authoritative.direction,
      status: statusOf(authoritative),
      fromE164: authoritative.fromE164,
      toE164: authoritative.toE164,
      startedAt: authoritative.startedAt,
      endedAt: authoritative.endedAt,
      durationSeconds: authoritative.durationSeconds,
      patientId,
    });

    if (call.claimedElsewhere === true) {
      /**
       * The provider's id already belongs to another clinic, which should be impossible: an
       * interaction belongs to one workspace. It is logged rather than written, because
       * writing would mean attributing one clinic's conversation to another, and throwing
       * would retry a condition that cannot improve.
       */
      logger.warn(
        { organisationId, externalCallId: authoritative.externalCallId },
        'webhook named an interaction that already belongs to another clinic; ignoring it',
      );

      return call;
    }

    await calls.replaceTranscript(db, organisationId, call.id, turns, asPlainText(turns), uuidV7);

    await record(db, {
      action: 'call.ingested',
      entityType: 'call',
      entityId: call.id,
      organisationId,
      /**
       * Counts and identifiers only. A transcript is the rawest PHI in the product after a
       * recording, and `turns` is how much of it there is, never any of it.
       */
      metadata: {
        externalCallId: authoritative.externalCallId,
        turns: turns.length,
        created: call.created,
        patientLinked: patientId !== null,
        actorSource: 'VOICE_AGENT',
      },
    });

    return call;
  });

  await asSystem('voice-webhook-event-processed', (db) =>
    repository.markInboxEvent(db, webhookEventId, 'PROCESSED', null, now()),
  );

  return {
    callId: result.id,
    organisationId,
    outcome: 'processed',
    transcriptTurns: turns.length,
    recordingQueued: true,
  };
};

/**
 * Copies one call's recording from the provider into our own object storage.
 *
 * ─── WHY IT IS COPIED AT ALL ────────────────────────────────────────────────────
 *
 * The contract says the recording endpoint returns the bytes with no signed URL and no
 * documented expiry, and that Sarvam's retention is UNKNOWN (section 5). So a dashboard that
 * played the provider's URL would be a feature that stops working on a date nobody knows. It
 * is fetched once, written under a tenant-prefixed key, and served to staff as a short-lived
 * presigned URL, which is also what D-007 requires since no route may stream.
 */
export const downloadRecording = async (
  callId: string,
  organisationId: string,
  dependencies: Partial<IngestDependencies> = {},
): Promise<{ readonly stored: boolean; readonly key: string | null }> => {
  const { provider, storage } = { ...defaults(), ...dependencies };

  const agent = await asSystem('voice-recording-agent-read', (db) =>
    repository.findAgentByOrganisation(db, organisationId),
  );

  if (agent?.appId == null) {
    throw new ProviderContractError(
      `clinic ${organisationId} has no provider app id, so its recordings cannot be fetched`,
    );
  }

  const call = await withTenant({ organisationId }, (db) =>
    calls.findById(db, organisationId, callId),
  );

  if (call === null) {
    return { stored: false, key: null };
  }

  if (call.recordingKey !== null) {
    // Already copied. A retry after the key was written must not fetch and upload again.
    return { stored: false, key: call.recordingKey };
  }

  const recording = await provider.fetchRecording({ appId: agent.appId }, call.externalCallId);

  if (recording === null) {
    // No recording exists for this call, which is a real answer: consent may have been
    // declined, or the call may have ended before anything was recorded.
    return { stored: false, key: null };
  }

  const key = recordingKey(organisationId, callId, 'wav');

  await storage.put({
    bucket: config.RECORDINGS_BUCKET,
    key,
    body: recording.bytes,
    contentType: recording.contentType,
  });

  await withTenant({ organisationId }, async (db: TenantDb) => {
    await calls.setRecordingKey(db, organisationId, callId, key);

    await record(db, {
      action: 'call.recording_stored',
      entityType: 'call',
      entityId: callId,
      organisationId,
      // The size, not the audio, and the key is ours rather than the patient's.
      metadata: { bytes: recording.bytes.byteLength, actorSource: 'VOICE_AGENT' },
    });
  });

  return { stored: true, key };
};

export type CatchUpResult = {
  readonly clinicsChecked: number;
  readonly interactionsSeen: number;
  readonly callsCreated: number;
};

/**
 * Finds calls the provider has that we do not.
 *
 * ─── WHY THIS EXISTS AT ALL ─────────────────────────────────────────────────────
 *
 * The contract records UNKNOWN against whether webhooks are retried automatically, what the
 * timeout is, and which response counts as a success (section 6). So a delivery that never
 * arrives is not a hypothetical: it is an undocumented behaviour we cannot rely on. This
 * walks each clinic's interactions for the last `hours` and ingests anything missing, which
 * turns an unknown into a bounded delay.
 *
 * It creates the call row from the provider's own record and leaves the transcript to a
 * subsequent fetch, because the list endpoint carries no transcript unless asked and the
 * transcript endpoint is the authority anyway.
 */
export const catchUpInteractions = async (
  hours: number,
  dependencies: Partial<IngestDependencies> = {},
): Promise<CatchUpResult> => {
  const { provider, now } = { ...defaults(), ...dependencies };

  const agents = await asSystem('voice-catch-up-agents', (db) =>
    repository.findActiveAgentsWithAppId(db),
  );

  const to = now();
  const from = new Date(to.getTime() - hours * 60 * 60 * 1000);

  let interactionsSeen = 0;
  let callsCreated = 0;

  for (const agent of agents) {
    const interactions = await provider.listInteractions({ appId: agent.appId }, { from, to });
    interactionsSeen += interactions.length;

    for (const interaction of interactions) {
      const created = await withTenant({ organisationId: agent.organisationId }, async (db) => {
        const patientId = await calls.solePatientByPhone(
          db,
          agent.organisationId,
          interaction.fromE164 ?? '',
        );

        const call = await calls.upsertFromProvider(db, agent.organisationId, {
          id: uuidV7(),
          externalCallId: interaction.externalCallId,
          direction: interaction.direction,
          status: (interaction.durationSeconds ?? 0) > 0 ? 'COMPLETED' : 'MISSED',
          fromE164: interaction.fromE164 ?? '',
          toE164: interaction.toE164 ?? '',
          startedAt: interaction.startedAt,
          endedAt: interaction.endedAt,
          durationSeconds: interaction.durationSeconds,
          patientId,
        });

        if (call.claimedElsewhere === true) {
          logger.warn(
            { organisationId: agent.organisationId, externalCallId: interaction.externalCallId },
            'catch-up found an interaction that already belongs to another clinic; ignoring it',
          );
        }

        if (call.created) {
          await record(db, {
            action: 'call.ingested',
            entityType: 'call',
            entityId: call.id,
            organisationId: agent.organisationId,
            // `via` is the useful part: a row the catch-up created means a webhook did not
            // arrive, which is the evidence for the UNKNOWN in the contract.
            metadata: {
              externalCallId: interaction.externalCallId,
              via: 'catch-up',
              actorSource: 'VOICE_AGENT',
            },
          });
        }

        return call.created;
      });

      if (created) {
        callsCreated += 1;
      }
    }
  }

  return { clinicsChecked: agents.length, interactionsSeen, callsCreated };
};
