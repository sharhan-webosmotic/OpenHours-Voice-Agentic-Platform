import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

/**
 * A patient's name, number and words must reach NO log line.
 *
 * ─── WHY THIS IS ITS OWN FILE AND MOCKS THE LOGGER MODULE ───────────────────────
 *
 * `src/common/logger.test.ts` already proves the redaction rules against the real pino
 * pipeline, field by field. It cannot prove the thing that actually matters: that a REQUEST
 * carrying patient data through the whole application produces no line containing it.
 * Redaction works by field name, so it protects `patient.name` and says nothing about a
 * field somebody adds tomorrow, or about an error message that interpolated a value, or
 * about pino-http logging a URL with a number in the query string.
 *
 * So this replaces the logger module itself, which every layer imports, with the same
 * production options writing to an array. Then it drives real calls and greps the output.
 * A test that asserted on a logger it constructed itself would prove nothing about the one
 * the application uses.
 *
 * The strings below are the ones to look for. They are synthetic and appear nowhere else.
 */
const { captured } = vi.hoisted(() => ({ captured: [] as string[] }));

vi.mock('../src/common/logger.js', async () => {
  const actual =
    await vi.importActual<typeof import('../src/common/logger.js')>('../src/common/logger.js');
  const { pino } = await import('pino');

  return {
    ...actual,
    // `trace`, so nothing is excluded by level: a line that would be dropped in production
    // is still a line somebody can enable in an incident.
    logger: pino(
      { ...actual.buildLoggerOptions(), level: 'trace' },
      { write: (line: string) => captured.push(line) },
    ),
  };
});

const { createApp } = await import('../src/app.js');
const { asPlatform, disconnectAll, mintToolSecret, mintWebhookSecret, ownerClient } =
  await import('./support/db.js');
const { processWebhookEvent } = await import('../src/voice/ingest.service.js');
const { sarvamProvider } = await import('../src/voice/providers/sarvam.js');
const { createOrganisationGraph } = await import('./support/fixtures.js');
const { markHoursCollected, nextBookableLocal } = await import('./support/clinic-schedule.js');
const { uuidV7 } = await import('../src/common/uuid.js');

const PATIENT_NAME = 'Zephyrine Quillfeather';
const PATIENT_PHONE = '+919812399001';
const SPOKEN_NOTE = 'my knee has been swollen since Tuesday';

const app = createApp({ readiness: () => Promise.resolve() });

let organisationId: string;
let secret: string;
let webhookSecret: string;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    const graph = await createOrganisationGraph(tx, 'VoicePhiLogs');
    organisationId = graph.organisationId;
    await markHoursCollected(tx, organisationId);
    secret = await mintToolSecret(tx, organisationId);
    webhookSecret = await mintWebhookSecret(tx, organisationId);
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const everythingLogged = (): string => captured.join('\n');

describe('nothing a patient said reaches the log', () => {
  it('logs nothing identifying from a booking that carries a name, a number and a complaint', async () => {
    const when = nextBookableLocal();

    const booked = await request(app)
      .post('/voice/tools/book')
      .set('Authorization', `Bearer ${secret}`)
      .send({
        phone: PATIENT_PHONE,
        fullName: PATIENT_NAME,
        date: when.date,
        time: when.time,
        callId: `call-${uuidV7()}`,
        toolCallId: 'book-1',
      });

    // A cancellation whose reason is the patient's own words, which is exactly what a
    // language model will put in that field however the prompt is worded.
    await request(app)
      .post('/voice/tools/cancel')
      .set('Authorization', `Bearer ${secret}`)
      .send({ phone: PATIENT_PHONE, reason: SPOKEN_NOTE });

    // A lookup that fails, so the rejection path logs as well as the success path.
    await request(app)
      .post('/voice/tools/lookup-patient')
      .set('Authorization', `Bearer ${secret}`)
      .send({ phone: 'not a number at all' });

    expect(booked.status).toBe(200);
    // The requests really did run through the application, so the absence below is a
    // finding about the logging rather than about an empty array.
    expect(captured.length).toBeGreaterThan(0);

    const log = everythingLogged();

    expect(log).not.toContain(PATIENT_NAME);
    expect(log).not.toContain(PATIENT_PHONE);
    expect(log).not.toContain(SPOKEN_NOTE);
    // The last digits on their own, in case a number were logged without its country code.
    expect(log).not.toContain('9812399001');
  });

  it('logs nothing identifying when the call fails inside the application', async () => {
    const before = captured.length;

    // A past date, which the slot engine refuses deep inside the service: the failure is
    // logged by the router's own handler, with the body still in scope.
    await request(app).post('/voice/tools/book').set('Authorization', `Bearer ${secret}`).send({
      phone: PATIENT_PHONE,
      fullName: PATIENT_NAME,
      date: '2020-01-06',
      time: '09:00',
    });

    const log = captured.slice(before).join('\n');

    expect(captured.length).toBeGreaterThan(before);
    expect(log).not.toContain(PATIENT_NAME);
    expect(log).not.toContain(PATIENT_PHONE);
  });

  it('still logs the request id and the route, so the line remains useful', async () => {
    const before = captured.length;

    await request(app)
      .post('/voice/tools/clinic-info')
      .set('Authorization', `Bearer ${secret}`)
      .send({});

    const log = captured.slice(before).join('\n');

    // The guard must not be satisfiable by logging nothing at all. A line that carries no
    // patient data and no request id would pass the assertions above and be useless in an
    // incident, so the shape is asserted too.
    expect(log).toContain('/voice/tools/clinic-info');
    expect(log).toMatch(/reqId|requestId/);
  });
});

/**
 * The webhook is the worst case, and it is the one the requirement names.
 *
 * A tool call carries a name and a number. A WEBHOOK CARRIES THE WHOLE CONVERSATION: every
 * word the patient said, in a field called `interaction_transcript`, inside a body that is
 * stored verbatim and passed to a parser, a job and an audit call. If anything in the
 * platform logs a request body, this is where it shows.
 */
describe('nothing from a call webhook reaches the log', () => {
  const COMPLAINT = 'my tooth has been aching since Diwali and the swelling is worse';
  const CALLER_NAME = 'Oleander Thistlewood';
  const CALLER_PHONE = '+919812399777';

  const body = (interactionId: string): object => ({
    interaction_id: interactionId,
    deployment_id: 'dep_phi_logs',
    user_phone_number: CALLER_PHONE,
    agent_phone_number: '+918000000777',
    duration: 140,
    start_datetime: '2026-11-02T07:00:00.000Z',
    end_datetime: '2026-11-02T07:02:20.000Z',
    metadata: { clinic_id: organisationId, patient_name: CALLER_NAME },
    interaction_transcript: [
      { role: 'user', en_text: COMPLAINT },
      { role: 'assistant', en_text: `Thank you ${CALLER_NAME}, I can offer Tuesday.` },
    ],
  });

  it('logs nothing identifying when the webhook is received and processed', async () => {
    const before = captured.length;
    const interactionId = `20261102/phi_${Date.now()}`;

    const received = await request(app)
      .post(`/webhooks/sarvam/${webhookSecret}`)
      .send(body(interactionId));

    expect(received.status).toBe(200);

    const stored = await asPlatform(ownerClient(), (tx) =>
      tx.webhookEvent.findFirstOrThrow({
        where: { externalEventId: interactionId },
        select: { id: true },
      }),
    );

    /**
     * Processed with a stubbed provider, so the job runs its whole path (parse, re-read,
     * write the call, write the transcript, audit) without a network. That path is where the
     * transcript is in scope, which is what makes this the interesting log to read.
     */
    await processWebhookEvent(stored.id, {
      provider: {
        ...sarvamProvider,
        getInteraction: () =>
          Promise.resolve({
            externalCallId: interactionId,
            startedAt: new Date('2026-11-02T07:00:00.000Z'),
            endedAt: new Date('2026-11-02T07:02:20.000Z'),
            durationSeconds: 140,
            direction: 'INBOUND' as const,
            fromE164: null,
            toE164: null,
            endedBy: 'caller',
            failureReason: null,
          }),
        fetchTranscript: () => Promise.resolve([]),
      },
    });

    const log = captured.slice(before).join('\n');

    expect(captured.length).toBeGreaterThan(before);
    expect(log).not.toContain(COMPLAINT);
    expect(log).not.toContain(CALLER_NAME);
    expect(log).not.toContain(CALLER_PHONE);
    expect(log).not.toContain('9812399777');
    // The transcript was genuinely stored, so the absence above is about the logging rather
    // than about a path that never ran.
    const turns = await asPlatform(ownerClient(), (tx) =>
      tx.callTranscriptTurn.count({ where: { call: { externalCallId: interactionId } } }),
    );
    expect(turns).toBe(2);
  });

  it('logs nothing identifying when the payload cannot be parsed', async () => {
    const before = captured.length;

    // No `interaction_id`, so the route stores it under a digest and the job's parse throws.
    // The error path is the one most likely to interpolate a body into a message.
    const received = await request(app)
      .post(`/webhooks/sarvam/${webhookSecret}`)
      .send({ user_phone_number: CALLER_PHONE, note: COMPLAINT });

    expect(received.status).toBe(200);

    const stored = await asPlatform(ownerClient(), (tx) =>
      tx.webhookEvent.findFirstOrThrow({
        where: { organisationId, externalEventId: { startsWith: 'unparsed:' } },
        select: { id: true },
        orderBy: { receivedAt: 'desc' },
      }),
    );

    await expect(processWebhookEvent(stored.id)).rejects.toThrow();

    const log = captured.slice(before).join('\n');

    expect(log).not.toContain(COMPLAINT);
    expect(log).not.toContain(CALLER_PHONE);
  });
});
