import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { jsonBody } from '../src/test-support/http.js';
import {
  BootstrapRefused,
  CONFIRMATION_PHRASE,
  bootstrapSuperAdmin,
} from '../prisma/bootstrap-super-admin.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';

/**
 * The super-admin bootstrap command.
 *
 * WHAT MATTERS ABOUT A BOOTSTRAP is not that it inserts a row. It is that the account it
 * creates can actually be signed in to, that it refuses to run twice, that it cannot be run
 * by accident, and that it leaves a trace. A command that writes an unusable administrator
 * has failed while appearing to succeed, and nobody finds out until the one moment they need
 * to log in.
 *
 * THE SUITE SHARES ONE DATABASE, and other files create SUPER_ADMIN users of their own. So
 * this file demotes any that exist before it runs and puts them back afterwards. Test files
 * run sequentially (`fileParallelism: false`), so nothing else is mid-run while that holds.
 * The alternative, deleting them, is not available: `support_sessions.platform_user_id` is
 * ON DELETE RESTRICT, and deleting a platform user would be refused or would quietly change
 * what another file had asserted.
 */

const app = createApp({ readiness: () => Promise.resolve() });

let demoted: readonly string[] = [];

const superAdminCount = async (): Promise<number> =>
  asPlatform(ownerClient(), (tx) => tx.user.count({ where: { role: 'SUPER_ADMIN' } }));

beforeAll(async () => {
  demoted = await asPlatform(ownerClient(), async (tx) => {
    const existing = await tx.user.findMany({
      where: { role: 'SUPER_ADMIN' },
      select: { id: true },
    });

    await tx.user.updateMany({
      where: { role: 'SUPER_ADMIN' },
      data: { role: 'INTERNAL_ADMIN' },
    });

    return existing.map((row) => row.id);
  });
}, 120_000);

afterAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    // Every account this file created is removed, and the ones it demoted are restored, so
    // the database is left as it was found.
    await tx.user.deleteMany({ where: { email: { contains: '.bootstrap-test.' } } });

    if (demoted.length > 0) {
      await tx.user.updateMany({
        where: { id: { in: [...demoted] } },
        data: { role: 'SUPER_ADMIN' },
      });
    }
  });

  await disconnectAll();
});

const email = (label: string): string =>
  `${label}.bootstrap-test.${String(Date.now())}@test.invalid`;

describe('bootstrapSuperAdmin', () => {
  it('refuses without the confirmation variable, and writes nothing', async () => {
    const before = await superAdminCount();

    await expect(
      bootstrapSuperAdmin(ownerClient(), {
        email: email('unconfirmed'),
        fullName: 'Unconfirmed Admin',
        confirmation: undefined,
      }),
    ).rejects.toThrow(BootstrapRefused);

    expect(await superAdminCount()).toBe(before);
  });

  it('refuses a confirmation that is nearly right', async () => {
    // The phrase is exact on purpose: the point is that it cannot be satisfied by a
    // variable that happens to be set, or by typing "yes".
    for (const wrong of ['yes', 'true', CONFIRMATION_PHRASE.toUpperCase(), ' ']) {
      await expect(
        bootstrapSuperAdmin(ownerClient(), {
          email: email('nearly'),
          fullName: 'Nearly Right',
          confirmation: wrong,
        }),
      ).rejects.toThrow(BootstrapRefused);
    }
  });

  it('refuses a malformed email and a missing name', async () => {
    await expect(
      bootstrapSuperAdmin(ownerClient(), {
        email: 'not-an-email',
        fullName: 'Valid Name',
        confirmation: CONFIRMATION_PHRASE,
      }),
    ).rejects.toThrow(BootstrapRefused);

    await expect(
      bootstrapSuperAdmin(ownerClient(), {
        email: email('noname'),
        fullName: ' ',
        confirmation: CONFIRMATION_PHRASE,
      }),
    ).rejects.toThrow(BootstrapRefused);
  });

  it('creates the first super admin, and the printed password authenticates', async () => {
    expect(await superAdminCount()).toBe(0);

    const address = email('first');
    const created = await bootstrapSuperAdmin(ownerClient(), {
      email: address,
      fullName: 'First Super Admin',
      confirmation: CONFIRMATION_PHRASE,
    });

    expect(created.email).toBe(address.toLowerCase());
    expect(await superAdminCount()).toBe(1);

    /**
     * THE ASSERTION THAT MATTERS. Everything else here checks the command's bookkeeping;
     * this drives the real login route with the password the command printed, which is the
     * only thing that proves the account is usable. It also proves the account arrives
     * gated: `mustChangePassword` is true, so the handover password cannot be kept.
     */
    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: address, password: created.password, audience: 'admin' });

    expect(response.status).toBe(200);

    const session = jsonBody<{
      mustChangePassword: boolean;
      user: { id: string; organisationId: string | null; role: string };
    }>(response);

    expect(session.mustChangePassword).toBe(true);
    expect(session.user.id).toBe(created.userId);
    expect(session.user.role).toBe('SUPER_ADMIN');
    // A platform role belongs to no organisation, which the users CHECK constraint requires.
    expect(session.user.organisationId).toBeNull();
  });

  it('writes an audit row attributing the action to the bootstrap, not to a user', async () => {
    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findMany({
        where: { action: 'platform.super_admin.bootstrapped' },
        orderBy: { id: 'desc' },
        take: 1,
      }),
    );

    const row = rows[0];
    expect(row).toBeDefined();

    if (row === undefined) {
      return;
    }

    // NULL actor and NULL role: an operator at a terminal did this, not an account.
    // Recording the new super admin as their own creator would be a lie.
    expect(row.actorUserId).toBeNull();
    expect(row.actorRole).toBeNull();
    // A platform action belongs to no organisation.
    expect(row.organisationId).toBeNull();
    expect(row.entityType).toBe('user');
    expect(row.metadata).toMatchObject({ actor: 'bootstrap', mustChangePassword: true });

    // The row carries no credential and no personal detail beyond the id it points at.
    expect(JSON.stringify(row.metadata)).not.toMatch(/@/);
  });

  it('refuses a second run once a super admin exists, and writes nothing', async () => {
    expect(await superAdminCount()).toBe(1);

    await expect(
      bootstrapSuperAdmin(ownerClient(), {
        email: email('second'),
        fullName: 'Second Super Admin',
        confirmation: CONFIRMATION_PHRASE,
      }),
    ).rejects.toThrow(/already exist/i);

    expect(await superAdminCount()).toBe(1);
  });

  it('leaves exactly one winner when two runs race', async () => {
    /**
     * The guard is a count inside a transaction, which on its own is not enough: two
     * concurrent runs would both read zero and both insert. An advisory transaction lock
     * serialises them, and this is what proves it rather than the comment claiming it.
     *
     * The existing super admin is demoted first so both contenders start from zero, which
     * is the only state in which the race is possible at all.
     */
    await asPlatform(ownerClient(), (tx) =>
      tx.user.updateMany({ where: { role: 'SUPER_ADMIN' }, data: { role: 'INTERNAL_ADMIN' } }),
    );

    expect(await superAdminCount()).toBe(0);

    const results = await Promise.allSettled([
      bootstrapSuperAdmin(ownerClient(), {
        email: email('race-a'),
        fullName: 'Race A',
        confirmation: CONFIRMATION_PHRASE,
      }),
      bootstrapSuperAdmin(ownerClient(), {
        email: email('race-b'),
        fullName: 'Race B',
        confirmation: CONFIRMATION_PHRASE,
      }),
    ]);

    const fulfilled = results.filter((result) => result.status === 'fulfilled');
    const rejected = results.filter((result) => result.status === 'rejected');

    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(await superAdminCount()).toBe(1);
  });
});
