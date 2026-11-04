import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { uuidV7 } from '../src/common/uuid.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import {
  catchUpInteractions,
  downloadRecording,
  processWebhookEvent,
  VERIFICATION_SETTLE_MS,
  VerificationPendingError,
} from '../src/voice/ingest.service.js';
import { sarvamProvider } from '../src/voice/providers/sarvam.js';
import type { ProviderInteraction, VoiceProvider } from '../src/voice/provider.js';
import type { StorageClient } from '../src/storage/object-storage.js';
import { inboundCallFinished } from '../src/voice/providers/__fixtures__/inbound-call-finished.js';

/**
 * The three ingestion jobs, against a real database and a stubbed provider.
 *
 * ─── WHY THE PROVIDER IS STUBBED AND THE DATABASE IS NOT ────────────────────────
 *
 * There is no Sarvam to talk to, and if there were, these tests would be asserting their
 * uptime. What is ours and worth testing is everything that happens to a payload after it
 * arrives: which clinic it lands in, whether a second delivery changes anything, how a call
 * the provider does not have is flagged, and whether the patient is linked when and only when
 * that is unambiguous. All of that is database behaviour.
 *
 * The parser is NOT stubbed: the real `sarvamProvider.parseWebhook` runs, because the point
 * is the whole path from a stored body to a call row.
 */

const RECORDING = new Uint8Array([0x52, 0x49, 0x46, 0x46, 0x01, 0x02, 0x03, 0x04]);

type Stub = {
  readonly provider: VoiceProvider;
  readonly storage: StorageClient;
  readonly now: () => Date;
  readonly puts: { key: string; contentType: string; bytes: number }[];
  /** Every provider call made, by name, so a test can assert that none was. */
  readonly asked: string[];
  /** The `around` each interaction lookup was anchored on. */
  readonly anchors: (Date | undefined)[];
};

/**
 * A provider that answers from memory and records what it was asked.
 *
 * `interaction: null` is Sarvam having no record of the call, which is what a forged webhook
 * looks like to the verification step, so it is a knob rather than a fixed answer.
 */
const stub = (
  options: {
    readonly interaction?: ProviderInteraction | null;
    readonly lookupThrows?: Error;
    readonly recording?: Uint8Array | null;
    readonly interactions?: readonly ProviderInteraction[];
    readonly now?: Date;
  } = {},
): Stub => {
  const puts: Stub['puts'] = [];
  const asked: string[] = [];
  const anchors: Stub['anchors'] = [];

  return {
    puts,
    asked,
    anchors,
    now: () => options.now ?? new Date(),
    provider: {
      name: 'SARVAM',
      parseWebhook: sarvamProvider.parseWebhook,
      getInteraction: (_agent, _id, around) => {
        asked.push('getInteraction');
        anchors.push(around);
        return options.lookupThrows === undefined
          ? Promise.resolve(options.interaction === undefined ? null : options.interaction)
          : Promise.reject(options.lookupThrows);
      },
      listInteractions: () => {
        asked.push('listInteractions');
        return Promise.resolve(options.interactions ?? []);
      },
      fetchRecording: () => {
        asked.push('fetchRecording');
        return Promise.resolve(
          options.recording === null || options.recording === undefined
            ? null
            : { bytes: options.recording, contentType: 'audio/wav' },
        );
      },
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
        hasRecording: true,
        verification: true,
        verifiedAt: true,
        createdAt: true,
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

  it('uses the payload as it arrived, and asks the provider nothing', async () => {
    const interactionId = `20261104/payload_${Date.now()}`;
    const eventId = await storeEvent(payload(interactionId, { duration: 140 }));
    const dependencies = stub();

    const result = await processWebhookEvent(eventId, dependencies);

    // D-006 as amended: no re-read and no transcript fetch before the call appears.
    expect(dependencies.asked).toEqual([]);
    expect(result.outcome).toBe('processed');

    const call = await callFor(interactionId);
    expect(call?.durationSeconds).toBe(140);
    expect(call?.transcript).toContain('Agent: Good morning');
    // Created unverified; the recording job checks it later.
    expect(call?.verification).toBe('UNCHECKED');
    expect(call?.hasRecording).toBeNull();
  });

  it('creates a call the provider would not recognise, to be flagged after the fact', async () => {
    const interactionId = `20261104/unknown_${Date.now()}`;
    const eventId = await storeEvent(payload(interactionId));

    // The provider has no record, but nothing asks it at this point.
    const result = await processWebhookEvent(eventId, stub({ interaction: null }));

    expect(result.outcome).toBe('processed');
    expect((await callFor(interactionId))?.verification).toBe('UNCHECKED');
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
  /** The verification half has its own suite below; here Sarvam simply has the call. */
  const found: ProviderInteraction = { ...confirmed('any'), externalCallId: 'any' };
  const ingest = async (interactionId: string): Promise<string> => {
    const eventId = await storeEvent(payload(interactionId));
    const result = await processWebhookEvent(eventId, stub());
    return result.callId ?? '';
  };

  it('writes it to our own storage and records the key', async () => {
    const interactionId = `20261102/rec_${Date.now()}`;
    const callId = await ingest(interactionId);
    const dependencies = stub({ recording: RECORDING, interaction: found });

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

    await downloadRecording(
      callId,
      clinic.organisationId,
      stub({ recording: RECORDING, interaction: found }),
    );
    const again = stub({ recording: RECORDING, interaction: found });
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
      stub({ recording: null, interaction: found }),
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

    await downloadRecording(
      callId,
      clinic.organisationId,
      stub({ recording: RECORDING, interaction: found }),
    );

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

/**
 * Verification after the fact (D-006 as amended on 2026-11-04).
 *
 * A webhook's call is created from its payload and then looked up in Sarvam's interactions
 * list by the recording job. TWO FACTS, NEVER MIXED: "is there audio" comes from the recording
 * endpoint, whose 404 a forged call and a clinic that does not record both get; "did Sarvam
 * have this call" comes from the interactions list.
 */
describe('verifying a call after it arrived', () => {
  const ingest = async (interactionId: string): Promise<string> => {
    const result = await processWebhookEvent(await storeEvent(payload(interactionId)), stub());
    return result.callId ?? '';
  };

  const afterSettling = async (callId: string): Promise<Date> => {
    const row = await asPlatform(ownerClient(), (tx) =>
      tx.call.findUniqueOrThrow({ where: { id: callId }, select: { createdAt: true } }),
    );
    return new Date(row.createdAt.getTime() + VERIFICATION_SETTLE_MS + 1_000);
  };

  it('marks a call VERIFIED when Sarvam’s interactions list holds it', async () => {
    const interactionId = `20261104/verify_found_${Date.now()}`;
    const callId = await ingest(interactionId);

    const result = await downloadRecording(
      callId,
      clinic.organisationId,
      stub({ interaction: confirmed(interactionId), recording: RECORDING }),
    );

    expect(result.verification).toBe('VERIFIED');
    const call = await callFor(interactionId);
    expect(call).toMatchObject({ verification: 'VERIFIED', hasRecording: true });
    expect(call?.verifiedAt).not.toBeNull();
  });

  it('keeps "no audio" and "not a real call" apart: a verified call with no recording', async () => {
    const interactionId = `20261104/verify_silent_${Date.now()}`;
    const callId = await ingest(interactionId);

    // The recording endpoint's 404, which a clinic that does not record gets on every call.
    await downloadRecording(
      callId,
      clinic.organisationId,
      stub({ interaction: confirmed(interactionId), recording: null }),
    );

    expect(await callFor(interactionId)).toMatchObject({
      verification: 'VERIFIED',
      hasRecording: false,
    });
  });

  it('marks a call NOT_FOUND once the list’s cache window has passed', async () => {
    const interactionId = `20261104/verify_missing_${Date.now()}`;
    const callId = await ingest(interactionId);

    const result = await downloadRecording(
      callId,
      clinic.organisationId,
      stub({ interaction: null, recording: null, now: await afterSettling(callId) }),
    );

    expect(result.verification).toBe('NOT_FOUND');
    expect((await callFor(interactionId))?.verification).toBe('NOT_FOUND');

    const audit = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findFirst({
        where: { action: 'call.verified', entityId: callId },
        select: { metadata: true },
      }),
    );
    expect(audit?.metadata).toMatchObject({ verification: 'NOT_FOUND' });
  });

  it('does not believe an absence inside the cache window: retries, and stays UNCHECKED', async () => {
    const interactionId = `20261104/verify_early_${Date.now()}`;
    const callId = await ingest(interactionId);

    await expect(
      downloadRecording(
        callId,
        clinic.organisationId,
        stub({ interaction: null, recording: RECORDING }),
      ),
    ).rejects.toThrow(VerificationPendingError);

    // The recording was still copied: verification is a side effect, not a gate on it.
    expect(await callFor(interactionId)).toMatchObject({
      verification: 'UNCHECKED',
      hasRecording: true,
    });
  });

  it('leaves the call UNCHECKED and retries when the lookup itself fails', async () => {
    const interactionId = `20261104/verify_error_${Date.now()}`;
    const callId = await ingest(interactionId);

    await expect(
      downloadRecording(
        callId,
        clinic.organisationId,
        stub({ lookupThrows: new Error('analytics answered 503'), recording: null }),
      ),
    ).rejects.toThrow('analytics answered 503');

    expect((await callFor(interactionId))?.verification).toBe('UNCHECKED');
  });

  it('asks each question once: a retry neither re-fetches the audio nor re-verifies', async () => {
    const interactionId = `20261104/verify_once_${Date.now()}`;
    const callId = await ingest(interactionId);

    await downloadRecording(
      callId,
      clinic.organisationId,
      stub({ interaction: confirmed(interactionId), recording: RECORDING }),
    );
    const retry = stub({
      interaction: null,
      recording: RECORDING,
      now: await afterSettling(callId),
    });
    await downloadRecording(callId, clinic.organisationId, retry);

    expect(retry.asked).toEqual([]);
    expect((await callFor(interactionId))?.verification).toBe('VERIFIED');
  });

  it('anchors the lookup on when WE received the call, not on a time the payload claims', async () => {
    const interactionId = `20261104/verify_anchor_${Date.now()}`;
    // A payload claiming the call happened a year ago, which would steer a window built from
    // it far away from where the real call would be.
    const callId = await processWebhookEvent(
      await storeEvent(
        payload(interactionId, {
          start_datetime: '2025-11-04T06:30:00.000Z',
          end_datetime: '2025-11-04T06:31:00.000Z',
        }),
      ),
      stub(),
    ).then((result) => result.callId ?? '');
    const dependencies = stub({ interaction: confirmed(interactionId), recording: null });

    await downloadRecording(callId, clinic.organisationId, dependencies);

    expect(dependencies.anchors).toEqual([(await callFor(interactionId))?.createdAt]);
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
    // Both came from Sarvam's own list, so both are verified at no extra cost: the one the
    // catch-up created, and the one a webhook had already delivered unchecked.
    expect((await callFor(missing))?.verification).toBe('VERIFIED');
    expect((await callFor(existing))?.verification).toBe('VERIFIED');

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
