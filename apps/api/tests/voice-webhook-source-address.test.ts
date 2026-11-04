import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

/**
 * The webhook's address check, switched ON (D-006).
 *
 * With the URL secret this is now the whole control on the webhook: there is no provider
 * re-read before a call is created. Its own file, because config is read once at import and
 * every other suite runs with the check deliberately disabled.
 *
 * `TRUST_PROXY=1` and `X-Forwarded-For` stand in for the load balancer in front of the API in
 * production, which is how `req.ip` becomes the caller's address there.
 */
vi.hoisted(() => {
  process.env.SARVAM_WEBHOOK_SOURCE_IPS = '4.213.167.70,35.154.84.150';
  process.env.SARVAM_WEBHOOK_IP_CHECK_DISABLED = 'false';
  process.env.TRUST_PROXY = '1';
});

const { createApp } = await import('../src/app.js');
const { asPlatform, disconnectAll, mintWebhookSecret, ownerClient } =
  await import('./support/db.js');
const { createOrganisationGraph } = await import('./support/fixtures.js');
const { uuidV7 } = await import('../src/common/uuid.js');
const { problemBody } = await import('../src/test-support/http.js');
const { inboundCallFinished } =
  await import('../src/voice/providers/__fixtures__/inbound-call-finished.js');

const app = createApp({ readiness: () => Promise.resolve() });
let secret: string;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    const clinic = await createOrganisationGraph(tx, 'WebhookAddress');
    secret = await mintWebhookSecret(tx, clinic.organisationId);
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const deliver = (path: string, from?: string) => {
  const pending = request(app).post(`/webhooks/sarvam/${path}`);

  if (from !== undefined) {
    pending.set('X-Forwarded-For', from);
  }

  return pending.send({ ...inboundCallFinished, interaction_id: `20261104/${uuidV7()}` });
};

describe('the webhook with its address check on', () => {
  it('accepts the right secret from an allowed address', async () => {
    expect((await deliver(secret, '35.154.84.150')).status).toBe(200);
  });

  it('refuses the right secret from any other address, as if nothing were there', async () => {
    const elsewhere = await deliver(secret, '203.0.113.9');
    const wrongSecret = await deliver('w'.repeat(43), '4.213.167.70');

    expect(elsewhere.status).toBe(404);
    // Indistinguishable from a wrong secret, so an outsider learns nothing from the answer.
    expect(problemBody(elsewhere).detail).toBe(problemBody(wrongSecret).detail);
  });

  it('refuses a request with no forwarded address, which is not how Sarvam arrives', async () => {
    expect((await deliver(secret)).status).toBe(404);
  });
});
