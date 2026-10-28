import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  appUserClient,
  asOrganisation,
  asPlatform,
  disconnectAll,
  ownerClient,
  tenantTables,
  withoutContext,
} from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import { uuidV7 } from '../src/common/uuid.js';

/**
 * The database half of tenant isolation, exercised as the non-owner `app_user` with the
 * real migrations applied. The application half (the tenant-scoped client) is M1-07;
 * these tests must hold even when that layer is absent or wrong, which is the whole
 * point of having two locks.
 *
 * The table list comes from the catalog, not from a hand-written array, so a tenant
 * table added later is covered automatically instead of being silently skipped.
 */

/**
 * Explicit list, because Vitest's `it.each` needs its cases at collection time and the
 * catalog is only reachable once a connection exists. The first test asserts this list
 * matches the catalog EXACTLY, so adding a tenant table without adding it here fails
 * loudly instead of silently going untested.
 */
const TENANT_TABLES = [
  'appointments',
  'audit_logs',
  'calls',
  'clinic_hours',
  'devices',
  'doctor_services',
  'doctor_time_off',
  'doctor_working_hours',
  'doctors',
  'follow_ups',
  'forwarding_events',
  'forwarding_schedules',
  'notifications',
  'organisations',
  'outbound_calls',
  'pairing_codes',
  'patients',
  'phone_numbers',
  'prescription_items',
  'prescriptions',
  'services',
  'support_sessions',
  'users',
  'voice_agents',
  'webhook_events',
] as const;

let orgA: OrganisationGraph;
let orgB: OrganisationGraph;
let tables: readonly string[];

beforeAll(async () => {
  const owner = ownerClient();
  tables = await tenantTables(owner);

  // Fixtures are built with platform scope: FORCE ROW LEVEL SECURITY means even the
  // table owner is subject to the policies.
  await asPlatform(owner, async (tx) => {
    orgA = await createOrganisationGraph(tx, 'A');
    orgB = await createOrganisationGraph(tx, 'B');
  });
}, 120_000);

afterAll(async () => {
  await disconnectAll();
});

describe('every tenant table is covered by this suite', () => {
  it('the hard-coded list matches the database catalog exactly', () => {
    // Drift guard. A new tenant table must appear here, or the isolation assertions
    // below would silently not cover it.
    expect([...tables].sort()).toEqual([...TENANT_TABLES].sort());
  });

  it('the fixture holds a row in every tenant table for both organisations', () => {
    // A table with no fixture row would pass every assertion below while proving
    // nothing, so fixture completeness is checked first.
    const missingA = TENANT_TABLES.filter((table) => orgA.ids[table] === undefined);
    const missingB = TENANT_TABLES.filter((table) => orgB.ids[table] === undefined);

    expect(missingA).toEqual([]);
    expect(missingB).toEqual([]);
  });
});

describe('organisation A cannot READ organisation B', () => {
  it.each(TENANT_TABLES)('sees no row of B in %s', async (table) => {
    const foreignId = orgB.ids[table];
    expect(foreignId).toBeDefined();

    const rows = await asOrganisation(appUserClient(), orgA.organisationId, (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "${table}" WHERE id = $1`, foreignId),
    );

    expect(rows).toEqual([]);
  });

  it.each(TENANT_TABLES)('does see its own row in %s', async (table) => {
    const ownId = orgA.ids[table];

    const rows = await asOrganisation(appUserClient(), orgA.organisationId, (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "${table}" WHERE id = $1`, ownId),
    );

    // The mirror of the test above: a policy that hid everything would also pass
    // "cannot read B", so the suite has to prove A can still read A.
    expect(rows).toHaveLength(1);
  });
});

describe('organisation A cannot WRITE organisation B', () => {
  it.each(TENANT_TABLES)('cannot UPDATE a row of B in %s', async (table) => {
    const foreignId = orgB.ids[table];

    const affected = await asOrganisation(appUserClient(), orgA.organisationId, (tx) =>
      tx.$executeRawUnsafe(
        `UPDATE "${table}" SET created_at = created_at WHERE id = $1`,
        foreignId,
      ),
    ).catch(() => 'rejected' as const);

    // Either the row is invisible (0 affected) or the statement is rejected. Both are
    // acceptable; silently updating another tenant's row is not.
    expect(affected === 'rejected' || affected === 0).toBe(true);

    // And the row must be unchanged when read back with full visibility.
    const stillThere = await asPlatform(ownerClient(), (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "${table}" WHERE id = $1`, foreignId),
    );
    expect(stillThere).toHaveLength(1);
  });

  it.each(TENANT_TABLES)('cannot DELETE a row of B in %s', async (table) => {
    const foreignId = orgB.ids[table];

    const affected = await asOrganisation(appUserClient(), orgA.organisationId, (tx) =>
      tx.$executeRawUnsafe(`DELETE FROM "${table}" WHERE id = $1`, foreignId),
    ).catch(() => 'rejected' as const);

    expect(affected === 'rejected' || affected === 0).toBe(true);

    const stillThere = await asPlatform(ownerClient(), (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM "${table}" WHERE id = $1`, foreignId),
    );
    expect(stillThere).toHaveLength(1);
  });
});

describe('organisation A cannot INSERT into organisation B', () => {
  // Representative tables with no required foreign keys beyond the organisation, so the
  // only reason an insert can fail is the policy's WITH CHECK.
  const insertable = [
    {
      table: 'clinic_hours',
      sql: `INSERT INTO clinic_hours (id, organisation_id, weekday, opens_at_minute, closes_at_minute, created_at, updated_at)
            VALUES ($1, $2, 'TUESDAY', 600, 1020, now(), now())`,
    },
    {
      table: 'patients',
      sql: `INSERT INTO patients (id, organisation_id, full_name, phone, created_at, updated_at)
            VALUES ($1, $2, 'Injected Patient', '+919900009999', now(), now())`,
    },
    {
      table: 'devices',
      sql: `INSERT INTO devices (id, organisation_id, label, token_hash, created_at, updated_at)
            VALUES ($1, $2, 'Injected', 'injected-token-hash', now(), now())`,
    },
    {
      table: 'services',
      sql: `INSERT INTO services (id, organisation_id, name, duration_minutes, created_at, updated_at)
            VALUES ($1, $2, 'Injected Service', 15, now(), now())`,
    },
  ] as const;

  it.each(insertable)('is rejected inserting into $table with B as the owner', async ({ sql }) => {
    const newId = uuidV7();

    const result = await asOrganisation(appUserClient(), orgA.organisationId, (tx) =>
      tx.$executeRawUnsafe(sql, newId, orgB.organisationId),
    ).then(
      () => 'accepted' as const,
      () => 'rejected' as const,
    );

    expect(result).toBe('rejected');
  });

  it('still allows an insert for its OWN organisation', async () => {
    const newId = uuidV7();

    await asOrganisation(appUserClient(), orgA.organisationId, (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO patients (id, organisation_id, full_name, phone, created_at, updated_at)
         VALUES ($1, $2, 'Own Patient', '+919900008888', now(), now())`,
        newId,
        orgA.organisationId,
      ),
    );

    const rows = await asOrganisation(appUserClient(), orgA.organisationId, (tx) =>
      tx.$queryRawUnsafe<{ id: string }[]>(`SELECT id FROM patients WHERE id = $1`, newId),
    );
    expect(rows).toHaveLength(1);
  });
});

describe('with no tenant context, nothing is visible', () => {
  it.each(TENANT_TABLES)('returns zero rows from %s when app.org_id is unset', async (table) => {
    const rows = await withoutContext(appUserClient(), (tx) =>
      tx.$queryRawUnsafe<{ count: bigint }[]>(`SELECT count(*)::bigint AS count FROM "${table}"`),
    );

    // current_setting(..., true) yields an empty string when unset, which NULLIF turns
    // into NULL, so the policy matches nothing rather than raising. Safe by default.
    expect(Number(rows[0]?.count ?? -1)).toBe(0);
  });

  it('rejects an insert when no organisation is set', async () => {
    const result = await withoutContext(appUserClient(), (tx) =>
      tx.$executeRawUnsafe(
        `INSERT INTO patients (id, organisation_id, full_name, phone, created_at, updated_at)
         VALUES ($1, $2, 'No Context', '+919900007777', now(), now())`,
        uuidV7(),
        orgA.organisationId,
      ),
    ).then(
      () => 'accepted' as const,
      () => 'rejected' as const,
    );

    expect(result).toBe('rejected');
  });
});

describe('app_user cannot escape row-level security', () => {
  it('is not a superuser and does not have BYPASSRLS', async () => {
    const rows = await appUserClient().$queryRawUnsafe<
      { rolsuper: boolean; rolbypassrls: boolean }[]
    >(`SELECT rolsuper, rolbypassrls FROM pg_roles WHERE rolname = current_user`);

    expect(rows[0]?.rolsuper).toBe(false);
    expect(rows[0]?.rolbypassrls).toBe(false);
  });

  it('cannot disable a policy', async () => {
    const result = await appUserClient()
      .$executeRawUnsafe(`ALTER TABLE patients DISABLE ROW LEVEL SECURITY`)
      .then(
        () => 'accepted' as const,
        () => 'rejected' as const,
      );

    expect(result).toBe('rejected');
  });
});
