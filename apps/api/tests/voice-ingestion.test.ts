import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidV7 } from '../src/common/uuid.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import {
  catchUpInteractions,
  downloadRecording,
  processWebhookEvent,
} from '../src/voice/ingest.service.js';
import { sarvamProvider } from '../src/voice/providers/sarvam.js';
import type {
  CallTranscriptTurn,
  ProviderInteraction,
  VoiceProvider,
} from '../src/voice/provider.js';
import type { StorageClient } from '../src/storage/object-storage.js';
import { inboundCallFinished } from '../src/voice/providers/__fixtures__/inbound-call-finished.js';

/**
 * The three ingestion jobs, against a real database and a stubbed provider.
 *
 * ─── WHY THE PROVIDER IS STUBBED AND THE DATABASE IS NOT ────────────────────────
 *
 * There is no Sarvam to talk to, and if there were, these tests would be asserting their
 * uptime. What is ours and worth testing is everything that happens to a payload after it
 * arrives: which clinic it lands in, whether a second delivery changes anything, whether a
 * payload the provider cannot confirm is acted on, and whether the patient is linked when
 * and only when that is unambiguous. All of that is database behaviour.
 *
 * The parser is NOT stubbed: the real `sarvamProvider.parseWebhook` runs, because the point
 * is the whole path from a stored body to a call row.
 */

const RECORDING = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03, 0x04]);

type Stub = {
  readonly provider: VoiceProvider;
  readonly storage: StorageClient;
  readonly puts: { key: string; contentType: string; bytes: number }[];
};

/**
 * A provider that answers from memory.
 *
 * `getInteraction` returning null is the forged-webhook case and has its own test, so it is a
 * knob rather than a fixed answer.
 */
const stub = (
  options: {
    readonly interaction?: ProviderInteraction | null;
    readonly transcript?: readonly CallTranscriptTurn[];
    readonly transcriptThrows?: boolean;
    readonly recording?: Uint8Array | null;
    readonly interactions?: readonly ProviderInteraction[];
  } = {},
): Stub => {
  const puts: Stub['puts'] = [];

  return {
    puts,
    provider: {
      name: 'SARVAM',
      parseWebhook: sarvamProvider.parseWebhook,
      getInteraction: () =>
        Promise.resolve(options.interaction === undefined ? null : options.interaction),
      listInteractions: () => Promise.resolve(options.interactions ?? []),
      fetchTranscript: () =>
        options.transcriptThrows === true
          ? Promise.reject(new Error('transcript not ready'))
          : Promise.resolve(options.transcript ?? []),
      fetchRecording: () =>
        Promise.resolve(
          options.recording === null || options.recording === undefined
            ? null
            : { bytes: options.recording, contentType: 'audio/wav' },
        ),
    },
    storage: {
      put: (input) => {
        puts.push({
          key: input.key,
          contentType: input.contentType,
          bytes: typeof input.body === 'string' ? input.body.length : input.body.byteLength,
        });
        return Promise.resolve();
      },
      presignGet: () => Promise.resolve('https://example.invalid/presigned'),
      list: () => Promise.resolve([]),
      remove: () => Promise.resolve(),
    },
  };
};

/** What the provider's own records say, matching the fixture payload. */
const confirmed = (externalCallId: string): ProviderInteraction => ({
  externalCallId,
  startedAt: new Date('2026-11-02T06:30:00.000Z'),
  endedAt: new Date('2026-11-02T06:31:32.000Z'),
  durationSeconds: 92,
  direction: 'INBOUND',
  fromE164: null,
  toE164: null,
  endedBy: 'caller',
  failureReason: null,
});

let clinic: OrganisationGraph;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    clinic = await createOrganisationGraph(tx, 'Ingestion');
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

/** Stores a webhook event the way the route does, and returns its id. */
const storeEvent = async (
  body: object,
  organisationId: string | null = clinic.organisationId,
): Promise<string> => {
  const id = uuidV7();

  await asPlatform(ownerClient(), (tx) =>
    tx.webhookEvent.create({
      data: {
        id,
        organisationId,
        provider: 'SARVAM',
        externalEventId: (body as { interaction_id?: string }).interaction_id ?? `unparsed:${id}`,
        eventType: 'call.finished',
        payload: body as never,
      },
    }),
  );

  return id;
};

const payload = (interactionId: string, extra: object = {}): object => ({
  ...inboundCallFinished,
  interaction_id: interactionId,
  ...extra,
});

const callFor = async (externalCallId: string) =>
  asPlatform(ownerClient(), (tx) =>
    tx.call.findFirst({
      where: { externalCallId },
      select: {
        id: true,
        organisationId: true,
        status: true,
        durationSeconds: true,
        fromE164: true,
        patientId: true,
        transcript: true,
        recordingKey: true,
        startedAt: true,
      },
    }),
  );

describe('processing a stored webhook event', () => {
  it('writes the call and its transcript, attributed turn by turn', async () => {
    const interactionId = `20261102/ingest_${Date.now()}`;
    const eventId = await storeEvent(payload(interactionId));

    const result = await processWebhookEvent(
      eventId,
      stub({ interaction: confirmed(interactionId) }),
    );

    expect(result.outcome).toBe('processed');
    expect(result.transcriptTurns).toBe(4);

    const call = await callFor(interactionId);
    expect(call?.organisationId).toBe(clinic.organisationId);
    expect(call?.status).toBe('COMPLETED');
    expect(call?.durationSeconds).toBe(92);

    const turns = await asPlatform(ownerClient(), (tx) =>
      tx.callTranscriptTurn.findMany({
        where: { callId: call?.id ?? '' },
        select: { turnIndex: true, role: true, text: true },
        orderBy: { turnIndex: 'asc' },
      }),
    );

    expect(turns).toHaveLength(4);
    expect(turns[0]).toMatchObject({ turnIndex: 0, role: 'AGENT' });
    expect(turns[1]?.role).toBe('CALLER');
    // The plain text stays as well, which is what an export or a search reads.
    expect(call?.transcript).toContain('Caller: I need an appointment on Tuesday.');
  });

  it('is idempotent: the same event twice leaves one call and one transcript', async () => {
    const interactionId = `20261102/twice_${Date.now()}`;
    const eventId = await storeEvent(payload(interactionId));
    const dependencies = stub({ interaction: confirmed(interactionId) });

    await processWebhookEvent(eventId, dependencies);
    const second = await processWebhookEvent(eventId, dependencies);

    // The event is marked PROCESSED, so the second run stops before doing anything. A
    // provider that re-sends and a job that retries both land here.
    expect(second.outcome).toBe('already-processed');

    const calls = await asPlatform(ownerClient(), (tx) =>
      tx.call.count({ where: { externalCallId: interactionId } }),
    );
    const turns = await asPlatform(ownerClient(), (tx) =>
      tx.callTranscriptTurn.count({ where: { call: { externalCallId: interactionId } } }),
    );

    expect(calls).toBe(1);
    expect(turns).toBe(4);
  });

  it('prefers the provider’s own figures over the payload’s', async () => {
    const interactionId = `20261102/authority_${Date.now()}`;
    // A payload claiming a much longer call than the provider's records show.
    const eventId = await storeEvent(payload(interactionId, { duration: 9999 }));

    await processWebhookEvent(eventId, stub({ interaction: confirmed(interactionId) }));

    // D-006 measure three: what we act on is what the provider says, not what the
    // unauthenticated body claims.
    expect((await callFor(interactionId))?.durationSeconds).toBe(92);
  });

  it('refuses to create a call the provider has no record of', async () => {
    const interactionId = `20261102/forged_${Date.now()}`;
    const eventId = await storeEvent(payload(interactionId));

    // `interaction: null` is the forged-webhook case: a well-formed body for a call that
    // never happened. This is the whole reason the re-read exists.
    const result = await processWebhookEvent(eventId, stub({ interaction: null }));

    expect(result.outcome).toBe('unresolvable');
    expect(await callFor(interactionId)).toBeNull();

    const event = await asPlatform(ownerClient(), (tx) =>
      tx.webhookEvent.findUnique({
        where: { id: eventId },
        select: { status: true, lastError: true, attempts: true },
      }),
    );

    expect(event?.status).toBe('FAILED');
    expect(event?.lastError).toBe('the provider has no such interaction');
    expect(event?.attempts).toBe(1);
  });

  it('prefers the transcript endpoint over the webhook’s copy', async () => {
    const interactionId = `20261102/transcript_${Date.now()}`;
    const eventId = await storeEvent(payload(interactionId));

    await processWebhookEvent(
      eventId,
      stub({
        interaction: confirmed(interactionId),
        transcript: [{ role: 'AGENT', text: 'From the authenticated endpoint.' }],
      }),
    );

    const call = await callFor(interactionId);
    expect(call?.transcript).toBe('Agent: From the authenticated endpoint.');
  });

  it('keeps the webhook’s transcript when the endpoint is not ready', async () => {
    const interactionId = `20261102/notready_${Date.now()}`;
    const eventId = await storeEvent(payload(interactionId));

    /**
     * The contract says an unknown id answers 200 with no messages and should be retried
     * later (section 5), and a fetch may also simply fail. Either way the call row and the
     * words the webhook carried are better than nothing, so neither is fatal.
     */
    const result = await processWebhookEvent(
      eventId,
      stub({ interaction: confirmed(interactionId), transcriptThrows: true }),
    );

    expect(result.transcriptTurns).toBe(4);
    expect((await callFor(interactionId))?.transcript).toContain('Agent: Good morning');
  });

  it('links the caller to their record, and refuses to when a number is shared', async () => {
    const lone = '+919812340101';
    const shared = '+919812340202';

    await asPlatform(ownerClient(), async (tx) => {
      await tx.patient.create({
        data: {
          id: uuidV7(),
          organisationId: clinic.organisationId,
          fullName: 'Ingest Lone Caller',
          phone: lone,
        },
      });
      for (const fullName of ['Ingest Family One', 'Ingest Family Two']) {
        await tx.patient.create({
          data: { id: uuidV7(), organisationId: clinic.organisationId, fullName, phone: shared },
        });
      }
    });

    const oneId = `20261102/lone_${Date.now()}`;
    const manyId = `20261102/shared_${Date.now()}`;

    await processWebhookEvent(
      await storeEvent(payload(oneId, { user_phone_number: lone })),
      stub({ interaction: confirmed(oneId) }),
    );
    await processWebhookEvent(
      await storeEvent(payload(manyId, { user_phone_number: shared })),
      stub({ interaction: confirmed(manyId) }),
    );

    expect((await callFor(oneId))?.patientId).not.toBeNull();
    /**
     * NULL for a shared number, as `calls.patient_id` is documented to be: attaching one
     * person's call to a relative's history is worse than leaving a number for a human to
     * resolve.
     */
    expect((await callFor(manyId))?.patientId).toBeNull();
  });

  it('records a failure against an event with no clinic rather than throwing', async () => {
    const eventId = await storeEvent(payload(`20261102/orphan_${Date.now()}`), null);

    const result = await processWebhookEvent(eventId, stub());

    expect(result.outcome).toBe('unresolvable');

    const event = await asPlatform(ownerClient(), (tx) =>
      tx.webhookEvent.findUnique({ where: { id: eventId }, select: { status: true } }),
    );

    // A job that threw here would retry six times and still have no clinic to file it under.
    expect(event?.status).toBe('FAILED');
  });
});

describe('copying the recording', () => {
  const ingest = async (interactionId: string): Promise<string> => {
    const eventId = await storeEvent(payload(interactionId));
    const result = await processWebhookEvent(
      eventId,
      stub({ interaction: confirmed(interactionId) }),
    );
    return result.callId ?? '';
  };

  it('writes it to our own storage and records the key', async () => {
    const interactionId = `20261102/rec_${Date.now()}`;
    const callId = await ingest(interactionId);
    const dependencies = stub({ recording: RECORDING });

    const result = await downloadRecording(callId, clinic.organisationId, dependencies);

    expect(result.stored).toBe(true);
    expect(dependencies.puts).toHaveLength(1);
    // Tenant-prefixed, so a clinic's recordings are one prefix for retention and offboarding,
    // and `.wav` because that is what the provider sends (contract section 5).
    expect(dependencies.puts[0]?.key).toBe(`recordings/${clinic.organisationId}/${callId}.wav`);
    expect(dependencies.puts[0]?.contentType).toBe('audio/wav');
    expect((await callFor(interactionId))?.recordingKey).toBe(result.key);
  });

  it('does not fetch it twice', async () => {
    const interactionId = `20261102/rec_twice_${Date.now()}`;
    const callId = await ingest(interactionId);

    await downloadRecording(callId, clinic.organisationId, stub({ recording: RECORDING }));
    const again = stub({ recording: RECORDING });
    const second = await downloadRecording(callId, clinic.organisationId, again);

    // A retry after the key was written must not pull the file down again: the key on the row
    // is the record that it is already ours.
    expect(second.stored).toBe(false);
    expect(again.puts).toHaveLength(0);
  });

  it('treats no recording as an answer rather than a failure', async () => {
    const interactionId = `20261102/rec_none_${Date.now()}`;
    const callId = await ingest(interactionId);

    const result = await downloadRecording(
      callId,
      clinic.organisationId,
      stub({ recording: null }),
    );

    // Consent may have been declined, or the call may have ended before anything was
    // recorded. Throwing would retry six times for a file that will never exist.
    expect(result.stored).toBe(false);
    expect(result.key).toBeNull();
    expect((await callFor(interactionId))?.recordingKey).toBeNull();
  });

  it('audits the copy with the size and not the audio', async () => {
    const interactionId = `20261102/rec_audit_${Date.now()}`;
    const callId = await ingest(interactionId);

    await downloadRecording(callId, clinic.organisationId, stub({ recording: RECORDING }));

    const row = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findFirst({
        where: { action: 'call.recording_stored', entityId: callId },
        select: { metadata: true, organisationId: true },
      }),
    );

    expect(row?.organisationId).toBe(clinic.organisationId);
    expect(row?.metadata).toMatchObject({ bytes: RECORDING.byteLength });
  });
});

describe('catching up on calls no webhook delivered', () => {
  it('creates the ones we do not have and leaves the ones we do', async () => {
    const existing = `20261102/catchup_existing_${Date.now()}`;
    const missing = `20261102/catchup_missing_${Date.now()}`;

    await processWebhookEvent(
      await storeEvent(payload(existing)),
      stub({ interaction: confirmed(existing) }),
    );

    const result = await catchUpInteractions(
      6,
      stub({ interactions: [confirmed(existing), confirmed(missing)] }),
    );

    /**
     * The contract records UNKNOWN against whether Sarvam retries a webhook at all (section
     * 6), so this job is the answer to a delivery that never arrives. `callsCreated` above
     * zero is also the evidence of how often that happens.
     */
    expect(result.interactionsSeen).toBeGreaterThanOrEqual(2);
    expect(await callFor(missing)).not.toBeNull();

    const duplicates = await asPlatform(ownerClient(), (tx) =>
      tx.call.count({ where: { externalCallId: existing } }),
    );
    expect(duplicates).toBe(1);
  });

  it('files each clinic’s interactions under that clinic', async () => {
    const theirs = await asPlatform(ownerClient(), (tx) =>
      createOrganisationGraph(tx, 'IngestionOther'),
    );
    const mine = `20261102/catchup_mine_${Date.now()}`;
    const not_mine = `20261102/catchup_theirs_${Date.now()}`;

    await catchUpInteractions(6, stub({ interactions: [confirmed(mine), confirmed(not_mine)] }));

    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.call.findMany({
        where: { externalCallId: { in: [mine, not_mine] } },
        select: { externalCallId: true, organisationId: true },
      }),
    );

    /**
     * ONE ROW PER INTERACTION, NOT ONE PER CLINIC, and that is the correct answer rather
     * than a limitation. `calls` is unique on `(provider, external_call_id)` across the whole
     * platform because a provider's interaction id identifies one conversation: it cannot
     * belong to two clinics.
     *
     * An earlier version of this test asserted the opposite, with a stub that answered the
     * same interaction for every clinic, and it found a real defect: the lookup is scoped to
     * one organisation, so it missed a row owned by another and the insert then violated the
     * global unique. In a job that is six retries and a stuck event for a condition no retry
     * can change. It is now skipped and logged.
     */
    expect(rows).toHaveLength(2);
    expect(new Set(rows.map((row) => row.organisationId)).size).toBe(1);
    expect(theirs.organisationId).not.toBe('');
  });

  it('does not attribute one clinic’s interaction to another', async () => {
    const interactionId = `20261102/claimed_${Date.now()}`;

    // Ingested for our clinic first, through the webhook path.
    await processWebhookEvent(
      await storeEvent(payload(interactionId)),
      stub({ interaction: confirmed(interactionId) }),
    );

    // Then offered to every clinic by the catch-up, which is the collision case.
    const result = await catchUpInteractions(6, stub({ interactions: [confirmed(interactionId)] }));

    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.call.findMany({
        where: { externalCallId: interactionId },
        select: { organisationId: true },
      }),
    );

    expect(rows).toHaveLength(1);
    expect(rows[0]?.organisationId).toBe(clinic.organisationId);
    expect(result.callsCreated).toBe(0);
  });
});
