import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { jsonBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, mintWebhookSecret, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import { inboundCallFinished } from '../src/voice/providers/__fixtures__/inbound-call-finished.js';

/**
 * The webhook endpoint: the inbox, and the three measures that stand in for a signature.
 *
 * Sarvam documents no signing scheme (`docs/sarvam-contract.md` section 7), so what this
 * suite is really testing is whether the substitutes hold: a secret in the URL that resolves
 * the clinic, an address allow-list, and a payload that is never believed. The last one is
 * tested in the job's suite, because that is where the re-read happens.
 *
 * The route itself has one job and the tests follow it: store the body, answer quickly, and
 * never store it twice.
 */

const app = createApp({ readiness: () => Promise.resolve() });

let clinic: OrganisationGraph;
let other: OrganisationGraph;
let secret: string;
let otherSecret: string;

const post = (token: string, body: object) =>
  request(app).post(`/webhooks/sarvam/${token}`).send(body);

/** A fresh interaction id per call, since it is the deduplication key. */
const payload = (interactionId: string): object => ({
  ...inboundCallFinished,
  interaction_id: interactionId,
});

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    clinic = await createOrganisationGraph(tx, 'WebhookA');
    other = await createOrganisationGraph(tx, 'WebhookB');
    secret = await mintWebhookSecret(tx, clinic.organisationId);
    otherSecret = await mintWebhookSecret(tx, other.organisationId);
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const storedEvent = async (externalEventId: string) =>
  asPlatform(ownerClient(), (tx) =>
    tx.webhookEvent.findFirst({
      where: { externalEventId },
      select: { id: true, organisationId: true, status: true, payload: true, eventType: true },
    }),
  );

describe('the secret in the URL is what resolves the clinic', () => {
  it('stores the event against the clinic the secret belongs to', async () => {
    const id = `20261102/int_${Date.now()}`;
    const response = await post(secret, payload(id));

    expect(response.status).toBe(200);
    expect(jsonBody<{ received: boolean }>(response).received).toBe(true);

    const event = await storedEvent(id);
    /**
     * The clinic comes from the SECRET. The fixture's `metadata.clinic_id` is a zero uuid
     * belonging to nobody, and it is ignored: if the payload decided the tenant, anybody who
     * learned a webhook URL could file calls against any clinic.
     */
    expect(event?.organisationId).toBe(clinic.organisationId);
  });

  it('refuses a secret that belongs to nobody, with a 404 and no row', async () => {
    const response = await post('x'.repeat(43), payload('20261102/never-stored'));

    expect(response.status).toBe(404);
    expect(await storedEvent('20261102/never-stored')).toBeNull();
  });

  it('refuses a secret too short to be one, before hashing it', async () => {
    expect((await post('short', payload('20261102/also-never'))).status).toBe(404);
  });

  it('answers a deactivated clinic exactly as it answers an unknown secret', async () => {
    const suspended = await asPlatform(ownerClient(), async (tx) => {
      const graph = await createOrganisationGraph(tx, 'WebhookSuspended');
      const token = await mintWebhookSecret(tx, graph.organisationId);
      await tx.organisation.update({
        where: { id: graph.organisationId },
        data: { status: 'DEACTIVATED' },
      });
      return token;
    });

    const refused = await post(suspended, payload('20261102/deactivated'));
    const unknown = await post('y'.repeat(43), payload('20261102/unknown'));

    expect(refused.status).toBe(404);
    expect(refused.status).toBe(unknown.status);
    // A clinic that has been switched off does not have its calls recorded, which is the
    // consequence that matters rather than the status code.
    expect(await storedEvent('20261102/deactivated')).toBeNull();
  });

  it('files two clinics’ events separately, with the same payload', async () => {
    const mine = `20261102/shared_${Date.now()}_a`;
    const theirs = `20261102/shared_${Date.now()}_b`;

    await post(secret, payload(mine));
    await post(otherSecret, payload(theirs));

    expect((await storedEvent(mine))?.organisationId).toBe(clinic.organisationId);
    expect((await storedEvent(theirs))?.organisationId).toBe(other.organisationId);
  });
});

describe('a repeat delivery changes nothing', () => {
  it('stores once and answers 200 both times', async () => {
    const id = `20261102/repeat_${Date.now()}`;

    const first = await post(secret, payload(id));
    const second = await post(secret, payload(id));

    expect(first.status).toBe(200);
    expect(second.status).toBe(200);
    // The second is a success from the provider's point of view, which is what stops it
    // re-sending, and `received: false` is how our own monitoring can tell them apart.
    expect(jsonBody<{ received: boolean }>(first).received).toBe(true);
    expect(jsonBody<{ received: boolean }>(second).received).toBe(false);

    const count = await asPlatform(ownerClient(), (tx) =>
      tx.webhookEvent.count({ where: { externalEventId: id } }),
    );

    expect(count).toBe(1);
  });

  it('audits the first delivery and not the retries', async () => {
    const id = `20261102/audit_${Date.now()}`;

    await post(secret, payload(id));
    await post(secret, payload(id));
    await post(secret, payload(id));

    const event = await storedEvent(id);
    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.count({
        where: { action: 'call.webhook_received', entityId: event?.id ?? '' },
      }),
    );

    // Otherwise the trail would describe Sarvam's delivery behaviour rather than the
    // clinic's calls.
    expect(rows).toBe(1);
  });
});

/**
 * Validated on the way in (D-006 as amended on 2026-11-04). With no provider re-read in front
 * of it, the adapter's schema is all that stands between an unauthenticated body and the
 * database, so a body that fails it is answered 200 and stored nowhere.
 */
describe('a body that fails validation is refused, not stored', () => {
  const eventsFor = async (organisationId: string): Promise<number> =>
    asPlatform(ownerClient(), (tx) => tx.webhookEvent.count({ where: { organisationId } }));

  it.each([
    ['no interaction id', { something: 'that is not a sarvam webhook' }],
    ['an interaction id of the wrong type', { interaction_id: 12345 }],
    ['an interaction id with spaces in it', { interaction_id: '2026 1104 / x' }],
    ['an interaction id over its bound', { interaction_id: 'x'.repeat(201) }],
    [
      'a phone number over its bound',
      { interaction_id: 'ok/1', user_phone_number: '9'.repeat(33) },
    ],
    ['a negative duration', { interaction_id: 'ok/2', duration: -5 }],
    ['a duration longer than a day', { interaction_id: 'ok/3', duration: 90_000 }],
    ['a transcript that is not a list', { interaction_id: 'ok/4', interaction_transcript: 'hi' }],
    [
      'a transcript turn over its bound',
      {
        interaction_id: 'ok/5',
        interaction_transcript: [{ role: 'user', en_text: 'a'.repeat(20_001) }],
      },
    ],
    [
      'more transcript turns than any call has',
      {
        interaction_id: 'ok/6',
        interaction_transcript: Array.from({ length: 2_001 }, () => ({
          role: 'user',
          en_text: 'a',
        })),
      },
    ],
  ])('refuses %s with a 200 and stores nothing', async (_label, body) => {
    const before = await eventsFor(clinic.organisationId);

    const response = await post(secret, body);

    // 200 so Sarvam does not re-send something that will fail again; the body says so.
    expect(response.status).toBe(200);
    expect(jsonBody(response)).toEqual({ ok: false, received: false });
    expect(await eventsFor(clinic.organisationId)).toBe(before);
  });

  it('refuses a body the JSON parser cannot read the same way, and stores nothing', async () => {
    const before = await eventsFor(clinic.organisationId);

    const response = await request(app)
      .post(`/webhooks/sarvam/${secret}`)
      .set('Content-Type', 'application/json')
      .send('{"interaction_id":"20261104/cut","interaction_transcript":[{"en_text":"cut off');

    expect(response.status).toBe(200);
    expect(jsonBody(response)).toEqual({ ok: false, received: false });
    expect(await eventsFor(clinic.organisationId)).toBe(before);
  });

  it('accepts a long call whose transcript is over the general 100 kb body limit', async () => {
    const id = `20261104/long_${Date.now()}`;
    // About 300 kb of speech: a long conversation in two languages.
    const turns = Array.from({ length: 600 }, (_, index) => ({
      role: index % 2 === 0 ? 'assistant' : 'user',
      en_text: 'a sentence of ordinary speech, repeated. '.repeat(12),
    }));

    const response = await post(secret, { ...payload(id), interaction_transcript: turns });

    expect(response.status).toBe(200);
    expect(jsonBody<{ received: boolean }>(response).received).toBe(true);
    expect(await storedEvent(id)).not.toBeNull();
  });
});

describe('a valid body is kept as it arrived', () => {
  it('keeps the raw body byte for byte, which is what the adapter is checked against', async () => {
    const id = `20261102/raw_${Date.now()}`;
    const body = { ...payload(id), an_undocumented_field: { nested: [1, 2, 3] } };

    await post(secret, body);
    const event = await storedEvent(id);

    // After the pilot call this stored payload is the only evidence of what the provider
    // really sends, so the route must not normalise, trim or reshape it.
    expect(event?.payload).toMatchObject({ an_undocumented_field: { nested: [1, 2, 3] } });
  });
});
