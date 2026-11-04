import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import express from 'express';
import request from 'supertest';
import { requestContextMiddleware } from '../src/common/request-context.middleware.js';
import { voiceToolsRouter } from '../src/voice/tools.routes.js';
import { asPlatform, disconnectAll, mintToolSecret, ownerClient } from './support/db.js';
import { createOrganisationGraph } from './support/fixtures.js';

/**
 * The rate limit is keyed on the CLINIC, not on the address.
 *
 * This is the one claim about the limiter that matters, and it is not a detail. Sarvam
 * places every call from a small set of fixed addresses, so an address-keyed bucket would
 * put every clinic on the platform into one bucket: one busy clinic would throttle the
 * agent for everybody, and the product would look like it was failing at random.
 *
 * ASSERTING THE KEY FUNCTION WOULD PROVE NOTHING, because the bug would be in which
 * limiter is mounted rather than in the function. So the limits are lowered to three and
 * the buckets are driven until one of them gives way, which is why they are configurable.
 *
 * The app here is assembled by hand rather than through `createApp`, because the mounted
 * router has to be built with the test's limits. It carries the two pieces the router
 * genuinely needs: a request context for the log and audit ids, and a JSON body parser.
 */

const CALLS = 3;

const app = express();
app.use(requestContextMiddleware);
app.use(express.json());
app.use(
  '/voice/tools',
  voiceToolsRouter({ callsPerMinutePerClinic: CALLS, callsPerMinutePerAddress: 10_000 }),
);

let secret: string;
let otherSecret: string;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    const one = await createOrganisationGraph(tx, 'VoiceLimitA');
    const two = await createOrganisationGraph(tx, 'VoiceLimitB');
    secret = await mintToolSecret(tx, one.organisationId);
    otherSecret = await mintToolSecret(tx, two.organisationId);
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const callInfo = (token: string) =>
  request(app)
    .post('/voice/tools/clinic-info')
    .set('Authorization', `Bearer ${token}`)
    .send({ topic: 'general' });

describe('the voice tool rate limit', () => {
  it('throttles one clinic without touching another', async () => {
    const statuses: number[] = [];

    for (let index = 0; index < CALLS + 1; index += 1) {
      statuses.push((await callInfo(secret)).status);
    }

    // The first three are served, the fourth is refused.
    expect(statuses.slice(0, CALLS)).toEqual(Array.from({ length: CALLS }, () => 200));
    expect(statuses.at(-1)).toBe(429);

    /**
     * THE ASSERTION THAT MATTERS. Same process, same address, same moment, different
     * clinic: served. With an address-keyed limiter this would be a 429, and the suite
     * would be green on a limiter that throttles the whole platform at once.
     */
    const neighbour = await callInfo(otherSecret);
    expect(neighbour.status).toBe(200);
  }, 60_000);

  it('refuses with a 429 rather than a spoken message, so the provider can back off', async () => {
    for (let index = 0; index < CALLS + 1; index += 1) {
      await callInfo(otherSecret);
    }

    const refused = await callInfo(otherSecret);

    // A 200 here would tell Sarvam everything is fine while the clinic is being throttled.
    expect(refused.status).toBe(429);
    expect(refused.body).toMatchObject({ ok: false });
  }, 60_000);
});
