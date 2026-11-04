import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import {
  FAQS_BODY,
  HOURS_BODY,
  SARVAM_MAPPING_BODY,
  uniqueSuffix,
} from './support/clinic-bodies.js';

/**
 * A platform role acting on ONE clinic is confined to that clinic by the client extension,
 * not by each repository function remembering its filter (D-017).
 *
 * Every request here is a super admin addressing clinic A in the URL while naming clinic B's
 * rows in the path or touching data B also has. A super admin may write to any clinic, so a
 * permission check cannot catch this: the only thing standing between "clinic A's URL" and
 * "clinic B's row" is the organisation the scope injects. Each case asserts both the answer
 * and that B's row is exactly as it was, because a write that answers 404 and still happens
 * is the failure that matters.
 *
 * The clinic-role half is here too: a clinic user naming another clinic in the URL gets 404,
 * the same as an id that does not exist, and never 401 or 403.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let clinicA: OrganisationGraph;
let clinicB: OrganisationGraph;
let superAdminToken: string;
let ownerAToken: string;

const login = async (role: 'SUPER_ADMIN' | 'CLINIC_OWNER', organisationId: string | null) => {
  const email = `confinement.${role.toLowerCase()}.${uniqueSuffix()}@test.invalid`;
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), (tx) =>
    tx.user.create({
      data: {
        id: uuidV7(),
        organisationId,
        email,
        passwordHash,
        fullName: `Confinement ${role}`,
        role,
        status: 'ACTIVE',
      },
    }),
  );

  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return jsonBody<{ accessToken: string }>(response).accessToken;
};

const as = (token: string) => ({
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${token}`),
  put: (path: string, body: object) =>
    request(app).put(path).set('Authorization', `Bearer ${token}`).send(body),
  patch: (path: string, body: object) =>
    request(app).patch(path).set('Authorization', `Bearer ${token}`).send(body),
});

const idOf = (graph: OrganisationGraph, table: string): string => {
  const id = graph.ids[table];
  if (id === undefined) {
    throw new Error(`the fixture holds no ${table} row`);
  }
  return id;
};

/** Clinic B as the owner sees it in the tables, read outside any scope under test. */
const snapshotOfB = async () =>
  asPlatform(ownerClient(), async (tx) => ({
    service: await tx.service.findUnique({ where: { id: idOf(clinicB, 'services') } }),
    doctor: await tx.doctor.findUnique({ where: { id: idOf(clinicB, 'doctors') } }),
    doctorHours: await tx.doctorWorkingHours.findMany({
      where: { organisationId: clinicB.organisationId },
      orderBy: { id: 'asc' },
    }),
    clinicHours: await tx.clinicHours.findMany({
      where: { organisationId: clinicB.organisationId },
      orderBy: { id: 'asc' },
    }),
    faqs: await tx.clinicFaq.findMany({
      where: { organisationId: clinicB.organisationId },
      orderBy: { id: 'asc' },
    }),
    voiceAgents: await tx.voiceAgent.findMany({
      where: { organisationId: clinicB.organisationId },
      orderBy: { id: 'asc' },
    }),
  }));

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    clinicA = await createOrganisationGraph(tx, 'ConfineA');
    clinicB = await createOrganisationGraph(tx, 'ConfineB');
  });

  superAdminToken = await login('SUPER_ADMIN', null);
  ownerAToken = await login('CLINIC_OWNER', clinicA.organisationId);
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

describe("a super admin on clinic A's URL cannot reach clinic B's rows", () => {
  it("answers 404 for clinic B's service and leaves it unchanged", async () => {
    const before = await snapshotOfB();

    const response = await as(superAdminToken).patch(
      `/api/v1/organisations/${clinicA.organisationId}/services/${idOf(clinicB, 'services')}`,
      { name: `Renamed through clinic A ${uniqueSuffix()}`, active: false },
    );

    expect(response.status).toBe(404);
    expect((await snapshotOfB()).service).toEqual(before.service);
  });

  it("answers 404 for clinic B's doctor and leaves them unchanged", async () => {
    const before = await snapshotOfB();

    const response = await as(superAdminToken).patch(
      `/api/v1/organisations/${clinicA.organisationId}/doctors/${idOf(clinicB, 'doctors')}`,
      { fullName: 'Renamed through clinic A', active: false },
    );

    expect(response.status).toBe(404);
    expect((await snapshotOfB()).doctor).toEqual(before.doctor);
  });

  it("answers 404 for clinic B's doctor's week, read or replaced, and leaves it unchanged", async () => {
    const before = await snapshotOfB();
    const path = `/api/v1/organisations/${clinicA.organisationId}/doctors/${idOf(clinicB, 'doctors')}/hours`;

    expect((await as(superAdminToken).get(path)).status).toBe(404);
    expect((await as(superAdminToken).put(path, HOURS_BODY)).status).toBe(404);
    expect((await snapshotOfB()).doctorHours).toEqual(before.doctorHours);
  });

  it("replaces clinic A's hours and answers without touching clinic B's", async () => {
    const before = await snapshotOfB();

    const response = await as(superAdminToken).put(
      `/api/v1/organisations/${clinicA.organisationId}/hours`,
      HOURS_BODY,
    );

    expect(response.status).toBe(204);
    expect((await snapshotOfB()).clinicHours).toEqual(before.clinicHours);
  });

  it("replaces clinic A's answers without touching clinic B's", async () => {
    const before = await snapshotOfB();

    const response = await as(superAdminToken).put(
      `/api/v1/organisations/${clinicA.organisationId}/faqs`,
      FAQS_BODY,
    );

    expect(response.status).toBe(204);
    expect((await snapshotOfB()).faqs).toEqual(before.faqs);
  });

  it("saves clinic A's Sarvam mapping without touching clinic B's agent", async () => {
    const before = await snapshotOfB();

    const response = await as(superAdminToken).put(
      `/api/v1/organisations/${clinicA.organisationId}/sarvam-mapping`,
      { mapping: { ...SARVAM_MAPPING_BODY, sarvamAppId: `confine-${uniqueSuffix()}` } },
    );

    expect(response.status).toBe(200);
    expect((await snapshotOfB()).voiceAgents).toEqual(before.voiceAgents);
  });
});

describe('a clinic user naming another clinic in the URL', () => {
  it('gets 404 for a read and for a write, never 401 or 403', async () => {
    const base = `/api/v1/organisations/${clinicB.organisationId}`;

    expect((await as(ownerAToken).get(base)).status).toBe(404);
    expect((await as(ownerAToken).put(`${base}/faqs`, FAQS_BODY)).status).toBe(404);
    expect(
      (await as(ownerAToken).get(`${base}/doctors/${idOf(clinicB, 'doctors')}/hours`)).status,
    ).toBe(404);
  });
});
