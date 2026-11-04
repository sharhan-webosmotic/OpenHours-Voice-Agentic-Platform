import { afterAll, describe, expect, inject, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { CSRF_HEADER } from '../src/common/csrf.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { REFRESH_COOKIE } from '../src/modules/auth/auth.routes.js';
import { jsonBody } from '../src/test-support/http.js';
import {
  CONFIRMATION_PHRASE,
  ResetRefused,
  resetPassword,
  runResetPasswordCommand,
} from '../prisma/reset-password.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';

/**
 * The password reset command.
 *
 * What matters is that the printed password works, that nothing the old password opened can be
 * renewed afterwards, that it cannot be pointed at a shared database by accident, and that it
 * leaves a trace. A reset that writes an unusable hash, or leaves a stolen session alive, has
 * failed while appearing to succeed.
 */

const app = createApp({ readiness: () => Promise.resolve() });

const OLD_PASSWORD = 'the-password-somebody-forgot';
const LOCAL_URL = 'postgresql://user:pass@127.0.0.1:5432/clinicai';
const SHARED_URL = 'postgresql://user:pass@db.example.supabase.com:6543/postgres';

const email = (label: string): string => `${label}.reset-test.${String(Date.now())}@test.invalid`;

/** A platform user with a known password, optionally locked out. */
const createUser = async (label: string, lockedOut = false): Promise<string> => {
  const address = email(label);
  const passwordHash = await hashPassword(OLD_PASSWORD);

  await asPlatform(ownerClient(), (tx) =>
    tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: null,
        email: address,
        passwordHash,
        fullName: `Reset ${label}`,
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
        mustChangePassword: false,
        ...(lockedOut
          ? { failedLoginCount: 5, lockedUntil: new Date(Date.now() + 3_600_000) }
          : {}),
      },
    }),
  );

  return address;
};

const storedHash = async (address: string): Promise<string | undefined> =>
  asPlatform(ownerClient(), async (tx) => {
    const user = await tx.user.findUnique({
      where: { email: address },
      select: { passwordHash: true },
    });
    return user?.passwordHash;
  });

const login = (address: string, password: string) =>
  request(app).post('/api/v1/auth/login').send({ email: address, password, audience: 'admin' });

const refreshCookieFrom = (headers: Record<string, unknown>): string | undefined => {
  const raw = headers['set-cookie'];
  const list = Array.isArray(raw) ? (raw as string[]) : typeof raw === 'string' ? [raw] : [];
  return list
    .find((c) => c.startsWith(`${REFRESH_COOKIE}=`))
    ?.split(';')[0]
    ?.split('=')[1];
};

afterAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    const where = { email: { contains: '.reset-test.' } };
    await tx.refreshToken.deleteMany({ where: { user: where } });
    await tx.user.deleteMany({ where });
  });
  await disconnectAll();
});

describe('resetPassword', () => {
  it('refuses an email no user has, and changes nothing', async () => {
    await expect(
      resetPassword(ownerClient(), {
        email: email('nobody'),
        databaseUrl: LOCAL_URL,
        confirmation: undefined,
      }),
    ).rejects.toThrow(/no user has that email/);
  });

  it('refuses a database that is not local without the confirmation, and changes nothing', async () => {
    const address = await createUser('shared');
    const before = await storedHash(address);

    for (const confirmation of [undefined, 'yes', CONFIRMATION_PHRASE.toUpperCase()]) {
      await expect(
        resetPassword(ownerClient(), { email: address, databaseUrl: SHARED_URL, confirmation }),
      ).rejects.toThrow(ResetRefused);
    }

    expect(await storedHash(address)).toBe(before);
    expect((await login(address, OLD_PASSWORD)).status).toBe(200);
  });

  it('runs against a database that is not local when the confirmation is exact', async () => {
    const address = await createUser('confirmed');

    const reset = await resetPassword(ownerClient(), {
      email: address,
      databaseUrl: SHARED_URL,
      confirmation: CONFIRMATION_PHRASE,
    });

    expect((await login(address, reset.password)).status).toBe(200);
  });

  it('the printed password authenticates, forces a change, and old sessions cannot be renewed', async () => {
    const address = await createUser('live');

    const before = await login(address, OLD_PASSWORD);
    expect(before.status).toBe(200);
    const oldCookie = refreshCookieFrom(before.headers);
    expect(oldCookie).toBeTypeOf('string');

    const reset = await resetPassword(ownerClient(), {
      email: address.toUpperCase(),
      databaseUrl: LOCAL_URL,
      confirmation: undefined,
    });

    expect(reset.refreshTokensRevoked).toBe(1);

    // The old session's refresh token is dead.
    const refreshed = await request(app)
      .post('/api/v1/auth/refresh')
      .set(CSRF_HEADER, '1')
      .set('Cookie', `${REFRESH_COOKIE}=${oldCookie ?? ''}`);
    expect(refreshed.status).toBe(401);

    // The old password no longer works, and the new one does, gated.
    expect((await login(address, OLD_PASSWORD)).status).toBe(401);

    const after = await login(address, reset.password);
    expect(after.status).toBe(200);
    expect(jsonBody<{ mustChangePassword: boolean }>(after).mustChangePassword).toBe(true);

    // Stored as an argon2id hash, never as the password.
    const hash = (await storedHash(address)) ?? '';
    expect(hash).toMatch(/^\$argon2id\$/);
    expect(hash).not.toContain(reset.password);
  });

  it('lifts a lockout, or the new password could not be used', async () => {
    const address = await createUser('locked', true);

    const reset = await resetPassword(ownerClient(), {
      email: address,
      databaseUrl: LOCAL_URL,
      confirmation: undefined,
    });

    expect((await login(address, reset.password)).status).toBe(200);
  });

  it('writes an audit row attributing the reset to the command', async () => {
    const address = await createUser('audited');
    const reset = await resetPassword(ownerClient(), {
      email: address,
      databaseUrl: LOCAL_URL,
      confirmation: undefined,
    });

    const row = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findFirst({ where: { action: 'user.password_reset', entityId: reset.userId } }),
    );

    expect(row).not.toBeNull();
    expect(row?.actorUserId).toBeNull();
    expect(row?.actorRole).toBeNull();
    expect(row?.organisationId).toBeNull();
    expect(row?.entityType).toBe('user');
    expect(row?.metadata).toMatchObject({
      actor: 'reset-password-command',
      mustChangePassword: true,
      refreshTokensRevoked: 0,
    });
    // No credential and no email in the trail.
    expect(JSON.stringify(row?.metadata)).not.toMatch(/@/);
    expect(JSON.stringify(row)).not.toContain(reset.password);
  });
});

describe('runResetPasswordCommand', () => {
  const capture = () => {
    const lines = { out: [] as string[], err: [] as string[] };
    return {
      lines,
      output: { out: (l: string) => lines.out.push(l), err: (l: string) => lines.err.push(l) },
    };
  };

  it('prints usage and changes nothing without an email', async () => {
    const { lines, output } = capture();

    expect(await runResetPasswordCommand([], { DATABASE_URL: LOCAL_URL }, output)).toBe(1);
    expect(lines.err.join('\n')).toMatch(/Usage: pnpm reset-password <email>/);
    expect(lines.out).toEqual([]);
  });

  it('reports a refusal on stderr and exits 1, printing no password', async () => {
    const { lines, output } = capture();

    const code = await runResetPasswordCommand(
      [email('cli-nobody')],
      { DATABASE_URL: inject('ownerUrl') },
      output,
    );

    expect(code).toBe(1);
    expect(lines.err.join('\n')).toMatch(/Refused: no user has that email/);
    expect(lines.out).toEqual([]);
  });

  it('prints the new password exactly once, and it authenticates', async () => {
    const address = await createUser('cli');
    const { lines, output } = capture();

    const code = await runResetPasswordCommand(
      [address],
      { DATABASE_URL: inject('ownerUrl') },
      output,
    );

    expect(code).toBe(0);
    expect(lines.err).toEqual([]);

    const printed = lines.out.join('\n').match(/Password: (\S+)/)?.[1] ?? '';
    expect(printed).not.toBe('');
    expect(lines.out.join('\n').split(printed)).toHaveLength(2);
    expect((await login(address, printed)).status).toBe(200);
  });
});
