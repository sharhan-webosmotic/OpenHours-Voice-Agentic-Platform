import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { pino } from 'pino';
import { createApp } from '../src/app.js';
import { buildLoggerOptions } from '../src/common/logger.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import express, { type NextFunction, type Request, type Response } from 'express';
import { REFRESH_COOKIE, authRouter } from '../src/modules/auth/auth.routes.js';
import { createRateLimiter } from '../src/common/rate-limit.js';
import { PROBLEM_JSON_CONTENT_TYPE, toProblemDetails } from '../src/common/problem-details.js';
import { requestContextMiddleware } from '../src/common/request-context.middleware.js';
import { signAccessToken } from '../src/modules/auth/auth.tokens.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { jsonBody, problemBody } from '../src/test-support/http.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * Authentication, against the real database as app_user.
 *
 * The password is deliberately long enough to satisfy the policy and is synthetic.
 */

const PASSWORD = 'correct-horse-battery-staple';
const WRONG_PASSWORD = 'wrong-horse-battery-staple';

let org: OrganisationGraph;
let ownerEmail: string;
let deactivatedEmail: string;
const app = createApp({ readiness: () => Promise.resolve() });

type LoginBody = {
  readonly accessToken: string;
  readonly mustChangePassword: boolean;
  readonly user: {
    readonly id: string;
    readonly organisationId: string | null;
    readonly role: string;
  };
};
type MeBody = {
  readonly id: string;
  readonly organisationId: string | null;
  readonly role: string;
};
type PairingBody = { readonly code: string; readonly expiresAt: string };
type PairedBody = { readonly deviceToken: string; readonly deviceId: string };
type SchedulesBody = { readonly items: readonly unknown[] };

/** Pulls the refresh cookie value out of a Set-Cookie header. */
const refreshCookieFrom = (headers: Record<string, unknown>): string | undefined => {
  const raw = headers['set-cookie'];
  const list = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  const match = list.find((c) => c.startsWith(`${REFRESH_COOKIE}=`));
  return match?.split(';')[0]?.split('=')[1];
};

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'Auth');

    ownerEmail = `auth.owner.${Date.now()}@test.invalid`;
    await tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: org.organisationId,
        email: ownerEmail,
        passwordHash,
        fullName: 'Auth Owner',
        role: 'CLINIC_OWNER',
        status: 'ACTIVE',
      },
    });

    deactivatedEmail = `auth.gone.${Date.now()}@test.invalid`;
    await tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: org.organisationId,
        email: deactivatedEmail,
        passwordHash,
        fullName: 'Deactivated User',
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const login = (email: string, password: string) =>
  request(app).post('/api/v1/auth/login').send({ email, password });

describe('login', () => {
  it('succeeds with the right password and sets an httpOnly refresh cookie', async () => {
    const response = await login(ownerEmail, PASSWORD);

    expect(response.status).toBe(200);
    expect(jsonBody<LoginBody>(response).accessToken).toBeTypeOf('string');
    expect(jsonBody<LoginBody>(response).user.organisationId).toBe(org.organisationId);

    const setCookie = String(response.headers['set-cookie']);
    expect(setCookie).toContain('HttpOnly');
    expect(setCookie).toContain('SameSite=Lax');
    // The refresh token must never be readable by browser JavaScript, and must not be
    // echoed into the response body alongside the access token.
    expect(JSON.stringify(jsonBody<LoginBody>(response))).not.toContain(
      refreshCookieFrom(response.headers) ?? '#',
    );
  });

  it('rejects a wrong password', async () => {
    const response = await login(ownerEmail, WRONG_PASSWORD);

    expect(response.status).toBe(401);
    expect(response.headers['content-type']).toContain('application/problem+json');
  });

  it('answers an unknown email exactly as a wrong password', async () => {
    const unknown = await login(`nobody.${Date.now()}@test.invalid`, PASSWORD);
    const wrong = await login(ownerEmail, WRONG_PASSWORD);

    // Identical status and body: login must not reveal which accounts exist.
    expect(unknown.status).toBe(wrong.status);
    expect(problemBody(unknown).title).toBe(problemBody(wrong).title);
    expect(problemBody(unknown).detail).toBe(problemBody(wrong).detail);
  });

  it('locks the account after the configured number of failures', async () => {
    const email = `auth.lock.${Date.now()}@test.invalid`;
    await asPlatform(ownerClient(), (tx) =>
      tx.user.create({
        data: {
          id: uuidV7(),
          organisationId: org.organisationId,
          email,
          passwordHash: '$argon2id$v=19$m=65536,t=3,p=4$notarealhash$notarealhash',
          fullName: 'Lockout User',
          role: 'STAFF',
          status: 'ACTIVE',
        },
      }),
    );

    for (let i = 0; i < 5; i += 1) {
      await login(email, WRONG_PASSWORD);
    }

    const locked = await asPlatform(ownerClient(), (tx) =>
      tx.user.findUnique({
        where: { email },
        select: { lockedUntil: true, failedLoginCount: true },
      }),
    );

    expect(locked?.failedLoginCount).toBeGreaterThanOrEqual(5);
    expect(locked?.lockedUntil).not.toBeNull();
  });

  it('rejects a deactivated user', async () => {
    await asPlatform(ownerClient(), (tx) =>
      tx.user.update({ where: { email: deactivatedEmail }, data: { status: 'DEACTIVATED' } }),
    );

    const response = await login(deactivatedEmail, PASSWORD);

    expect(response.status).toBe(401);
  });
});

describe('refresh token rotation', () => {
  it('rotates on use and invalidates the presented token', async () => {
    const first = await login(ownerEmail, PASSWORD);
    const firstToken = refreshCookieFrom(first.headers);
    expect(firstToken).toBeTypeOf('string');

    const second = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${firstToken ?? ''}`);

    expect(second.status).toBe(200);
    const secondToken = refreshCookieFrom(second.headers);
    expect(secondToken).not.toBe(firstToken);

    // The new token works.
    const third = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${secondToken ?? ''}`);
    expect(third.status).toBe(200);
  });

  it('REUSING an old refresh token revokes the whole family', async () => {
    const first = await login(ownerEmail, PASSWORD);
    const original = refreshCookieFrom(first.headers);

    const rotated = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${original ?? ''}`);
    const current = refreshCookieFrom(rotated.headers);

    // Replaying the already-used token.
    const replay = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${original ?? ''}`);
    expect(replay.status).toBe(401);

    // A stolen token and a replaying client are indistinguishable, so the whole lineage
    // dies: the token that WAS valid must now be rejected too.
    const afterRevocation = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${current ?? ''}`);
    expect(afterRevocation.status).toBe(401);
  });

  it('rejects an unknown refresh token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=not-a-real-token`);

    expect(response.status).toBe(401);
  });

  it('rejects an expired refresh token', async () => {
    const session = await login(ownerEmail, PASSWORD);
    const token = refreshCookieFrom(session.headers);

    await asPlatform(ownerClient(), (tx) =>
      tx.refreshToken.updateMany({
        where: { revokedAt: null },
        data: { expiresAt: new Date(Date.now() - 1000) },
      }),
    );

    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${token ?? ''}`);

    expect(response.status).toBe(401);
  });

  it('a user deactivated after login fails at the NEXT refresh', async () => {
    const email = `auth.revoke.${Date.now()}@test.invalid`;
    await asPlatform(ownerClient(), async (tx) =>
      tx.user.create({
        data: {
          id: uuidV7(),
          organisationId: org.organisationId,
          email,
          passwordHash: await hashPassword(PASSWORD),
          fullName: 'Soon Deactivated',
          role: 'STAFF',
          status: 'ACTIVE',
        },
      }),
    );

    const session = await login(email, PASSWORD);
    const token = refreshCookieFrom(session.headers);
    expect(session.status).toBe(200);

    await asPlatform(ownerClient(), (tx) =>
      tx.user.update({ where: { email }, data: { status: 'DEACTIVATED' } }),
    );

    // Refresh is the only place deactivation can take effect: an access token is
    // self-contained and cannot be revoked once issued, which is why it is short-lived.
    const response = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${token ?? ''}`);

    expect(response.status).toBe(401);
  });

  it('logout revokes the session', async () => {
    const session = await login(ownerEmail, PASSWORD);
    const token = refreshCookieFrom(session.headers);

    const loggedOut = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `${REFRESH_COOKIE}=${token ?? ''}`);
    expect(loggedOut.status).toBe(204);

    const afterLogout = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${token ?? ''}`);
    expect(afterLogout.status).toBe(401);
  });
});

describe('access tokens', () => {
  it('accepts a valid token on /me', async () => {
    const session = await login(ownerEmail, PASSWORD);

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${jsonBody<LoginBody>(session).accessToken}`);

    expect(response.status).toBe(200);
    expect(jsonBody<MeBody>(response).organisationId).toBe(org.organisationId);
  });

  it('rejects a TAMPERED token', async () => {
    const session = await login(ownerEmail, PASSWORD);
    const token = jsonBody<LoginBody>(session).accessToken;
    // Flip the last character of the signature.
    const tampered = token.slice(0, -1) + (token.endsWith('A') ? 'B' : 'A');

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${tampered}`);

    expect(response.status).toBe(401);
  });

  it('rejects a token signed with a different key', async () => {
    const forged = await signAccessToken({
      userId: uuidV7(),
      organisationId: org.organisationId,
      role: 'SUPER_ADMIN',
    });
    // Signed with the real key here, so tamper the payload section instead: a forged
    // role must not be accepted.
    const [header, , signature] = forged.split('.');
    const fakePayload = Buffer.from(
      JSON.stringify({ sub: uuidV7(), org: org.organisationId, role: 'SUPER_ADMIN' }),
    ).toString('base64url');

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${header ?? ''}.${fakePayload}.${signature ?? ''}`);

    expect(response.status).toBe(401);
  });

  it('rejects a missing Authorization header', async () => {
    const response = await request(app).get('/api/v1/auth/me');
    expect(response.status).toBe(401);
  });
});

describe('device tokens are confined to forwarding endpoints', () => {
  let deviceToken: string;
  let accessToken: string;

  beforeAll(async () => {
    const session = await login(ownerEmail, PASSWORD);
    accessToken = jsonBody<LoginBody>(session).accessToken;

    const issued = await request(app)
      .post('/api/v1/devices/pairing-codes')
      .set('Authorization', `Bearer ${accessToken}`);
    expect(issued.status).toBe(201);

    const paired = await request(app)
      .post('/api/v1/devices/pair')
      .send({ code: jsonBody<PairingBody>(issued).code, label: 'Test Phone' });
    expect(paired.status).toBe(201);

    deviceToken = jsonBody<PairedBody>(paired).deviceToken;
  });

  it('a device token reaches the forwarding endpoint', async () => {
    const response = await request(app)
      .get('/api/v1/forwarding/schedules')
      .set('X-Device-Token', deviceToken);

    expect(response.status).toBe(200);
    expect(Array.isArray(jsonBody<SchedulesBody>(response).items)).toBe(true);
  });

  it('a device token CANNOT call a user endpoint', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('X-Device-Token', deviceToken)
      // Also offered as a bearer token, in case anything treats the two alike.
      .set('Authorization', `Bearer ${deviceToken}`);

    expect(response.status).toBe(401);
  });

  it('a user access token CANNOT call the forwarding endpoint', async () => {
    const response = await request(app)
      .get('/api/v1/forwarding/schedules')
      .set('Authorization', `Bearer ${accessToken}`);

    // The reverse direction: a clinic login is not a device credential.
    expect(response.status).toBe(401);
  });

  it('a pairing code is single use', async () => {
    const issued = await request(app)
      .post('/api/v1/devices/pairing-codes')
      .set('Authorization', `Bearer ${accessToken}`);

    const first = await request(app)
      .post('/api/v1/devices/pair')
      .send({ code: jsonBody<PairingBody>(issued).code, label: 'First' });
    const second = await request(app)
      .post('/api/v1/devices/pair')
      .send({ code: jsonBody<PairingBody>(issued).code, label: 'Second' });

    expect(first.status).toBe(201);
    expect(second.status).toBe(401);
  });

  it('an unknown pairing code is rejected like a used one', async () => {
    const response = await request(app)
      .post('/api/v1/devices/pair')
      .send({ code: 'ZZZZZZ', label: 'Nope' });

    expect(response.status).toBe(401);
  });
});

describe('change password', () => {
  const makeUser = async (): Promise<string> => {
    const email = `auth.pw.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@test.invalid`;
    await asPlatform(ownerClient(), async (tx) =>
      tx.user.create({
        data: {
          id: uuidV7(),
          organisationId: org.organisationId,
          email,
          passwordHash: await hashPassword(PASSWORD),
          fullName: 'Password Changer',
          role: 'STAFF',
          status: 'ACTIVE',
        },
      }),
    );
    return email;
  };

  it('changes the password and ends every session', async () => {
    const email = await makeUser();
    const session = await login(email, PASSWORD);
    const token = jsonBody<LoginBody>(session).accessToken;
    const refresh = refreshCookieFrom(session.headers);
    const newPassword = 'a-different-long-password';

    const changed = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword });

    expect(changed.status).toBe(204);

    // Every session ends: if the change was prompted by a compromise, leaving the old
    // sessions alive would defeat it.
    const afterChange = await request(app)
      .post('/api/v1/auth/refresh')
      .set('Cookie', `${REFRESH_COOKIE}=${refresh ?? ''}`);
    expect(afterChange.status).toBe(401);

    // The new password works and the old one does not.
    expect((await login(email, newPassword)).status).toBe(200);
    expect((await login(email, PASSWORD)).status).toBe(401);
  });

  it('refuses when the current password is wrong', async () => {
    const email = await makeUser();
    const token = jsonBody<LoginBody>(await login(email, PASSWORD)).accessToken;

    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: WRONG_PASSWORD, newPassword: 'another-long-password-x' });

    expect(response.status).toBe(403);
    // The old password must still work: a failed change must change nothing.
    expect((await login(email, PASSWORD)).status).toBe(200);
  });

  it('refuses a new password below the minimum length', async () => {
    const email = await makeUser();
    const token = jsonBody<LoginBody>(await login(email, PASSWORD)).accessToken;

    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, newPassword: 'short' });

    expect(response.status).toBe(400);
    expect(problemBody(response).errors?.[0]?.field).toBe('body.newPassword');
  });

  it('rejects an unauthenticated change', async () => {
    const response = await request(app)
      .post('/api/v1/auth/change-password')
      .send({ currentPassword: PASSWORD, newPassword: 'another-long-password-y' });

    expect(response.status).toBe(401);
  });

  it('clears must_change_password for a temporary password', async () => {
    const email = `auth.temp.${Date.now()}@test.invalid`;
    await asPlatform(ownerClient(), async (tx) =>
      tx.user.create({
        data: {
          id: uuidV7(),
          organisationId: org.organisationId,
          email,
          passwordHash: await hashPassword(PASSWORD),
          fullName: 'Temporary Password User',
          role: 'STAFF',
          status: 'ACTIVE',
          mustChangePassword: true,
        },
      }),
    );

    const session = await login(email, PASSWORD);
    expect(jsonBody<LoginBody>(session).mustChangePassword).toBe(true);

    await request(app)
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${jsonBody<LoginBody>(session).accessToken}`)
      .send({ currentPassword: PASSWORD, newPassword: 'chosen-by-the-user-now' });

    const after = await login(email, 'chosen-by-the-user-now');
    expect(jsonBody<LoginBody>(after).mustChangePassword).toBe(false);
  });
});

describe('logout is idempotent', () => {
  it('succeeds with no cookie at all', async () => {
    // Logging out when already logged out is not an error: the goal is reached.
    expect((await request(app).post('/api/v1/auth/logout')).status).toBe(204);
  });

  it('succeeds with an unknown token', async () => {
    const response = await request(app)
      .post('/api/v1/auth/logout')
      .set('Cookie', `${REFRESH_COOKIE}=never-existed`);

    expect(response.status).toBe(204);
  });
});

describe('/me reflects the token', () => {
  it('reports the role the token carries', async () => {
    const token = jsonBody<LoginBody>(await login(ownerEmail, PASSWORD)).accessToken;

    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(jsonBody<MeBody & { role: string }>(response).role).toBe('CLINIC_OWNER');
  });

  it('rejects a non-bearer Authorization scheme', async () => {
    const response = await request(app)
      .get('/api/v1/auth/me')
      .set('Authorization', 'Basic dXNlcjpwYXNz');

    expect(response.status).toBe(401);
  });

  it('rejects an empty bearer value', async () => {
    const response = await request(app).get('/api/v1/auth/me').set('Authorization', 'Bearer ');

    expect(response.status).toBe(401);
  });
});

describe('login is throttled per email', () => {
  it('returns 429 problem+json once the per-email bucket is spent', async () => {
    // The suite raises the real limits so they do not throttle the tests themselves
    // (tests/support/setup-env.ts). This mounts the login route with a deliberately low
    // per-email limiter, so what is proven is the wiring on the route, not just the
    // factory in isolation.
    const throttled = express();
    throttled.use(requestContextMiddleware);
    throttled.use(express.json());
    throttled.use(
      '/api/v1/auth',
      authRouter({
        emailLimiter: createRateLimiter({
          windowMs: 60_000,
          limit: 2,
          keyGenerator: (req) => {
            const body = req.body as { email?: unknown } | undefined;
            return typeof body?.email === 'string' ? body.email.toLowerCase() : 'unknown';
          },
        }),
      }),
    );
    throttled.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const problem = toProblemDetails(error);
      res.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
    });

    const email = `throttle.${Date.now()}@test.invalid`;
    const attempt = () =>
      request(throttled).post('/api/v1/auth/login').send({ email, password: WRONG_PASSWORD });

    const first = await attempt();
    const second = await attempt();
    const third = await attempt();

    expect(first.status).toBe(401);
    expect(second.status).toBe(401);
    expect(third.status).toBe(429);
    expect(problemBody(third).title).toBe('Too Many Requests');
  });

  it('a different email has its own bucket', async () => {
    const limiter = createRateLimiter({
      windowMs: 60_000,
      limit: 1,
      keyGenerator: (req) => {
        const body = req.body as { email?: unknown } | undefined;
        return typeof body?.email === 'string' ? body.email.toLowerCase() : 'unknown';
      },
    });

    const throttled = express();
    throttled.use(requestContextMiddleware);
    throttled.use(express.json());
    throttled.use('/api/v1/auth', authRouter({ emailLimiter: limiter }));
    throttled.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      const problem = toProblemDetails(error);
      res.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
    });

    const a = `bucket.a.${Date.now()}@test.invalid`;
    const b = `bucket.b.${Date.now()}@test.invalid`;

    await request(throttled)
      .post('/api/v1/auth/login')
      .send({ email: a, password: WRONG_PASSWORD });
    const aSecond = await request(throttled)
      .post('/api/v1/auth/login')
      .send({ email: a, password: WRONG_PASSWORD });
    const bFirst = await request(throttled)
      .post('/api/v1/auth/login')
      .send({ email: b, password: WRONG_PASSWORD });

    expect(aSecond.status).toBe(429);
    // One account being attacked must not lock everyone else out.
    expect(bFirst.status).toBe(401);
  });
});

describe('no credential reaches the logs', () => {
  it('logs neither the password nor any token', () => {
    const lines: string[] = [];
    const logger = pino(
      { ...buildLoggerOptions(), level: 'trace' },
      { write: (line: string) => lines.push(line) },
    );

    // The service logs through the module-level logger, so this asserts the redaction
    // configuration those logs run through rather than intercepting them.
    logger.info(
      { password: PASSWORD, token: 'refresh-token-value', user: { email: ownerEmail } },
      'auth attempt',
    );

    const output = lines.join('\n');
    expect(output).not.toContain(PASSWORD);
    expect(output).not.toContain('refresh-token-value');
    expect(output).not.toContain(ownerEmail);
  });
});
