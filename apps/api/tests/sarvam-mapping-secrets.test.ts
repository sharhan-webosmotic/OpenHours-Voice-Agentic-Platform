import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/common/passwords.js';
import { hashToken } from '../src/common/tokens.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { SARVAM_MAPPING_BODY, uniquePhone, uniqueSuffix } from './support/clinic-bodies.js';

/**
 * The two per-clinic Sarvam secrets, and the prompt version a clinic is marked with.
 *
 * THE SECRETS BREAK DIFFERENT THINGS, so each is replaced only when asked for. A new tool
 * secret stops the agent's tool calls until it is pasted into Sarvam, and a new webhook secret
 * stops call events arriving. Regenerating the tool secret used to replace the webhook secret
 * too, and a clinic mapped before the webhook secret existed could only get one by
 * regenerating the tool secret.
 *
 * THE PROMPT VERSION IS A RECORD OF WHAT WAS PASTED (D-014), so a clinic that has had nothing
 * pasted must not have one, and readiness must say so.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let token: string;

beforeAll(async () => {
  const email = `secrets.${uniqueSuffix()}@test.invalid`;
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), (tx) =>
    tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: null,
        email,
        passwordHash,
        fullName: 'Secrets Super',
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

type Saved = { readonly toolSecret?: string; readonly webhookSecret?: string };

const createClinic = async (): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/organisations')
    .set('Authorization', `Bearer ${token}`)
    .send({
      name: `Secrets ${uniqueSuffix()}`,
      timezone: 'Asia/Kolkata',
      clinicPhone: uniquePhone(),
    });
  return jsonBody<{ organisationId: string }>(response).organisationId;
};

const save = async (organisationId: string, flags: object = {}): Promise<Saved> => {
  const response = await request(app)
    .put(`/api/v1/organisations/${organisationId}/sarvam-mapping`)
    .set('Authorization', `Bearer ${token}`)
    .send({ mapping: SARVAM_MAPPING_BODY, ...flags });
  expect(response.status).toBe(200);
  return jsonBody<Saved>(response);
};

const storedHashes = (organisationId: string) =>
  asPlatform(ownerClient(), async (tx) => {
    const agent = await tx.voiceAgent.findFirstOrThrow({
      where: { organisationId },
      select: { toolSecretHash: true, webhookSecretHash: true },
    });
    return agent;
  });

describe('each secret is replaced only when asked for', () => {
  it('mints both on the first save, and neither on the next', async () => {
    const organisationId = await createClinic();

    const first = await save(organisationId);
    expect(Object.keys(first).sort()).toEqual(['toolSecret', 'webhookSecret']);

    expect(await save(organisationId)).toEqual({});
  });

  it('regenerating the tool secret leaves the webhook secret exactly as it was', async () => {
    const organisationId = await createClinic();
    const first = await save(organisationId);

    const regenerated = await save(organisationId, { regenerateToolSecret: true });

    expect(Object.keys(regenerated)).toEqual(['toolSecret']);
    expect(await storedHashes(organisationId)).toEqual({
      toolSecretHash: hashToken(regenerated.toolSecret ?? ''),
      webhookSecretHash: hashToken(first.webhookSecret ?? ''),
    });
  });

  it('regenerating the webhook secret leaves the tool secret exactly as it was', async () => {
    const organisationId = await createClinic();
    const first = await save(organisationId);

    const regenerated = await save(organisationId, { regenerateWebhookSecret: true });

    expect(Object.keys(regenerated)).toEqual(['webhookSecret']);
    expect(await storedHashes(organisationId)).toEqual({
      toolSecretHash: hashToken(first.toolSecret ?? ''),
      webhookSecretHash: hashToken(regenerated.webhookSecret ?? ''),
    });
  });

  it('gives a clinic mapped before webhook secrets existed one, without touching its tool secret', async () => {
    const organisationId = await createClinic();
    const first = await save(organisationId);

    // The state of a clinic whose mapping was saved before the webhook secret was introduced.
    await asPlatform(ownerClient(), (tx) =>
      tx.voiceAgent.updateMany({
        where: { organisationId },
        data: { webhookSecretHash: null, webhookSecretSetAt: null },
      }),
    );

    const ordinary = await save(organisationId);

    expect(Object.keys(ordinary)).toEqual(['webhookSecret']);
    expect(await storedHashes(organisationId)).toEqual({
      toolSecretHash: hashToken(first.toolSecret ?? ''),
      webhookSecretHash: hashToken(ordinary.webhookSecret ?? ''),
    });
  });

  it('audits which secrets were issued, and never either value', async () => {
    const organisationId = await createClinic();
    const first = await save(organisationId);
    const regenerated = await save(organisationId, { regenerateWebhookSecret: true });

    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findMany({
        where: { organisationId, action: 'phone_voice_mapping.updated' },
        orderBy: { id: 'asc' },
        select: { metadata: true },
      }),
    );

    expect(rows.map((row) => row.metadata)).toEqual([
      expect.objectContaining({
        toolSecretIssued: true,
        toolSecretRegenerated: false,
        webhookSecretIssued: true,
        webhookSecretRegenerated: false,
      }),
      expect.objectContaining({
        toolSecretIssued: false,
        toolSecretRegenerated: false,
        webhookSecretIssued: true,
        webhookSecretRegenerated: true,
      }),
    ]);

    const trail = JSON.stringify(rows);
    for (const secret of [first.toolSecret, first.webhookSecret, regenerated.webhookSecret]) {
      expect(secret).toBeDefined();
      expect(trail).not.toContain(secret ?? 'missing');
      expect(trail).not.toContain(hashToken(secret ?? 'missing'));
    }
  });
});

describe('the prompt version a clinic is marked with', () => {
  it('is not recorded at create, and readiness says it is still missing', async () => {
    const organisationId = await createClinic();

    const detail = jsonBody<{
      sarvamMapping: { promptVersion: string | null } | null;
      readiness: { missing: readonly { key: string }[] };
    }>(
      await request(app)
        .get(`/api/v1/organisations/${organisationId}`)
        .set('Authorization', `Bearer ${token}`),
    );

    expect(detail.sarvamMapping?.promptVersion ?? null).toBeNull();
    expect(detail.readiness.missing.map((row) => row.key)).toContain('sarvamMapping.promptVersion');
  });

  it('is satisfied once an operator records what was pasted', async () => {
    const organisationId = await createClinic();
    await save(organisationId);

    const detail = jsonBody<{ readiness: { missing: readonly { key: string }[] } }>(
      await request(app)
        .get(`/api/v1/organisations/${organisationId}`)
        .set('Authorization', `Bearer ${token}`),
    );

    expect(detail.readiness.missing.map((row) => row.key)).not.toContain(
      'sarvamMapping.promptVersion',
    );
  });
});
