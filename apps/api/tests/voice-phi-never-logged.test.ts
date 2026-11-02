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
const { asPlatform, disconnectAll, mintToolSecret, ownerClient } = await import('./support/db.js');
const { createOrganisationGraph } = await import('./support/fixtures.js');
const { markHoursCollected, nextBookableLocal } = await import('./support/clinic-schedule.js');
const { uuidV7 } = await import('../src/common/uuid.js');

const PATIENT_NAME = 'Zephyrine Quillfeather';
const PATIENT_PHONE = '+919812399001';
const SPOKEN_NOTE = 'my knee has been swollen since Tuesday';

const app = createApp({ readiness: () => Promise.resolve() });

let organisationId: string;
let secret: string;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    const graph = await createOrganisationGraph(tx, 'VoicePhiLogs');
    organisationId = graph.organisationId;
    await markHoursCollected(tx, organisationId);
    secret = await mintToolSecret(tx, organisationId);
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
