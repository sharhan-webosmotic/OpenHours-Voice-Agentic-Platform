import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody, problemBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import {
  PROFILE_BODY,
  SARVAM_MAPPING_BODY,
  uniquePhone,
  uniqueSuffix,
} from './support/clinic-bodies.js';

/**
 * Saves that collide with something that already exists.
 *
 * Each of these used to fail badly: a rename onto an existing name answered 500, the create
 * refusal named the phone number when the clash was the name, and saving the clinic's own
 * number as the agent number silently deleted the clinic line. The expected answers come from
 * what an operator needs to read, not from what the code happened to say.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let token: string;

beforeAll(async () => {
  const email = `conflicts.${uniqueSuffix()}@test.invalid`;
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), (tx) =>
    tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: null,
        email,
        passwordHash,
        fullName: 'Conflicts Super',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    }),
  );

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  token = jsonBody<{ accessToken: string }>(response).accessToken;
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const send = (method: 'post' | 'put' | 'patch' | 'get', path: string, body?: object) =>
  request(app)
    [method](`/api/v1/organisations${path}`)
    .set('Authorization', `Bearer ${token}`)
    .send(body);

const createClinic = async (name: string, clinicPhone = uniquePhone()): Promise<string> => {
  const response = await send('post', '', { name, timezone: 'Asia/Kolkata', clinicPhone });
  expect(response.status).toBe(201);
  return jsonBody<{ organisationId: string }>(response).organisationId;
};

const detail = async (organisationId: string) =>
  jsonBody<{
    organisation: { name: string; clinicPhone: string | null };
    sarvamMapping: { agentPhone: string | null } | null;
    services: readonly { id: string; name: string }[];
  }>(await send('get', `/${organisationId}`));

describe('duplicate names', () => {
  it('refuses a duplicate clinic name with a 409 that names the name, not the phone', async () => {
    const name = `Conflict Clinic ${uniqueSuffix()}`;
    await createClinic(name);

    const response = await send('post', '', {
      name,
      timezone: 'Asia/Kolkata',
      clinicPhone: uniquePhone(),
    });

    expect(response.status).toBe(409);
    expect(problemBody(response).detail).toMatch(/with that name already exists/);
    expect(problemBody(response).detail).not.toMatch(/phone/i);
  });

  it('answers 409, not 500, when a clinic is renamed to another clinic’s name', async () => {
    const taken = `Taken Name ${uniqueSuffix()}`;
    await createClinic(taken);
    const other = await createClinic(`Other Name ${uniqueSuffix()}`);

    const response = await send('patch', `/${other}`, { name: taken.toUpperCase() });

    expect(response.status).toBe(409);
    expect(problemBody(response).detail).toMatch(/with that name already exists/);
    expect((await detail(other)).organisation.name).not.toBe(taken.toUpperCase());
  });

  it('answers 409, not 500, when a service is renamed to a sibling’s name', async () => {
    const organisationId = await createClinic(`Service Clash ${uniqueSuffix()}`);
    const service = { durationMinutes: 30, priceMinor: 50_000, active: true };

    expect(
      (await send('post', `/${organisationId}/services`, { ...service, name: 'Cleaning' })).status,
    ).toBe(201);
    const filling = await send('post', `/${organisationId}/services`, {
      ...service,
      name: 'Filling',
    });
    const { serviceId } = jsonBody<{ serviceId: string }>(filling);

    const response = await send('patch', `/${organisationId}/services/${serviceId}`, {
      name: 'Cleaning',
    });

    expect(response.status).toBe(409);
    expect(problemBody(response).detail).toBe(
      'A service with that name already exists at this clinic.',
    );
    expect((await detail(organisationId)).services.map((row) => row.name).sort()).toEqual([
      'Cleaning',
      'Filling',
    ]);
  });
});

describe("the agent number and the clinic's own line", () => {
  it('refuses an agent number equal to the clinic line, and keeps the clinic line', async () => {
    const clinicPhone = uniquePhone();
    const organisationId = await createClinic(`Same Number ${uniqueSuffix()}`, clinicPhone);

    const response = await send('put', `/${organisationId}/sarvam-mapping`, {
      mapping: { ...SARVAM_MAPPING_BODY, agentPhone: clinicPhone },
    });

    expect(response.status).toBe(409);
    expect(problemBody(response).detail).toMatch(/must be different/);

    const after = await detail(organisationId);
    expect(after.organisation.clinicPhone).toBe(clinicPhone);
    expect(after.sarvamMapping?.agentPhone).toBeNull();
  });

  it('refuses the same number for both in one save', async () => {
    const organisationId = await createClinic(`Both At Once ${uniqueSuffix()}`);
    const number = uniquePhone();

    const response = await send('put', `/${organisationId}/sarvam-mapping`, {
      mapping: { ...SARVAM_MAPPING_BODY, agentPhone: number, clinicPhone: number },
    });

    expect(response.status).toBe(409);
  });

  it('refuses a clinic line equal to the existing agent number, from either form', async () => {
    const organisationId = await createClinic(`Reverse Number ${uniqueSuffix()}`);
    const agentPhone = uniquePhone();

    expect(
      (
        await send('put', `/${organisationId}/sarvam-mapping`, {
          mapping: { ...SARVAM_MAPPING_BODY, agentPhone },
        })
      ).status,
    ).toBe(200);

    const fromMapping = await send('put', `/${organisationId}/sarvam-mapping`, {
      mapping: { ...SARVAM_MAPPING_BODY, clinicPhone: agentPhone },
    });
    const fromProfile = await send('put', `/${organisationId}/profile`, {
      ...PROFILE_BODY,
      contactPhone: agentPhone,
    });

    expect(fromMapping.status).toBe(409);
    expect(fromProfile.status).toBe(409);
    expect((await detail(organisationId)).sarvamMapping?.agentPhone).toBe(agentPhone);
  });
});
