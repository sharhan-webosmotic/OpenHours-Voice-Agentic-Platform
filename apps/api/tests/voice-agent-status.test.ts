import { beforeAll, afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { SARVAM_MAPPING_BODY, uniquePhone, uniqueSuffix } from './support/clinic-bodies.js';

/**
 * The AI receptionist's state, for a clinic made the way a real one is made: through the
 * admin console.
 *
 * WHY THROUGH THE CONSOLE. The first version of this check passed its tests against a fixture
 * with no agent row at all. The console always creates one, switched on and otherwise empty,
 * and for that shape the old check said "Live". So every assertion here starts from
 * `POST /api/v1/organisations` and reads `GET /api/v1/organisations/:id`, the endpoint every
 * screen takes the state from.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });
const base = '/api/v1/organisations';

let token: string;

type AgentStatus = { state: string; missing: readonly string[] };

const as = () => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string) => request(app).post(path).set('Authorization', `Bearer ${token}`),
  put: (path: string) => request(app).put(path).set('Authorization', `Bearer ${token}`),
});

const consoleClinic = async (): Promise<string> => {
  const created = await as()
    .post(base)
    .send({
      name: `Agent Status ${uniqueSuffix()}`,
      timezone: 'Asia/Kolkata',
      clinicPhone: uniquePhone(),
    });
  expect(created.status).toBe(201);
  return jsonBody<{ organisationId: string }>(created).organisationId;
};

const statusOf = async (organisationId: string): Promise<AgentStatus> => {
  const response = await as().get(`${base}/${organisationId}`);
  expect(response.status).toBe(200);
  return jsonBody<{ voiceAgent: AgentStatus }>(response).voiceAgent;
};

const map = async (organisationId: string, mapping: Record<string, unknown>) => {
  const response = await as()
    .put(`${base}/${organisationId}/sarvam-mapping`)
    .send({ mapping: { ...SARVAM_MAPPING_BODY, ...mapping } });
  expect(response.status).toBe(200);
};

beforeAll(async () => {
  const email = `agent.status.${uniqueSuffix()}@test.invalid`;

  await asPlatform(ownerClient(), async (tx) =>
    tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: null,
        email,
        passwordHash: await hashPassword(PASSWORD),
        fullName: 'Agent Status Super',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    }),
  );

  const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  expect(login.status).toBe(200);
  token = jsonBody<{ accessToken: string }>(login).accessToken;
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

describe('the AI receptionist state', () => {
  it('is NOT live for a clinic straight out of the console', async () => {
    const organisationId = await consoleClinic();

    // The agent row exists and is switched on: exactly the shape the old check called Live.
    expect(await statusOf(organisationId)).toEqual({
      state: 'NOT_CONFIGURED',
      missing: ['SARVAM_APP', 'SARVAM_DEPLOYMENT', 'AGENT_NUMBER', 'TOOL_SECRET', 'WEBHOOK_SECRET'],
    });
  }, 120_000);

  it('is not live while secrets exist but the agent was never configured', async () => {
    const organisationId = await consoleClinic();

    // The first mapping save mints both secrets, with no app, deployment or number given.
    await map(organisationId, { sarvamAppId: null, sarvamDeploymentId: null, agentPhone: null });

    expect(await statusOf(organisationId)).toEqual({
      state: 'PARTLY_CONFIGURED',
      missing: ['SARVAM_APP', 'SARVAM_DEPLOYMENT', 'AGENT_NUMBER'],
    });
  }, 120_000);

  it('names the one part still missing, then goes live when it is added', async () => {
    const organisationId = await consoleClinic();

    await map(organisationId, { sarvamAppId: `app-${uniqueSuffix()}`, agentPhone: null });
    expect(await statusOf(organisationId)).toEqual({
      state: 'PARTLY_CONFIGURED',
      missing: ['AGENT_NUMBER'],
    });

    await map(organisationId, { sarvamAppId: `app-${uniqueSuffix()}`, agentPhone: uniquePhone() });
    expect(await statusOf(organisationId)).toEqual({ state: 'LIVE', missing: [] });
  }, 120_000);

  it('is not live when fully configured but switched off', async () => {
    const organisationId = await consoleClinic();
    await map(organisationId, { sarvamAppId: `app-${uniqueSuffix()}`, agentPhone: uniquePhone() });

    await asPlatform(ownerClient(), (tx) =>
      tx.voiceAgent.updateMany({ where: { organisationId }, data: { status: 'SUSPENDED' } }),
    );

    expect(await statusOf(organisationId)).toEqual({
      state: 'PARTLY_CONFIGURED',
      missing: ['ACTIVE'],
    });
  }, 120_000);
});
