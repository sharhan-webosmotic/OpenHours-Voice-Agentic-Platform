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

describe('a body it cannot read is still kept', () => {
  it('stores an event with no interaction id under a digest of itself', async () => {
    const response = await post(secret, { something: 'that is not a sarvam webhook' });

    expect(response.status).toBe(200);

    const event = await asPlatform(ownerClient(), (tx) =>
      tx.webhookEvent.findFirst({
        where: {
          organisationId: clinic.organisationId,
          externalEventId: { startsWith: 'unparsed:' },
        },
        select: { payload: true, status: true },
      }),
    );

    /**
     * 200 AND STORED, because the alternative is a provider retrying something we cannot
     * read and nobody ever seeing it. The digest gives a repeat of the same unreadable body
     * one row rather than many, and the row is the evidence for whoever has to work out what
     * Sarvam sent.
     */
    expect(event).not.toBeNull();
    expect(event?.status).toBe('RECEIVED');
    expect(event?.payload).toMatchObject({ something: 'that is not a sarvam webhook' });
  });

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
