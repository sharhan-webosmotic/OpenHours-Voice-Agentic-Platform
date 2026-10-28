import { afterAll, beforeAll, describe, expect, inject, it } from 'vitest';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { buildTenantExtension } from '../src/db/tenant-extension.js';
import { CrossTenantWriteError, TenantScopeMissingError } from '../src/db/errors.js';
import { runInScope } from '../src/db/tenant-scope.js';
import { TENANT_MODELS } from '../src/db/tenant-models.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import { uuidV7 } from '../src/common/uuid.js';

/**
 * The application isolation lock.
 *
 * Runs on the same app_user connection the API uses, so BOTH locks are live: these
 * assertions cover what the extension does, and the final block removes the extension to
 * prove the database still refuses on its own.
 */

let orgA: OrganisationGraph;
let orgB: OrganisationGraph;
let unscoped: PrismaClient;
/**
 * The extended client, typed as PrismaClient.
 *
 * `$extends` returns an anonymous type that cannot be named outside its module, and what
 * is under test here is the extension's RUNTIME behaviour, not its types. One cast at the
 * boundary keeps every assertion below readable instead of scattering casts through them.
 */
let scoped: PrismaClient;

/** Mirrors withTenant against the test connection rather than src/config. */
const inTenant = async <T>(organisationId: string, fn: (db: PrismaClient) => Promise<T>) =>
  runInScope({ kind: 'tenant', organisationId }, () =>
    scoped.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.org_id', $1, true)`, organisationId);
      return fn(tx as unknown as PrismaClient);
    }),
  );

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    orgA = await createOrganisationGraph(tx, 'ClientA');
    orgB = await createOrganisationGraph(tx, 'ClientB');
  });

  unscoped = new PrismaClient({
    adapter: new PrismaPg({ connectionString: inject('appUserUrl') }),
  });
  scoped = unscoped.$extends(buildTenantExtension()) as unknown as PrismaClient;
}, 120_000);

afterAll(async () => {
  await unscoped.$disconnect();
  await disconnectAll();
});

describe('the scoped model list matches the schema', () => {
  it('covers exactly the models that have an organisation_id', async () => {
    const rows = await ownerClient().$queryRawUnsafe<{ table_name: string }[]>(`
      SELECT c.relname AS table_name
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      JOIN pg_attribute a ON a.attrelid = c.oid AND a.attname = 'organisation_id' AND a.attnum > 0
      WHERE n.nspname = 'public' AND c.relkind = 'r'
    `);

    // Drift guard: a model with an organisation_id left out of TENANT_MODELS is refused
    // at runtime, which is safe, but this names the problem instead of just failing.
    expect(rows).toHaveLength(TENANT_MODELS.size);
  });
});

describe('a query with no scope throws rather than quietly returning nothing', () => {
  it('throws TenantScopeMissingError', async () => {
    // RLS alone would return zero rows: safe, but silent. A caller would read an empty
    // list and conclude the data does not exist.
    await expect(scoped.patient.findMany()).rejects.toThrow(TenantScopeMissingError);
  });

  it('throws on a write too', async () => {
    await expect(
      scoped.patient.create({
        data: {
          id: uuidV7(),
          organisationId: orgA.organisationId,
          fullName: 'No Scope',
          phone: '+919900001111',
        },
      }),
    ).rejects.toThrow(TenantScopeMissingError);
  });
});

describe('reads are scoped to the active organisation', () => {
  it.each(['patient', 'appointment', 'doctor', 'service', 'followUp', 'prescription'] as const)(
    '%s.findMany returns only this organisation',
    async (model) => {
      const rows = await inTenant(orgA.organisationId, (db) =>
        (db[model] as { findMany: () => Promise<{ organisationId: string }[]> }).findMany(),
      );

      expect(rows.length).toBeGreaterThan(0);
      for (const row of rows) {
        expect(row.organisationId).toBe(orgA.organisationId);
      }
    },
  );

  it('findUnique on a foreign id returns null, which repositories turn into NotFound', async () => {
    const found = await inTenant(orgA.organisationId, (db) =>
      db.patient.findUnique({ where: { id: orgB.ids.patients ?? '' } }),
    );

    // Never Forbidden: a 403 would confirm the row exists (root CLAUDE.md rule 7).
    expect(found).toBeNull();
  });
});

describe('writes cannot reach another organisation', () => {
  it('updateMany on a foreign id affects nothing and leaves the row intact', async () => {
    const affected = await inTenant(orgA.organisationId, (db) =>
      db.patient.updateMany({
        where: { id: orgB.ids.patients ?? '' },
        data: { fullName: 'Renamed By Attacker' },
      }),
    );

    expect(affected.count).toBe(0);

    const unchanged = await asPlatform(ownerClient(), (tx) =>
      tx.patient.findUnique({
        where: { id: orgB.ids.patients ?? '' },
        select: { fullName: true },
      }),
    );
    expect(unchanged?.fullName).not.toBe('Renamed By Attacker');
  });

  it('deleteMany on a foreign id affects nothing and leaves the row intact', async () => {
    const affected = await inTenant(orgA.organisationId, (db) =>
      db.patient.deleteMany({ where: { id: orgB.ids.patients ?? '' } }),
    );

    expect(affected.count).toBe(0);

    const stillThere = await asPlatform(ownerClient(), (tx) =>
      tx.patient.findUnique({ where: { id: orgB.ids.patients ?? '' }, select: { id: true } }),
    );
    expect(stillThere).not.toBeNull();
  });

  it('accepts a create whose organisationId matches the scope', async () => {
    const created = await inTenant(orgA.organisationId, (db) =>
      db.patient.create({
        data: {
          id: uuidV7(),
          organisationId: orgA.organisationId,
          fullName: 'Scoped Patient',
          phone: '+919900003333',
        },
      }),
    );

    expect(created.organisationId).toBe(orgA.organisationId);
  });

  it('REJECTS a create that names another organisation', async () => {
    // Rule 2: organisation never comes from input. Rejected rather than silently
    // overwritten, so a caller that believed it was writing elsewhere finds out.
    await expect(
      inTenant(orgA.organisationId, (db) =>
        db.patient.create({
          data: {
            id: uuidV7(),
            organisationId: orgB.organisationId,
            fullName: 'Injected',
            phone: '+919900004444',
          },
        }),
      ),
    ).rejects.toThrow(CrossTenantWriteError);
  });

  it('REJECTS a where clause that names another organisation', async () => {
    await expect(
      inTenant(orgA.organisationId, (db) =>
        db.patient.findMany({ where: { organisationId: orgB.organisationId } }),
      ),
    ).rejects.toThrow(CrossTenantWriteError);
  });

  it('injects the scope into a where clause that omits it', async () => {
    // This is where injection genuinely earns its place: `where` is optional in the
    // generated types, so a repository can forget it and still be safe.
    const rows = await inTenant(orgA.organisationId, (db) =>
      db.patient.findMany({ where: { deletedAt: null } }),
    );

    expect(rows.length).toBeGreaterThan(0);
    for (const row of rows) {
      expect(row.organisationId).toBe(orgA.organisationId);
    }
  });
});

describe('Organisation is scoped by primary key, not organisation_id', () => {
  it('sees only its own organisation row', async () => {
    const rows = await inTenant(orgA.organisationId, (db) => db.organisation.findMany());

    expect(rows).toHaveLength(1);
    expect(rows[0]?.id).toBe(orgA.organisationId);
  });

  it('cannot read another organisation by id', async () => {
    const found = await inTenant(orgA.organisationId, (db) =>
      db.organisation.findUnique({ where: { id: orgB.organisationId } }),
    );

    expect(found).toBeNull();
  });
});

describe('row-level security holds WITHOUT the extension', () => {
  // The point of having two locks. If the extension is removed, bypassed or wrong, the
  // database must still refuse. These use the UNEXTENDED client.
  it('returns zero rows when app.org_id is unset', async () => {
    const rows = await unscoped.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT count(*)::bigint AS count FROM patients',
    );

    expect(Number(rows[0]?.count)).toBe(0);
  });

  it('refuses a direct query for another organisation despite an explicit filter', async () => {
    const rows = await unscoped.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SELECT set_config('app.org_id', $1, true)`, orgA.organisationId);
      // Asking the database directly for organisation B's patient, with nothing
      // rewriting the query. The policy is the only thing in the way.
      return tx.$queryRawUnsafe<{ id: string }[]>(
        'SELECT id FROM patients WHERE organisation_id = $1',
        orgB.organisationId,
      );
    });

    expect(rows).toEqual([]);
  });
});
