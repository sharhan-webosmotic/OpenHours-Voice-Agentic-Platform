import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { PASSWORD_CHANGE_REQUIRED_TYPE } from '../src/common/errors.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { CSRF_HEADER } from '../src/common/csrf.js';
import { getRegisteredRoutes, type RouteDescriptor } from '../src/common/route-registry.js';
import { jsonBody, problemBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * A user holding an administrator-issued temporary password reaches nothing but the
 * endpoints needed to replace it.
 *
 * D-003: there is no email provider, so a new user is created with a one-time password
 * handed over out of band and `mustChangePassword` set. Before this, the flag was read
 * from the database, returned in three response payloads, and enforced by nothing: a user
 * who ignored the prompt kept a password someone else had chosen, and possibly still
 * remembered, as a fully working credential.
 *
 * THE REGISTRY WALK IS THE POINT. Asserting the gate on the three routes that exist today
 * would pass for ever while new routes quietly skipped it. Instead every registered route
 * is checked, and a new one must either be driven here or be listed as exempt with a
 * reason. That is the same shape as `declared-permissions-are-enforced.test.ts` and
 * `phi-routes-are-audited.test.ts`.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let org: OrganisationGraph;
let gatedEmail: string;
let clearedEmail: string;

/**
 * Routes a gated user must still reach, each with the reason it is exempt.
 *
 * Adding to this list is a deliberate decision about what a user with a temporary
 * password may do, which is why each entry carries its reasoning.
 */
const EXEMPT = new Map<string, string>([
  ['GET /api/v1/auth/me', 'how the client discovers the state it has to resolve'],
  ['POST /api/v1/auth/change-password', 'the way out of the state'],
  ['POST /api/v1/auth/login', 'no access token is presented, so the gate cannot apply'],
  ['POST /api/v1/auth/refresh', 'authenticates from the cookie, not an access token'],
  ['POST /api/v1/auth/logout', 'signing out must always be possible'],
  [
    'GET /api/v1/forwarding/schedules',
    'authenticates a paired DEVICE, which has no user and no password',
  ],
  [
    'POST /api/v1/devices/pair',
    'exchanges a pairing code for a device token, before any user session exists',
  ],
]);

/** Drives one route as the holder of `token`, returning the status. */
const RECIPES = new Map<string, (token: string) => Promise<number>>([
  [
    'GET /api/v1/audit-logs',
    async (token) =>
      (await request(app).get('/api/v1/audit-logs').set('Authorization', `Bearer ${token}`)).status,
  ],
  [
    'POST /api/v1/devices/pairing-codes',
    async (token) =>
      (
        await request(app)
          .post('/api/v1/devices/pairing-codes')
          .set('Authorization', `Bearer ${token}`)
      ).status,
  ],
  [
    'POST /api/v1/support-sessions',
    async (token) =>
      (
        await request(app)
          .post('/api/v1/support-sessions')
          .set('Authorization', `Bearer ${token}`)
          .send({ organisationId: org.organisationId, reason: 'checking a booking problem' })
      ).status,
  ],
]);

const keyOf = (route: RouteDescriptor): string => `${route.method.toUpperCase()} ${route.path}`;

const createUser = async (
  label: string,
  mustChangePassword: boolean,
  role: 'CLINIC_OWNER' | 'SUPER_ADMIN',
): Promise<string> => {
  const email = `gate.${label}.${Date.now()}@test.invalid`;
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), (tx) =>
    tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: role === 'SUPER_ADMIN' ? null : org.organisationId,
        email,
        passwordHash,
        fullName: `Gate ${label}`,
        role,
        status: 'ACTIVE',
        mustChangePassword,
      },
    }),
  );

  return email;
};

const tokenFor = async (email: string): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });

  expect(response.status).toBe(200);
  return jsonBody<{ accessToken: string }>(response).accessToken;
};

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'PasswordGate');
  });

  // SUPER_ADMIN, because it is the only role the matrix grants every route driven here.
  // A gated CLINIC_OWNER would be refused by the permission check on some of them, and a
  // 403 for the wrong reason would make this suite pass without proving anything.
  gatedEmail = await createUser('gated', true, 'SUPER_ADMIN');
  clearedEmail = await createUser('cleared', false, 'SUPER_ADMIN');
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

describe('every authenticated route is gated until the temporary password is changed', () => {
  const routes = getRegisteredRoutes();

  it('accounts for every registered route, as a recipe or as an exemption', () => {
    const unaccounted = routes.map(keyOf).filter((key) => !RECIPES.has(key) && !EXEMPT.has(key));

    /**
     * If this fails, a route was added without deciding whether a user holding a
     * temporary password may call it. Add a recipe that drives it with a bearer token, or
     * an EXEMPT entry saying why it does not need the gate. Do not delete the route from
     * the registry to make this pass.
     */
    expect(unaccounted).toEqual([]);
  });

  it('refuses a gated user on every non-exempt route', async () => {
    const token = await tokenFor(gatedEmail);

    for (const [key, drive] of RECIPES) {
      expect(await drive(token), `${key} did not refuse a gated user`).toBe(403);
    }
  });

  it('answers with a type the client can act on, not a generic forbidden', async () => {
    const token = await tokenFor(gatedEmail);

    const response = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    // The client routes to the password-change screen off this type. A generic 403 would
    // be a dead end, which is why this is its own error class.
    expect(problemBody(response).type).toBe(PASSWORD_CHANGE_REQUIRED_TYPE);
    expect(problemBody(response).detail).toBe(
      'Please change your temporary password before continuing.',
    );
  });

  it('lets the same user through once the password is changed', async () => {
    const token = await tokenFor(gatedEmail);

    // The way out of the state, which must work while the gate is closed.
    const changed = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'a-replacement-password-long-enough' });

    expect(changed.status).toBe(204);

    // A fresh token, because changing the password revoked every session. The new one
    // carries pwd=false, which is what opens the gate.
    const after = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: gatedEmail, password: 'a-replacement-password-long-enough' });

    expect(after.status).toBe(200);
    expect(jsonBody<{ mustChangePassword: boolean }>(after).mustChangePassword).toBe(false);

    const response = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${jsonBody<{ accessToken: string }>(after).accessToken}`);

    expect(response.status).toBe(200);
  });

  it('does not gate a user who never had a temporary password', async () => {
    const token = await tokenFor(clearedEmail);

    expect(
      (await request(app).get('/api/v1/audit-logs').set('Authorization', `Bearer ${token}`)).status,
    ).toBe(200);
  });

  it('lets a gated user read /me and sign out', async () => {
    const email = await createUser('exempt', true, 'SUPER_ADMIN');
    const session = await request(app)
      .post('/api/v1/auth/login')
      .send({ email, password: PASSWORD });

    const token = jsonBody<{ accessToken: string }>(session).accessToken;

    // /me is how the client learns it must change the password at all.
    const me = await request(app).get('/api/v1/auth/me').set('Authorization', `Bearer ${token}`);
    expect(me.status).toBe(200);
    expect(jsonBody<{ mustChangePassword: boolean }>(me).mustChangePassword).toBe(true);

    expect((await request(app).post('/api/v1/auth/logout').set(CSRF_HEADER, '1')).status).toBe(204);
  });
});
