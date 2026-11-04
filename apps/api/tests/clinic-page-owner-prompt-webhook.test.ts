import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword, verifyPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { DEFAULT_PROMPT_VERSION } from '../src/voice/prompts/registry.js';
import { jsonBody, problemBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { SARVAM_MAPPING_BODY, uniquePhone, uniqueSuffix } from './support/clinic-bodies.js';

/**
 * Three things the clinic page gained: creating the clinic's owner login, previewing the
 * master prompt, and showing whether the webhook secret exists.
 *
 * The owner login is the one that matters most. It carries a live credential, so what is
 * asserted is the D-003 arrangement end to end: the password is returned once and works, it is
 * stored only as an argon2 hash, the first sign-in must replace it, and no audit row, response
 * header or later read carries it.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let superAdminToken: string;
let superAdminId: string;
let internalAdminToken: string;

const login = async (
  role: 'SUPER_ADMIN' | 'INTERNAL_ADMIN' | 'CLINIC_OWNER',
  organisationId: string | null,
) => {
  const id = uuidV7();
  const email = `clinicpage.${role.toLowerCase()}.${uniqueSuffix()}@test.invalid`;
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), (tx) =>
    tx.user.create({
      data: {
        id,
        organisationId,
        email,
        passwordHash,
        fullName: `Page ${role}`,
        role,
        status: 'ACTIVE',
      },
    }),
  );

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  return { id, token: jsonBody<{ accessToken: string }>(response).accessToken };
};

const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  post: (path: string, body: object) =>
    request(app).post(path).set('Authorization', `Bearer ${token}`).send(body),
  put: (path: string, body: object) =>
    request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
});

const createClinic = async (): Promise<string> => {
  const response = await as(superAdminToken).post('/api/v1/organisations', {
    name: `Clinic Page ${uniqueSuffix()}`,
    timezone: 'Asia/Kolkata',
    clinicPhone: uniquePhone(),
  });
  return jsonBody<{ organisationId: string }>(response).organisationId;
};

const auditRows = (organisationId: string, action: string) =>
  asPlatform(ownerClient(), (tx) =>
    tx.auditLog.findMany({
      where: { organisationId, action },
      select: { actorUserId: true, entityId: true, metadata: true },
    }),
  );

beforeAll(async () => {
  const superAdmin = await login('SUPER_ADMIN', null);
  superAdminToken = superAdmin.token;
  superAdminId = superAdmin.id;
  internalAdminToken = (await login('INTERNAL_ADMIN', null)).token;
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

describe('creating a clinic owner', () => {
  type Created = {
    userId: string;
    email: string;
    fullName: string;
    temporaryPassword: string;
  };

  it('returns a temporary password once, which signs in and must be replaced', async () => {
    const organisationId = await createClinic();
    const email = `owner.${uniqueSuffix()}@test.invalid`;

    const response = await as(superAdminToken).post(
      `/api/v1/organisations/${organisationId}/owners`,
      { fullName: 'Asha Rao', email: email.toUpperCase() },
    );

    expect(response.status).toBe(201);
    // A live credential: nothing between here and the operator may keep a copy.
    expect(response.headers['cache-control']).toBe('no-store');

    const created = jsonBody<Created>(response);
    expect(created.email).toBe(email);
    // The same generator as provision:clinic: six groups of four from the readable alphabet.
    expect(created.temporaryPassword).toMatch(/^[A-HJ-NP-Z2-9]{4}(?:-[A-HJ-NP-Z2-9]{4}){5}$/);

    const signIn = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: created.temporaryPassword });

    expect(signIn.status).toBe(200);
    const session = jsonBody<{
      mustChangePassword: boolean;
      user: { role: string; organisationId: string };
    }>(signIn);
    expect(session.mustChangePassword).toBe(true);
    expect(session.user).toMatchObject({ role: 'CLINIC_OWNER', organisationId });
  });

  it('stores only an argon2 hash of the password', async () => {
    const organisationId = await createClinic();
    const created = jsonBody<Created>(
      await as(superAdminToken).post(`/api/v1/organisations/${organisationId}/owners`, {
        fullName: 'Hash Only',
        email: `hash.${uniqueSuffix()}@test.invalid`,
      }),
    );

    const row = await asPlatform(ownerClient(), (tx) =>
      tx.user.findUniqueOrThrow({ where: { id: created.userId }, select: { passwordHash: true } }),
    );

    expect(row.passwordHash).toMatch(/^\$argon2id\$v=19\$m=65536,p=4,t=3\$/);
    expect(row.passwordHash).not.toContain(created.temporaryPassword);
    expect(await verifyPassword(row.passwordHash, created.temporaryPassword)).toBe(true);
  });

  it('audits the creation with the actor and the new user, and never the password or email', async () => {
    const organisationId = await createClinic();
    const email = `audit.${uniqueSuffix()}@test.invalid`;
    const created = jsonBody<Created>(
      await as(superAdminToken).post(`/api/v1/organisations/${organisationId}/owners`, {
        fullName: 'Audit Owner',
        email,
      }),
    );

    const rows = await auditRows(organisationId, 'clinic_user.created');

    expect(rows).toEqual([
      {
        actorUserId: superAdminId,
        entityId: created.userId,
        metadata: { role: 'CLINIC_OWNER', mustChangePassword: true },
      },
    ]);
    const trail = JSON.stringify(rows);
    expect(trail).not.toContain(created.temporaryPassword);
    expect(trail).not.toContain(email);
  });

  it('refuses an email already in use, in any case, and creates nothing', async () => {
    const organisationId = await createClinic();
    const email = `taken.${uniqueSuffix()}@test.invalid`;
    const path = `/api/v1/organisations/${organisationId}/owners`;

    expect((await as(superAdminToken).post(path, { fullName: 'First', email })).status).toBe(201);

    const second = await as(superAdminToken).post(path, {
      fullName: 'Second',
      email: email.toUpperCase(),
    });

    expect(second.status).toBe(409);
    expect(problemBody(second).detail).toBe('An account with that email address already exists.');
    expect(
      await asPlatform(ownerClient(), (tx) => tx.user.count({ where: { organisationId } })),
    ).toBe(1);
  });

  it('lets an internal admin create one, as the matrix grants', async () => {
    const organisationId = await createClinic();

    const response = await as(internalAdminToken).post(
      `/api/v1/organisations/${organisationId}/owners`,
      { fullName: 'Internal Made', email: `internal.${uniqueSuffix()}@test.invalid` },
    );

    expect(response.status).toBe(201);
  });

  it("answers 404 to another clinic's owner, and creates nothing", async () => {
    const mine = await createClinic();
    const theirs = await createClinic();
    const owner = await login('CLINIC_OWNER', mine);

    const response = await as(owner.token).post(`/api/v1/organisations/${theirs}/owners`, {
      fullName: 'Intruder',
      email: `intruder.${uniqueSuffix()}@test.invalid`,
    });

    expect(response.status).toBe(404);
    expect(
      await asPlatform(ownerClient(), (tx) => tx.user.count({ where: { organisationId: theirs } })),
    ).toBe(0);
  });
});

describe('the prompt preview', () => {
  type Preview = {
    version: string;
    approved: boolean;
    versionRecorded: boolean;
    text: string;
    readiness: { ready: boolean; missing: readonly { key: string }[] };
  };

  it('renders the default version for a clinic with none recorded, and says what is missing', async () => {
    const organisationId = await createClinic();

    const response = await as(superAdminToken).get(
      `/api/v1/organisations/${organisationId}/prompt-preview`,
    );

    expect(response.status).toBe(200);
    expect(response.headers['cache-control']).toBe('no-store');

    const preview = jsonBody<Preview>(response);
    expect(preview).toMatchObject({
      version: DEFAULT_PROMPT_VERSION,
      approved: false,
      versionRecorded: false,
    });
    expect(preview.text).toContain(
      'You are the receptionist answering the telephone for Clinic Page',
    );
    expect(preview.readiness.ready).toBe(false);
    expect(preview.readiness.missing.map((row) => row.key)).toContain('hours.collected');
  });

  it('changes nothing, not even the recorded version, and is audited by version only', async () => {
    const organisationId = await createClinic();

    await as(superAdminToken).get(`/api/v1/organisations/${organisationId}/prompt-preview`);

    const agent = await asPlatform(ownerClient(), (tx) =>
      tx.voiceAgent.findFirstOrThrow({
        where: { organisationId },
        select: { promptVersion: true },
      }),
    );
    expect(agent.promptVersion).toBeNull();

    expect(await auditRows(organisationId, 'organisation.prompt_previewed')).toEqual([
      {
        actorUserId: superAdminId,
        entityId: organisationId,
        metadata: { version: DEFAULT_PROMPT_VERSION, approved: false },
      },
    ]);
  });

  it('reports the version once one is recorded', async () => {
    const organisationId = await createClinic();
    await as(superAdminToken).put(`/api/v1/organisations/${organisationId}/sarvam-mapping`, {
      mapping: SARVAM_MAPPING_BODY,
    });

    const preview = jsonBody<Preview>(
      await as(superAdminToken).get(`/api/v1/organisations/${organisationId}/prompt-preview`),
    );

    expect(preview.versionRecorded).toBe(true);
  });

  it("answers 404 to another clinic's owner", async () => {
    const mine = await createClinic();
    const theirs = await createClinic();
    const owner = await login('CLINIC_OWNER', mine);

    expect(
      (await as(owner.token).get(`/api/v1/organisations/${theirs}/prompt-preview`)).status,
    ).toBe(404);
  });
});

describe('the webhook secret on the clinic page', () => {
  type Detail = {
    sarvamMapping: {
      toolSecretSet: boolean;
      webhookSecretSet: boolean;
      webhookSecretSetAt: string | null;
    } | null;
  };

  const detail = async (organisationId: string) => {
    const response = await as(superAdminToken).get(`/api/v1/organisations/${organisationId}`);
    return { body: jsonBody<Detail>(response), raw: JSON.stringify(response.body) };
  };

  it('says whether it is set and when, and never what it is', async () => {
    const organisationId = await createClinic();

    expect((await detail(organisationId)).body.sarvamMapping).toMatchObject({
      webhookSecretSet: false,
      webhookSecretSetAt: null,
    });

    const saved = jsonBody<{ webhookSecret: string }>(
      await as(superAdminToken).put(`/api/v1/organisations/${organisationId}/sarvam-mapping`, {
        mapping: SARVAM_MAPPING_BODY,
      }),
    );
    const after = await detail(organisationId);

    expect(after.body.sarvamMapping?.webhookSecretSet).toBe(true);
    expect(after.body.sarvamMapping?.webhookSecretSetAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(after.raw).not.toContain(saved.webhookSecret);
    expect(after.raw).not.toMatch(/hash/i);
  });

  it('audits opening the clinic page, by id only', async () => {
    const organisationId = await createClinic();

    await detail(organisationId);

    expect(await auditRows(organisationId, 'organisation.viewed')).toEqual([
      { actorUserId: superAdminId, entityId: organisationId, metadata: {} },
    ]);
  });
});
