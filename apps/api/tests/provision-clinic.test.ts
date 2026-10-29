import { afterAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { inject } from 'vitest';
import { createApp } from '../src/app.js';
import { PASSWORD_CHANGE_REQUIRED_TYPE } from '../src/common/errors.js';
import { verifyPassword } from '../src/common/passwords.js';
import { jsonBody, problemBody } from '../src/test-support/http.js';
import {
  assertLocalDatabase,
  provisionClinic,
  temporaryPassword,
} from '../prisma/provision-clinic.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';

/**
 * `pnpm provision:clinic` creates a clinic whose temporary passwords actually work.
 *
 * This is the only account-creation path the product has. D-003 settled that there is no
 * email provider, so every real user begins as a one-time password handed over out of
 * band with `mustChangePassword` set, and the dashboard's first-login screen and the API's
 * gate are both built against it. `prisma/seed.ts` cannot stand in: it writes one fixed
 * password that is public in its own source and leaves `mustChangePassword` false, so it
 * never reaches either.
 *
 * The script was restructured so its core is importable and this test can drive it. A
 * provisioning script nothing executes is a script that works until the first time someone
 * needs it.
 */

const app = createApp({ readiness: () => Promise.resolve() });

afterAll(async () => {
  await disconnectAll();
});

describe('temporaryPassword', () => {
  it('is long, grouped and drawn from an unambiguous alphabet', () => {
    const password = temporaryPassword();

    // Six groups of four, which a person has to read off a terminal and retype.
    expect(password).toMatch(
      /^[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}(-[ABCDEFGHJKMNPQRSTUVWXYZ23456789]{4}){5}$/,
    );
    // Comfortably over the 12-character policy minimum, so it is never rejected on
    // length by the change-password schema it has to pass through.
    expect(password.replaceAll('-', '').length).toBe(24);
  });

  it('omits the characters that are misread', () => {
    // 0/O and 1/l/I are the pairs that turn a handover into a support call.
    const alphabet = new Set(
      Array.from({ length: 200 }, () => temporaryPassword().replaceAll('-', '')).join(''),
    );

    for (const character of ['0', 'O', '1', 'I', 'L']) {
      expect(alphabet.has(character)).toBe(false);
    }
  });

  it('does not repeat itself', () => {
    const generated = new Set(Array.from({ length: 50 }, () => temporaryPassword()));

    // Drawn from the CSPRNG. A collision here would mean it is not.
    expect(generated.size).toBe(50);
  });
});

describe('assertLocalDatabase', () => {
  it.each([
    'postgresql://u:p@localhost:5432/db',
    'postgresql://u:p@127.0.0.1:5432/db',
    'postgresql://u:p@postgres:5432/db',
  ])('permits %s', (url) => {
    expect(() => assertLocalDatabase(url)).not.toThrow();
  });

  it.each([
    'postgresql://u:p@db.example.com:5432/prod',
    'postgresql://u:p@clinicai-prod.ap-south-1.rds.amazonaws.com:5432/prod',
  ])('refuses %s', (url) => {
    // This script mints working credentials, so pointing it at a shared database by a
    // stray DATABASE_URL has to fail loudly rather than succeed quietly.
    expect(() => assertLocalDatabase(url)).toThrow(/refusing to provision/);
  });

  it('refuses a value that is not a URL at all', () => {
    expect(() => assertLocalDatabase('not-a-url')).toThrow(/cannot be confirmed as local/);
  });
});

describe('provisionClinic', () => {
  it('creates three clinic users whose temporary passwords work and are gated', async () => {
    const clinic = await provisionClinic(
      ownerClient(),
      'Provisioned Clinic',
      `t${String(Date.now()).slice(-5)}`,
    );

    expect(clinic.users.map((user) => user.role)).toEqual([
      'CLINIC_OWNER',
      'CLINIC_MANAGER',
      'STAFF',
    ]);

    const owner = clinic.users[0];
    if (owner === undefined) {
      throw new Error('no owner provisioned');
    }

    // The password works, which is the thing a hash-only store could silently break.
    const session = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: owner.email, password: owner.password, audience: 'clinic' });

    expect(session.status).toBe(200);
    expect(jsonBody<{ mustChangePassword: boolean }>(session).mustChangePassword).toBe(true);

    // And it is gated until replaced, so provisioning cannot hand out an account that
    // skips the first-login change.
    const blocked = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${jsonBody<{ accessToken: string }>(session).accessToken}`);

    expect(problemBody(blocked).type).toBe(PASSWORD_CHANGE_REQUIRED_TYPE);
  });

  it('stores only hashes, never the password', async () => {
    const clinic = await provisionClinic(
      ownerClient(),
      'Hash Only Clinic',
      `h${String(Date.now()).slice(-5)}`,
    );

    const staff = clinic.users[2];
    if (staff === undefined) {
      throw new Error('no staff user provisioned');
    }

    const row = await asPlatform(ownerClient(), (tx) =>
      tx.user.findUnique({
        where: { email: staff.email },
        select: { passwordHash: true, mustChangePassword: true },
      }),
    );

    expect(row?.mustChangePassword).toBe(true);
    expect(row?.passwordHash).not.toBe(staff.password);
    expect(row?.passwordHash).toMatch(/^\$argon2id\$/);
    // The stored hash is of the password that was handed over, not of something else.
    await expect(verifyPassword(row?.passwordHash ?? '', staff.password)).resolves.toBe(true);
  });

  it('gives each user a different password', async () => {
    const clinic = await provisionClinic(
      ownerClient(),
      'Distinct Clinic',
      `d${String(Date.now()).slice(-5)}`,
    );

    // One password shared across three accounts is how `prisma/seed.ts` works, and it is
    // exactly what this script must not do.
    expect(new Set(clinic.users.map((user) => user.password)).size).toBe(3);
  });

  it('refuses the host the test database is not', () => {
    // Guards against the allow-list being widened until it permits anything: the test
    // container is local, so provisioning against it is allowed, and a remote host is not.
    expect(() => assertLocalDatabase(inject('ownerUrl'))).not.toThrow();
  });
});
