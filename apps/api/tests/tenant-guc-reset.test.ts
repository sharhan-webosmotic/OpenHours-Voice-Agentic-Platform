import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { inject } from 'vitest';
import { Client } from 'pg';
import { PLATFORM_SCOPE_SQL, TENANT_SCOPE_SQL } from '../src/db/tenant-client.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * `app.platform` is a self-service bypass, and this is what contains it.
 *
 * The setting is an ordinary PostgreSQL custom GUC, so the unprivileged `app_user` the
 * API connects as may set it, and a third argument of `false` makes it session-scoped: it
 * then survives on the pooled connection and widens every later request that reuses it.
 * A reviewer proved that escalation against this database.
 *
 * A raw `pg` client is used rather than the Prisma pool because the point is one
 * POISONED CONNECTION, and the pool hands out whichever connection it likes. The SQL is
 * imported from the implementation rather than retyped, so the test cannot drift away
 * from what `withTenant` and `asSystem` actually issue.
 *
 * What this does NOT prove: that `app_user` cannot assert platform scope at all. It
 * still can, inside its own transaction. The real fix needs an authority `app_user`
 * cannot set, and is tracked in docs/ROADMAP.md.
 */

let orgA: OrganisationGraph;
let orgB: OrganisationGraph;
let poisoned: Client;

const PATIENT_COUNT = `SELECT count(*)::int AS n FROM patients WHERE organisation_id = ANY($1::uuid[])`;

const countPatients = async (): Promise<number> => {
  const result = await poisoned.query<{ n: number }>(PATIENT_COUNT, [
    [orgA.organisationId, orgB.organisationId],
  ]);
  return result.rows[0]?.n ?? -1;
};

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    orgA = await createOrganisationGraph(tx, 'GucResetA');
    orgB = await createOrganisationGraph(tx, 'GucResetB');
  });

  poisoned = new Client({ connectionString: inject('appUserUrl') });
  await poisoned.connect();
}, 120_000);

afterAll(async () => {
  await poisoned.end();
  await disconnectAll();
});

describe('a leaked session-scoped app.platform cannot widen a tenant transaction', () => {
  it('confirms the escalation is real before proving it is contained', async () => {
    // Scoped to one organisation, one patient is visible. This is the baseline the
    // escalation moves.
    await poisoned.query(`SELECT set_config('app.org_id', $1, true)`, [orgA.organisationId]);
    await poisoned.query('BEGIN');
    await poisoned.query(`SELECT set_config('app.org_id', $1, true)`, [orgA.organisationId]);
    expect(await countPatients()).toBe(1);
    await poisoned.query('COMMIT');

    // app_user sets platform mode on itself, SESSION-scoped. Nothing stops it.
    await poisoned.query(`SELECT set_config('app.platform', 'on', false)`);

    const setting = await poisoned.query<{ value: string }>(
      `SELECT current_setting('app.platform', true) AS value`,
    );
    expect(setting.rows[0]?.value).toBe('on');

    // The connection now sees both organisations: the second lock is off.
    await poisoned.query('BEGIN');
    await poisoned.query(`SELECT set_config('app.org_id', $1, true)`, [orgA.organisationId]);
    expect(await countPatients()).toBe(2);
    await poisoned.query('COMMIT');
  });

  it('clears the leaked setting for the duration of a tenant transaction', async () => {
    // The session value from the previous test is still 'on'.
    expect(
      (
        await poisoned.query<{ value: string }>(
          `SELECT current_setting('app.platform', true) AS value`,
        )
      ).rows[0]?.value,
    ).toBe('on');

    await poisoned.query('BEGIN');
    // Exactly what withTenant issues, on a connection that is already escalated.
    await poisoned.query(TENANT_SCOPE_SQL, [orgA.organisationId]);

    // The row count did not move: the transaction is back to one organisation.
    expect(await countPatients()).toBe(1);

    const inTransaction = await poisoned.query<{ value: string }>(
      `SELECT current_setting('app.platform', true) AS value`,
    );
    expect(inTransaction.rows[0]?.value).toBe('');

    await poisoned.query('COMMIT');

    // And the clear was transaction-local, so the session value is back. That is the
    // honest limit of this defence: it contains the leak per transaction rather than
    // removing the ability to set it.
    const afterCommit = await poisoned.query<{ value: string }>(
      `SELECT current_setting('app.platform', true) AS value`,
    );
    expect(afterCommit.rows[0]?.value).toBe('on');
  });

  it('clears a leaked org_id when platform scope is opened', async () => {
    // The mirror image: a stale session-scoped app.org_id must not narrow or redirect a
    // platform transaction, so asSystem clears it in the same statement.
    await poisoned.query(`SELECT set_config('app.org_id', $1, false)`, [orgB.organisationId]);

    await poisoned.query('BEGIN');
    await poisoned.query(PLATFORM_SCOPE_SQL);

    expect(await countPatients()).toBe(2);
    const orgSetting = await poisoned.query<{ value: string }>(
      `SELECT current_setting('app.org_id', true) AS value`,
    );
    expect(orgSetting.rows[0]?.value).toBe('');

    await poisoned.query('COMMIT');
  });
});
