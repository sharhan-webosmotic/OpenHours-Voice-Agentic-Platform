import pg from 'pg';
import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { jsonBody } from '../src/test-support/http.js';
import {
  BOOTSTRAP_LOCK_KEY,
  BootstrapRefused,
  CONFIRMATION_PHRASE,
  bootstrapSuperAdmin,
  runBootstrapCommand,
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

  it('serialises concurrent runs on the advisory lock, so exactly one wins', async () => {
    /**
     * DETERMINISTIC, NOT A RACE THAT HAPPENS TO GO ONE WAY. The previous version of this test
     * started two runs and counted winners, and it passed with the lock deleted: both runs live
     * in one Node process and their timing serialised them by luck. Without the lock, three
     * real concurrent runs of the command created three super admins in every round.
     *
     * So this test takes the bootstrap's own advisory lock first, from a separate session, and
     * starts two runs. With the lock in the command, both must WAIT for it, which is observable
     * in `pg_locks` as two ungranted advisory requests, and neither may finish while it is held.
     * Only then is the lock released and the outcome checked. Without the lock in the command,
     * neither run ever waits, so the first assertion fails instead of the test passing by luck.
     */
    await asPlatform(ownerClient(), (tx) =>
      tx.user.updateMany({ where: { role: 'SUPER_ADMIN' }, data: { role: 'INTERNAL_ADMIN' } }),
    );
    expect(await superAdminCount()).toBe(0);

    const holder = new pg.Client({ connectionString: inject('ownerUrl') });
    await holder.connect();

    try {
      await holder.query('SELECT pg_advisory_lock($1)', [BOOTSTRAP_LOCK_KEY.toString()]);

      let finished = 0;
      const runs = (['race-a', 'race-b'] as const).map((label) =>
        bootstrapSuperAdmin(ownerClient(), {
          email: email(label),
          fullName: `Race ${label}`,
          confirmation: CONFIRMATION_PHRASE,
        }).finally(() => {
          finished += 1;
        }),
      );
      // Observed through Promise.allSettled below; this keeps an early rejection from being
      // reported as unhandled while the lock is still held.
      for (const run of runs) {
        run.catch(() => undefined);
      }

      const waitingOnTheLock = async (): Promise<number> => {
        const result = await holder.query<{ waiting: number }>(
          `SELECT count(*)::int AS waiting FROM pg_locks
           WHERE locktype = 'advisory' AND NOT granted`,
        );
        return result.rows[0]?.waiting ?? 0;
      };

      // Polled rather than slept: both runs hash a password before they reach the lock, and
      // the wait ends as soon as both are queued on it, or after ten seconds if they never are.
      const deadline = Date.now() + 10_000;
      while ((await waitingOnTheLock()) < 2 && finished < 2 && Date.now() < deadline) {
        await new Promise((resolve) => setTimeout(resolve, 25));
      }

      expect(await waitingOnTheLock()).toBe(2);
      expect(finished).toBe(0);
      expect(await superAdminCount()).toBe(0);

      await holder.query('SELECT pg_advisory_unlock($1)', [BOOTSTRAP_LOCK_KEY.toString()]);

      const results = await Promise.allSettled(runs);
      expect(results.filter((result) => result.status === 'fulfilled')).toHaveLength(1);
      expect(results.filter((result) => result.status === 'rejected')).toHaveLength(1);
      expect(await superAdminCount()).toBe(1);
    } finally {
      await holder.end();
    }
  });
});

describe('the bootstrap command, as an operator runs it', () => {
  /**
   * The function underneath is tested above. These drive the command itself: the argument
   * handling, the refusals and the printed handover, which is everything an operator sees and
   * which no test used to reach.
   */
  const capture = () => {
    const out: string[] = [];
    const err: string[] = [];
    return {
      out,
      err,
      output: {
        out: (line: string) => out.push(line),
        err: (line: string) => err.push(line),
      },
    };
  };

  const env = (confirmed = true) => ({
    DATABASE_URL: inject('ownerUrl'),
    BOOTSTRAP_SUPER_ADMIN_CONFIRM: confirmed ? CONFIRMATION_PHRASE : undefined,
  });

  const passwordLines = (lines: readonly string[]) =>
    lines.filter((line) => line.trim().startsWith('Password:'));

  it('refuses without DATABASE_URL, printing no password', async () => {
    const run = capture();
    const code = await runBootstrapCommand(
      [email('nourl'), 'No Url'],
      { BOOTSTRAP_SUPER_ADMIN_CONFIRM: CONFIRMATION_PHRASE },
      run.output,
    );

    expect(code).toBe(1);
    expect(run.out).toEqual([]);
    expect(run.err.join('\n')).toMatch(/DATABASE_URL/);
  });

  it('prints its usage, and the confirmation it needs, when an argument is missing', async () => {
    const run = capture();

    expect(await runBootstrapCommand([email('usage')], env(), run.output)).toBe(1);
    expect(run.out).toEqual([]);
    expect(run.err.join('\n')).toMatch(/Usage: pnpm bootstrap:super-admin/);
  });

  it('refuses without the confirmation variable, on stderr, and writes nothing', async () => {
    const before = await superAdminCount();
    const run = capture();

    expect(
      await runBootstrapCommand([email('cli-unconfirmed'), 'Cli'], env(false), run.output),
    ).toBe(1);
    expect(run.out).toEqual([]);
    expect(run.err.join('\n')).toMatch(/^Refused: BOOTSTRAP_SUPER_ADMIN_CONFIRM/);
    expect(await superAdminCount()).toBe(before);
  });

  it('refuses when a super admin already exists', async () => {
    expect(await superAdminCount()).toBeGreaterThan(0);
    const run = capture();

    expect(await runBootstrapCommand([email('cli-second'), 'Cli Second'], env(), run.output)).toBe(
      1,
    );
    expect(run.err.join('\n')).toMatch(/already exist/);
    expect(passwordLines(run.out)).toEqual([]);
  });

  it('prints the password exactly once, and the printed password signs in', async () => {
    await asPlatform(ownerClient(), (tx) =>
      tx.user.updateMany({ where: { role: 'SUPER_ADMIN' }, data: { role: 'INTERNAL_ADMIN' } }),
    );
    const address = email('cli-first');
    const run = capture();

    expect(await runBootstrapCommand([address, 'Cli First'], env(), run.output)).toBe(0);
    expect(run.err).toEqual([]);

    const printed = passwordLines(run.out);
    expect(printed).toHaveLength(1);
    const password = printed[0]?.split('Password:')[1]?.trim() ?? '';

    const response = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: address, password, audience: 'admin' });

    expect(response.status).toBe(200);
    expect(jsonBody<{ mustChangePassword: boolean }>(response).mustChangePassword).toBe(true);
  });
});
