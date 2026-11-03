import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/common/passwords.js';
import { hashToken } from '../src/common/tokens.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { provisionClinic } from '../prisma/provision-clinic.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import {
  AGENT_PROFILE_BODY,
  BOOKING_POLICY_BODY,
  PROFILE_BODY,
  SARVAM_MAPPING_BODY,
  TELEPHONY_BODY,
  uniqueSuffix,
} from './support/clinic-bodies.js';

/**
 * A clinic that was not made by the console's create.
 *
 * The console's create writes an empty row for every one-row section and the Sarvam agent
 * row. `pnpm provision:clinic` and the seed write the organisation and its users and nothing
 * else, and that is the path the pilot clinic is created by. Before this was fixed, four
 * section saves answered 500 on such a clinic, and the Sarvam save answered 200 and showed both
 * secrets while storing neither, so the operator would have pasted credentials into Sarvam that
 * authenticated nothing.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let superAdminToken: string;

beforeAll(async () => {
  const email = `shellless.${uniqueSuffix()}@test.invalid`;
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), (tx) =>
    tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: null,
        email,
        passwordHash,
        fullName: 'Shellless Super',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    }),
  );

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  superAdminToken = jsonBody<{ accessToken: string }>(response).accessToken;
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const provisioned = async (): Promise<string> =>
  (await provisionClinic(ownerClient(), `Provisioned ${uniqueSuffix()}`, uniqueSuffix()))
    .organisationId;

const put = (organisationId: string, section: string, body: object) =>
  request(app)
    .put(`/api/v1/organisations/${organisationId}/${section}`)
    .set('Authorization', `Bearer ${superAdminToken}`)
    .send(body);

const shellRowCounts = (organisationId: string) =>
  asPlatform(ownerClient(), async (tx) => ({
    profiles: await tx.clinicProfile.count({ where: { organisationId } }),
    policies: await tx.clinicBookingPolicy.count({ where: { organisationId } }),
    agentProfiles: await tx.clinicAgentProfile.count({ where: { organisationId } }),
    telephony: await tx.clinicTelephony.count({ where: { organisationId } }),
    voiceAgents: await tx.voiceAgent.count({ where: { organisationId } }),
  }));

describe('a clinic made by pnpm provision:clinic', () => {
  it('starts with none of the rows the console create writes', async () => {
    const organisationId = await provisioned();

    expect(await shellRowCounts(organisationId)).toEqual({
      profiles: 0,
      policies: 0,
      agentProfiles: 0,
      telephony: 0,
      voiceAgents: 0,
    });
  });

  it('saves every one-row section, and saving again keeps one row each', async () => {
    const organisationId = await provisioned();

    for (const [section, body] of [
      ['profile', PROFILE_BODY],
      ['booking-policy', BOOKING_POLICY_BODY],
      ['agent-profile', AGENT_PROFILE_BODY],
      ['telephony', TELEPHONY_BODY],
    ] as const) {
      expect((await put(organisationId, section, body)).status).toBe(204);
      expect((await put(organisationId, section, body)).status).toBe(204);
    }

    const counts = await shellRowCounts(organisationId);
    expect(counts.profiles).toBe(1);
    expect(counts.policies).toBe(1);
    expect(counts.agentProfiles).toBe(1);
    expect(counts.telephony).toBe(1);

    const detail = await request(app)
      .get(`/api/v1/organisations/${organisationId}`)
      .set('Authorization', `Bearer ${superAdminToken}`);

    expect(jsonBody<{ profile: { city: string } }>(detail).profile.city).toBe(PROFILE_BODY.city);
  });

  it('stores the Sarvam secrets it shows, so the ones the operator copies actually work', async () => {
    const organisationId = await provisioned();

    const response = await put(organisationId, 'sarvam-mapping', {
      mapping: { ...SARVAM_MAPPING_BODY, sarvamAppId: `provisioned-${uniqueSuffix()}` },
    });

    expect(response.status).toBe(200);
    const shown = jsonBody<{ toolSecret?: string; webhookSecret?: string }>(response);
    expect(shown.toolSecret).toBeDefined();
    expect(shown.webhookSecret).toBeDefined();

    const stored = await asPlatform(ownerClient(), (tx) =>
      tx.voiceAgent.findMany({
        where: { organisationId },
        select: { toolSecretHash: true, webhookSecretHash: true },
      }),
    );

    expect(stored).toEqual([
      {
        toolSecretHash: hashToken(shown.toolSecret ?? ''),
        webhookSecretHash: hashToken(shown.webhookSecret ?? ''),
      },
    ]);
  });
});
