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
 * ─── THE PAYLOAD IS USED AS IT ARRIVED, AND VERIFIED AFTER (D-006) ──────────────
 *
 * The clinic comes from the URL secret and the body was validated at the route. The call and
 * its transcript are created from the payload with no provider call in front of them, so a
 * call appears as soon as its event is processed. Verification is a side effect of the
 * recording job, which talks to Sarvam about the interaction anyway: it looks the interaction
 * up in Sarvam's interactions list and marks the call VERIFIED or NOT_FOUND. The dashboard
 * flags NOT_FOUND, which is what a forged webhook becomes.
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

  // Validated at the route (webhook.routes.ts); parsed again here for its normalised shape.
  const authoritative = provider.parseWebhook(event.payload);

  /**
   * `metadata.clinic_id` is echoed back to us unauthenticated, so it is never used to route.
   * A mismatch is worth a line in the log, and the clinic is the one the URL secret named.
   */
  if (
    authoritative.routing.claimedClinicId !== null &&
    authoritative.routing.claimedClinicId !== organisationId
  ) {
    logger.warn(
      { organisationId, webhookEventId },
      'webhook metadata claimed a different clinic than its secret resolved to; ignoring the claim',
    );
  }

  // The payload's own transcript, stored as it arrived: no separate re-fetch (D-006).
  const turns = authoritative.transcript;

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
 * How long after we received a call its absence from Sarvam's interactions list is taken as
 * an answer. The contract says the list is cached for 60 seconds (section 5), so a call looked
 * up just after it ended can be missing although it is real. Five minutes is well past that.
 */
export const VERIFICATION_SETTLE_MS = 5 * 60_000;

/**
 * Thrown when a call is not in Sarvam's list YET, inside the settle window, so the job is
 * retried later rather than the call being marked NOT_FOUND on a stale cache.
 */
export class VerificationPendingError extends Error {
  constructor(callId: string) {
    super(`call ${callId} is not in the provider's interactions list yet; retrying later`);
    this.name = 'VerificationPendingError';
  }
}

export type RecordingResult = {
  readonly stored: boolean;
  readonly key: string | null;
  readonly verification: 'UNCHECKED' | 'VERIFIED' | 'NOT_FOUND';
};

/**
 * Copies one call's recording into our own storage, and verifies the call while it is there.
 *
 * ─── WHY THE RECORDING IS COPIED AT ALL ─────────────────────────────────────────
 *
 * The contract says the recording endpoint returns the bytes with no signed URL and no
 * documented expiry, and that Sarvam's retention is UNKNOWN (section 5). So it is fetched
 * once, written under a tenant-prefixed key, and served to staff as a short-lived presigned
 * URL, which is also what D-007 requires since no route may stream.
 *
 * ─── TWO QUESTIONS, TWO ANSWERS, NEVER MIXED ────────────────────────────────────
 *
 * "Is there audio?" is `has_recording`, from the recording endpoint. "Did Sarvam have this
 * call?" is `verification`, from the interactions list. A recording 404 answers the first
 * only: it is what a forged call AND a clinic that does not record both get, so it can never
 * stand in for the second. Each is asked once; a retry skips whatever already has an answer.
 */
export const downloadRecording = async (
  callId: string,
  organisationId: string,
  dependencies: Partial<IngestDependencies> = {},
): Promise<RecordingResult> => {
  const { provider, storage, now } = { ...defaults(), ...dependencies };

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
    return { stored: false, key: null, verification: 'UNCHECKED' };
  }

  const stored =
    call.hasRecording === null && call.recordingKey === null
      ? await copyRecording(
          provider,
          storage,
          agent.appId,
          organisationId,
          callId,
          call.externalCallId,
        )
      : { stored: false, key: call.recordingKey };

  const verification =
    call.verification === 'UNCHECKED'
      ? await verifyCall(provider, agent.appId, organisationId, call, now())
      : call.verification;

  return { ...stored, verification };
};

/** Asks for the audio once and records the answer, with the key when there was audio. */
const copyRecording = async (
  provider: VoiceProvider,
  storage: StorageClient,
  appId: string,
  organisationId: string,
  callId: string,
  externalCallId: string,
): Promise<{ readonly stored: boolean; readonly key: string | null }> => {
  const recording = await provider.fetchRecording({ appId }, externalCallId);

  if (recording === null) {
    // No audio, which is a real answer: consent may have been declined, or the clinic may not
    // record. It says nothing about whether the call happened.
    await withTenant({ organisationId }, (db) =>
      calls.setRecordingResult(db, organisationId, callId, { hasRecording: false }),
    );
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
    await calls.setRecordingResult(db, organisationId, callId, {
      hasRecording: true,
      recordingKey: key,
    });

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

/**
 * Looks the call up in Sarvam's interactions list and records whether it is there.
 *
 * The window is anchored on OUR receive time (`created_at`), never on a time the payload
 * claims, so a forged body cannot steer the lookup away from where the real call would be.
 */
const verifyCall = async (
  provider: VoiceProvider,
  appId: string,
  organisationId: string,
  call: { readonly id: string; readonly externalCallId: string; readonly createdAt: Date },
  at: Date,
): Promise<'VERIFIED' | 'NOT_FOUND'> => {
  let found: boolean;

  try {
    found =
      (await provider.getInteraction({ appId }, call.externalCallId, call.createdAt)) !== null;
  } catch (error) {
    // The lookup failed, which says nothing about the call. It stays UNCHECKED and the job
    // retries. The error's message, never a body: a provider error may quote the caller.
    logger.warn(
      { err: error, organisationId, callId: call.id },
      'call verification lookup failed; the call stays UNCHECKED',
    );
    throw error;
  }

  if (!found && at.getTime() - call.createdAt.getTime() < VERIFICATION_SETTLE_MS) {
    throw new VerificationPendingError(call.id);
  }

  const verification = found ? 'VERIFIED' : 'NOT_FOUND';

  await withTenant({ organisationId }, async (db) => {
    await calls.setVerification(db, organisationId, call.id, verification, at);

    await record(db, {
      action: 'call.verified',
      entityType: 'call',
      entityId: call.id,
      organisationId,
      metadata: { verification, actorSource: 'VOICE_AGENT' },
    });
  });

  if (!found) {
    logger.warn(
      { organisationId, callId: call.id },
      'call NOT FOUND in the provider interactions list; flagged as unverified',
    );
  }

  return verification;
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
          // Built from Sarvam's own interactions list, so verified by construction.
          verification: 'VERIFIED',
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
