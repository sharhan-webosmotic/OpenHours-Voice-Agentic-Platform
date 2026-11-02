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
 * The four routes a gated user must still reach, each with the reason it is exempt.
 *
 * Exactly four, and the list is meant to stay that way. Adding to it is a decision about
 * what a password someone else chose, and may still remember, is allowed to do, so every
 * entry carries its reasoning. Three of these are the way into and out of the state. The
 * fourth is how the client discovers it is in the state at all.
 */
const EXEMPT = new Map<string, string>([
  ['GET /api/v1/auth/me', 'how the client discovers the state it has to resolve'],
  ['POST /api/v1/auth/change-password', 'the way out of the state'],
  ['POST /api/v1/auth/refresh', 'authenticates from the cookie, not an access token'],
  ['POST /api/v1/auth/logout', 'signing out must always be possible'],
]);

/**
 * Routes no user access token authenticates at all, each driven to prove it.
 *
 * These are NOT exemptions, and keeping them out of EXEMPT is the point. An exemption
 * says a gated user may call the route. These say a user access token is not a credential
 * here, gated or not, so there is no gate to apply and nothing a temporary password could
 * unlock. Each is driven below with a gated user's token, which is a stronger claim than
 * a comment: mounting `requireAuth` on one of them later would turn its refusal into a
 * success and fail this suite.
 *
 * DEVICE PAIRING deserves the explicit statement, because issuing a device token is
 * privileged and a temporary password may have been read off a screen or forwarded. Both
 * halves of that chain are closed. `POST /devices/pairing-codes`, which mints a code, is
 * in RECIPES above and refuses a gated user with the gate. `POST /devices/pair` only
 * redeems a code, which a gated user therefore cannot obtain, and it ignores an
 * `Authorization` header entirely.
 */
const NO_USER_SESSION = new Map<
  string,
  { readonly reason: string; readonly prove: (token: string, email: string) => Promise<void> }
>([
  [
    'POST /api/v1/auth/login',
    {
      reason: 'the credential exchange itself: no access token is presented',
      prove: async (token, email) => {
        // Presenting a gated token alongside valid credentials cannot launder it. The
        // header is ignored, and the session issued is still a gated one.
        const response = await request(app)
          .post('/api/v1/auth/login')
          .set('Authorization', `Bearer ${token}`)
          .send({ email, password: PASSWORD });

        expect(response.status).toBe(200);
        expect(jsonBody<{ mustChangePassword: boolean }>(response).mustChangePassword).toBe(true);
      },
    },
  ],
  [
    'POST /api/v1/devices/pair',
    {
      reason: 'redeems a code a gated user cannot obtain, and ignores an Authorization header',
      prove: async (token) => {
        const response = await request(app)
          .post('/api/v1/devices/pair')
          .set('Authorization', `Bearer ${token}`)
          .send({ code: 'ZZZZZZ', label: 'Reception phone' });

        // Refused on the code, not authenticated by the token.
        expect(response.status).toBe(401);
      },
    },
  ],
  [
    'GET /api/v1/forwarding/schedules',
    {
      reason: 'authenticates a paired device, which has no user and no password',
      prove: async (token) => {
        // `requireDevice` wants `x-device-token`, and a JWT is not one, so a user access
        // token is not a credential on this route at all.
        const response = await request(app)
          .get('/api/v1/forwarding/schedules')
          .set('Authorization', `Bearer ${token}`);

        expect(response.status).toBe(401);
      },
    },
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

  it('accounts for every registered route', () => {
    const unaccounted = routes
      .map(keyOf)
      .filter((key) => !RECIPES.has(key) && !EXEMPT.has(key) && !NO_USER_SESSION.has(key));

    /**
     * If this fails, a route was added without deciding whether a user holding a
     * temporary password may call it. Add a RECIPES entry that drives it with a bearer
     * token and expects a refusal, a NO_USER_SESSION entry that proves a user access
     * token is not a credential there, or, if a gated user genuinely must reach it, an
     * EXEMPT entry with the reason. Do not delete the route from the registry to make
     * this pass.
     */
    expect(unaccounted).toEqual([]);
  });

  it('exempts only the four routes needed to leave the state', () => {
    /**
     * The count is asserted, not just the contents, so widening the list is a visible
     * decision rather than one line added to a map during an unrelated change.
     */
    expect([...EXEMPT.keys()].sort()).toEqual([
      'GET /api/v1/auth/me',
      'POST /api/v1/auth/change-password',
      'POST /api/v1/auth/logout',
      'POST /api/v1/auth/refresh',
    ]);
  });

  it('gives a gated user no credential on the routes that take no user session', async () => {
    // A user of its own, because the shared gated user's password is changed further down
    // and these proofs sign in with it.
    const email = await createUser('nosession', true, 'SUPER_ADMIN');
    const token = await tokenFor(email);

    for (const { prove } of NO_USER_SESSION.values()) {
      await prove(token, email);
    }
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
