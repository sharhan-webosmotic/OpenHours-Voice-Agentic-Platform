import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getRegisteredRoutes, type RouteDescriptor } from '../src/common/route-registry.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import {
  AGENT_PROFILE_BODY,
  BOOKING_POLICY_BODY,
  FAQS_BODY,
  HOURS_BODY,
  PROFILE_BODY,
  SARVAM_MAPPING_BODY,
  TELEPHONY_BODY,
  uniquePhone,
  uniqueSuffix,
} from './support/clinic-bodies.js';

/**
 * Every clinic configuration write must actually WRITE the audit row it declares.
 *
 * WHY THIS FILE EXISTS BESIDE `phi-routes-are-audited.test.ts`. That guard drives every
 * route flagged `phiSensitive`, and none of these routes is: clinic configuration is opening
 * hours, services, policies and a provider mapping, not patient data. But root CLAUDE.md
 * rule 5 covers sensitive writes, and a clinic's operating configuration plus the Sarvam
 * mapping that authenticates its agent qualify. So the routes declare an `auditAction`
 * without being PHI-flagged, and the existing guard deliberately does not require a recipe
 * for those. This one does.
 *
 * It is built the same way and for the same reason: the earlier version of the PHI guard
 * read the descriptor and asserted a non-empty string, which a route satisfied by declaring
 * an action and recording nothing. So this drives each route for real and asserts the row
 * appears, attributed to the actor who made the request.
 *
 * THE RECIPE TABLE IS THE PART THAT KEEPS IT HONEST. A new configuration route that declares
 * an audit action and has no recipe fails the first test below, which is the only moment
 * anyone is still thinking about its audit trail.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let superAdminToken: string;
let superAdminUserId: string;
let organisationId: string;
let serviceId: string;
let doctorId: string;

const base = '/api/v1/organisations';

const authed = {
  get: (path: string) => request(app).get(path).set('Authorization', `Bearer ${superAdminToken}`),
  post: (path: string) => request(app).post(path).set('Authorization', `Bearer ${superAdminToken}`),
  patch: (path: string) =>
    request(app).patch(path).set('Authorization', `Bearer ${superAdminToken}`),
  put: (path: string) => request(app).put(path).set('Authorization', `Bearer ${superAdminToken}`),
};

beforeAll(async () => {
  const email = `audited.config.${uniqueSuffix()}@test.invalid`;
  const passwordHash = await hashPassword(PASSWORD);
  superAdminUserId = uuidV7();

  await asPlatform(ownerClient(), (tx) =>
    tx.user.create({
      data: {
        id: superAdminUserId,
        organisationId: null,
        email,
        passwordHash,
        fullName: 'Audited Config Super',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    }),
  );

  const login = await request(app).post('/api/v1/auth/login').send({ email, password: PASSWORD });
  expect(login.status).toBe(200);
  superAdminToken = jsonBody<{ accessToken: string }>(login).accessToken;

  // A clinic of this file's own, plus a service and a doctor to update, so the recipes
  // below are driving rows nothing else is asserting on.
  const created = await authed.post(base).send({
    name: `Audited Clinic ${uniqueSuffix()}`,
    timezone: 'Asia/Kolkata',
    clinicPhone: uniquePhone(),
  });
  expect(created.status).toBe(201);
  organisationId = jsonBody<{ organisationId: string }>(created).organisationId;

  const service = await authed.post(`${base}/${organisationId}/services`).send({
    name: `Audited Service ${uniqueSuffix()}`,
    durationMinutes: 30,
    priceMinor: null,
    active: true,
  });
  serviceId = jsonBody<{ serviceId: string }>(service).serviceId;

  const doctor = await authed.post(`${base}/${organisationId}/doctors`).send({
    fullName: `Audited Doctor ${uniqueSuffix()}`,
    specialty: null,
    bufferMinutes: 0,
    active: true,
  });
  doctorId = jsonBody<{ doctorId: string }>(doctor).doctorId;
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const keyOf = (route: RouteDescriptor): string => `${route.method.toUpperCase()} ${route.path}`;

/** Audit rows for one action, attributed to one actor. Read as owner, past every policy. */
const auditRowCount = async (action: string, actorUserId: string): Promise<number> =>
  asPlatform(ownerClient(), (tx) => tx.auditLog.count({ where: { action, actorUserId } }));

/** How to drive each audited configuration route, keyed exactly as the registry names it. */
const RECIPES = new Map<string, () => Promise<number>>([
  [
    `POST ${base}`,
    async () =>
      (
        await authed.post(base).send({
          name: `Audit Probe ${uniqueSuffix()}`,
          timezone: 'Asia/Kolkata',
          clinicPhone: uniquePhone(),
        })
      ).status,
  ],
  [
    `PATCH ${base}/:organisationId`,
    async () =>
      (await authed.patch(`${base}/${organisationId}`).send({ timezone: 'Asia/Kolkata' })).status,
  ],
  [
    `PUT ${base}/:organisationId/profile`,
    async () => (await authed.put(`${base}/${organisationId}/profile`).send(PROFILE_BODY)).status,
  ],
  [
    `PUT ${base}/:organisationId/hours`,
    async () => (await authed.put(`${base}/${organisationId}/hours`).send(HOURS_BODY)).status,
  ],
  [
    `PUT ${base}/:organisationId/booking-policy`,
    async () =>
      (await authed.put(`${base}/${organisationId}/booking-policy`).send(BOOKING_POLICY_BODY))
        .status,
  ],
  [
    `PUT ${base}/:organisationId/agent-profile`,
    async () =>
      (await authed.put(`${base}/${organisationId}/agent-profile`).send(AGENT_PROFILE_BODY)).status,
  ],
  [
    `PUT ${base}/:organisationId/telephony`,
    async () =>
      (await authed.put(`${base}/${organisationId}/telephony`).send(TELEPHONY_BODY)).status,
  ],
  [
    `PUT ${base}/:organisationId/faqs`,
    async () => (await authed.put(`${base}/${organisationId}/faqs`).send(FAQS_BODY)).status,
  ],
  [
    `PUT ${base}/:organisationId/sarvam-mapping`,
    async () =>
      (
        await authed.put(`${base}/${organisationId}/sarvam-mapping`).send({
          mapping: { ...SARVAM_MAPPING_BODY, sarvamAppId: `app-${uniqueSuffix()}` },
        })
      ).status,
  ],
  [
    `POST ${base}/:organisationId/services`,
    async () =>
      (
        await authed.post(`${base}/${organisationId}/services`).send({
          name: `Audit Service ${uniqueSuffix()}`,
          durationMinutes: 30,
          priceMinor: null,
          active: true,
        })
      ).status,
  ],
  [
    `PATCH ${base}/:organisationId/services/:serviceId`,
    async () =>
      (await authed.patch(`${base}/${organisationId}/services/${serviceId}`).send({ active: true }))
        .status,
  ],
  [
    `POST ${base}/:organisationId/doctors`,
    async () =>
      (
        await authed.post(`${base}/${organisationId}/doctors`).send({
          fullName: `Audit Doctor ${uniqueSuffix()}`,
          specialty: null,
          bufferMinutes: 0,
          active: true,
        })
      ).status,
  ],
  [
    `PATCH ${base}/:organisationId/doctors/:doctorId`,
    async () =>
      (await authed.patch(`${base}/${organisationId}/doctors/${doctorId}`).send({ active: true }))
        .status,
  ],
]);

/** The configuration routes: those under /organisations that declare an audit action. */
const auditedConfigurationRoutes = (): readonly RouteDescriptor[] =>
  getRegisteredRoutes().filter(
    (route) => route.path.startsWith(base) && route.auditAction !== undefined,
  );

describe('every clinic configuration write is audited', () => {
  it('has a recipe for every audited configuration route', () => {
    const withoutRecipe = auditedConfigurationRoutes()
      .filter((route) => !RECIPES.has(keyOf(route)))
      .map(keyOf);

    // If this fails, add a recipe above that drives the new route. Do not remove the
    // route's `auditAction` to make it pass: that is how an unaudited write ships.
    expect(withoutRecipe).toEqual([]);
  });

  it('has no recipe for a route that no longer exists', () => {
    const registered = new Set(auditedConfigurationRoutes().map(keyOf));
    expect([...RECIPES.keys()].filter((key) => !registered.has(key))).toEqual([]);
  });

  it('found the configuration routes at all', () => {
    expect(auditedConfigurationRoutes().length).toBeGreaterThan(10);
  });

  for (const route of auditedConfigurationRoutes()) {
    const key = keyOf(route);

    it(`${key} writes its declared audit row when driven`, async () => {
      const drive = RECIPES.get(key);
      const action = route.auditAction;

      expect(drive).toBeDefined();
      expect(action).toBeDefined();

      if (drive === undefined || action === undefined) {
        return;
      }

      const before = await auditRowCount(action, superAdminUserId);
      const status = await drive();
      const after = await auditRowCount(action, superAdminUserId);

      expect(status).toBeLessThan(400);
      // Exactly one more, attributed to the actor who made the request. A route that
      // declares an action and records nothing fails here, which the descriptor check
      // above cannot see.
      expect(after).toBe(before + 1);
    }, 60_000);
  }

  it('records field names and counts, never the values', async () => {
    await authed.put(`${base}/${organisationId}/profile`).send({
      ...PROFILE_BODY,
      city: 'Averyunusualcityname',
      legalName: 'Averyunusuallegalname',
    });

    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findMany({
        where: { action: 'clinic_settings.profile.updated', actorUserId: superAdminUserId },
        orderBy: { id: 'desc' },
        take: 1,
      }),
    );

    const metadata = JSON.stringify(rows[0]?.metadata ?? {});

    // The NAMES of the fields that moved are recorded, because that is what makes the
    // trail useful to somebody investigating.
    expect(metadata).toContain('city');
    expect(metadata).toContain('legalName');
    // The values are not, because the trail is read by people who may have no right to
    // the data it describes.
    expect(metadata).not.toContain('Averyunusualcityname');
    expect(metadata).not.toContain('Averyunusuallegalname');
  });

  it('records that a tool secret was issued, and never the secret', async () => {
    const response = await authed.put(`${base}/${organisationId}/sarvam-mapping`).send({
      mapping: { ...SARVAM_MAPPING_BODY, sarvamAppId: `app-${uniqueSuffix()}` },
      regenerateToolSecret: true,
    });

    expect(response.status).toBe(200);
    const secret = jsonBody<{ toolSecret?: string }>(response).toolSecret;
    expect(secret).toBeDefined();

    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findMany({
        where: { action: 'phone_voice_mapping.updated', actorUserId: superAdminUserId },
        orderBy: { id: 'desc' },
        take: 1,
      }),
    );

    const metadata = JSON.stringify(rows[0]?.metadata ?? {});

    expect(metadata).toContain('toolSecretIssued');
    expect(metadata).toContain('toolSecretRegenerated');
    // The one thing that must never be in an audit row.
    expect(metadata).not.toContain(secret ?? 'no-secret-was-returned');
  });

  it('writes no audit row when the write is refused', async () => {
    const before = await auditRowCount('clinic_settings.telephony.updated', superAdminUserId);

    // Refused by the schema: a consent mode that plays a notice with no notice written.
    const response = await authed
      .put(`${base}/${organisationId}/telephony`)
      .send({ ...TELEPHONY_BODY, consentAnnouncement: null });

    expect(response.status).toBe(400);

    // The audit row is written inside the same transaction as the change, so a refused
    // write must leave no claim that something happened.
    expect(await auditRowCount('clinic_settings.telephony.updated', superAdminUserId)).toBe(before);
  });
});
