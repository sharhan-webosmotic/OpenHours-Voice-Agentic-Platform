import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { buildTenantExtension, CONFINED_OPERATIONS } from './tenant-extension.js';
import { JSON_FIELDS } from './tenant-models.js';
import { CrossTenantWriteError, TenantScopeMissingError } from './errors.js';
import { runInScope } from './tenant-scope.js';

/**
 * The extension's rules, exercised without a database.
 *
 * tenant-client.test.ts proves the behaviour against real PostgreSQL; this covers the
 * operation shapes that are rare in practice but would be the most damaging to get
 * wrong, and it does so fast enough to run in the unit suite.
 */

const ORG = 'org-aaaa';
const OTHER = 'org-bbbb';

type Params = {
  model?: string;
  operation: string;
  args: unknown;
  query: (args: unknown) => Promise<unknown>;
};

/** Invokes the hook and returns the args it would have passed to Prisma. */
const run = async (params: Omit<Params, 'query'>): Promise<Record<string, unknown>> => {
  const hook = buildTenantExtension().query.$allModels.$allOperations;
  let seen: unknown;
  await hook({
    ...params,
    query: (args: unknown) => {
      seen = args;
      return Promise.resolve(null);
    },
  });
  return seen as Record<string, unknown>;
};

const inTenant = <T>(fn: () => Promise<T>): Promise<T> =>
  runInScope({ kind: 'tenant', organisationId: ORG }, fn);

const inPlatform = <T>(fn: () => Promise<T>): Promise<T> =>
  runInScope({ kind: 'platform', reason: 'test' }, fn);

/** The scope a platform role gets for a masked read of ONE clinic (D-017). */
const inPlatformOrganisation = <T>(fn: () => Promise<T>): Promise<T> =>
  runInScope({ kind: 'platform-organisation', reason: 'test', organisationId: ORG }, fn);

describe('scope is required', () => {
  it('throws with no scope at all', async () => {
    await expect(run({ model: 'Patient', operation: 'findMany', args: {} })).rejects.toThrow(
      TenantScopeMissingError,
    );
  });

  it('throws for a model that is not in TENANT_MODELS', async () => {
    // Refused rather than passed through unscoped, so a model added to the schema
    // without being registered cannot slip past this lock.
    await expect(
      inTenant(() => run({ model: 'SomethingNew', operation: 'findMany', args: {} })),
    ).rejects.toThrow(/not a known tenant model/);
  });
});

describe('platform scope passes through untouched', () => {
  it('injects nothing, because it is deliberately cross-organisation', async () => {
    const args = await inPlatform(() =>
      run({ model: 'Patient', operation: 'findMany', args: { where: { deletedAt: null } } }),
    );

    expect(args).toEqual({ where: { deletedAt: null } });
  });
});

describe('where clauses', () => {
  it.each([
    'findUnique',
    'findFirst',
    'findMany',
    'count',
    'aggregate',
    'groupBy',
    'update',
    'updateMany',
    'delete',
    'deleteMany',
  ])('injects the organisation into %s', async (operation) => {
    const args = await inTenant(() => run({ model: 'Patient', operation, args: {} }));

    expect(args.where).toEqual({ organisationId: ORG });
  });

  it('preserves the caller filters alongside the injected organisation', async () => {
    const args = await inTenant(() =>
      run({ model: 'Patient', operation: 'findMany', args: { where: { deletedAt: null } } }),
    );

    expect(args.where).toEqual({ deletedAt: null, organisationId: ORG });
  });

  it('rejects a where naming another organisation', async () => {
    await expect(
      inTenant(() =>
        run({
          model: 'Patient',
          operation: 'findMany',
          args: { where: { organisationId: OTHER } },
        }),
      ),
    ).rejects.toThrow(CrossTenantWriteError);
  });
});

/**
 * The same table again, under the scope a platform role actually gets.
 *
 * ─── WHY IT IS REPEATED RATHER THAN PARAMETERISED ───────────────────────────────
 *
 * Because the two scopes mean opposite things to the database and the same thing to this
 * extension, and that is the entire point of D-017. Under `tenant` scope row-level security
 * is a second lock behind the injection. Under `platform-organisation` the connection has
 * `app.platform = 'on'`, so row-level security is NOT behind it: the injection below is the
 * only thing confining the query, for reads and writes alike.
 *
 * A reader who wants to know whether a given operation is safe for a platform read should be
 * able to find it in a list, which is what this is.
 */
describe('a platform scope confined to one organisation injects exactly as a tenant scope does', () => {
  it.each([
    'findUnique',
    'findUniqueOrThrow',
    'findFirst',
    'findFirstOrThrow',
    'findMany',
    'count',
    'aggregate',
    'groupBy',
    'update',
    'updateMany',
    'delete',
    'deleteMany',
  ])('injects the organisation into %s', async (operation) => {
    const args = await inPlatformOrganisation(() => run({ model: 'Patient', operation, args: {} }));

    expect(args.where).toEqual({ organisationId: ORG });
  });

  it.each(['create', 'createMany', 'upsert'])(
    'verifies the organisation on %s rather than trusting it',
    async (operation) => {
      await expect(
        inPlatformOrganisation(() =>
          run({
            model: 'Patient',
            operation,
            args:
              operation === 'createMany'
                ? { data: [{ fullName: 'A', organisationId: OTHER }] }
                : { data: { fullName: 'A', organisationId: OTHER } },
          }),
        ),
      ).rejects.toThrow(CrossTenantWriteError);
    },
  );

  it('injects the organisation into a create that names none', async () => {
    const args = await inPlatformOrganisation(() =>
      run({ model: 'Patient', operation: 'create', args: { data: { fullName: 'A' } } }),
    );

    expect(args.data).toEqual({ fullName: 'A', organisationId: ORG });
  });

  it('refuses a model that is not a known tenant model, rather than passing it through', async () => {
    // A new model added to the schema and not to TENANT_MODELS would otherwise be readable
    // across clinics under this scope, with nothing to notice it.
    await expect(
      inPlatformOrganisation(() => run({ model: 'SomeNewModel', operation: 'findMany', args: {} })),
    ).rejects.toThrow(TenantScopeMissingError);
  });
});

describe('create shapes', () => {
  it('injects the organisation into create', async () => {
    const args = await inTenant(() =>
      run({ model: 'Patient', operation: 'create', args: { data: { fullName: 'X' } } }),
    );

    expect(args.data).toEqual({ fullName: 'X', organisationId: ORG });
  });

  it('injects into EVERY row of a createMany', async () => {
    // A single missed row in a batch would be the whole point of the lock defeated.
    const args = await inTenant(() =>
      run({
        model: 'Patient',
        operation: 'createMany',
        args: { data: [{ fullName: 'A' }, { fullName: 'B' }] },
      }),
    );

    expect(args.data).toEqual([
      { fullName: 'A', organisationId: ORG },
      { fullName: 'B', organisationId: ORG },
    ]);
  });

  it('rejects a createMany where ANY row names another organisation', async () => {
    await expect(
      inTenant(() =>
        run({
          model: 'Patient',
          operation: 'createMany',
          args: { data: [{ fullName: 'A' }, { fullName: 'B', organisationId: OTHER }] },
        }),
      ),
    ).rejects.toThrow(CrossTenantWriteError);
  });

  it('scopes both halves of an upsert', async () => {
    const args = await inTenant(() =>
      run({
        model: 'Patient',
        operation: 'upsert',
        args: { where: { id: 'pat-1' }, create: { fullName: 'New' }, update: { fullName: 'Old' } },
      }),
    );

    // An upsert that scoped the where but not the create could insert into another
    // organisation when the row happened not to exist.
    expect(args.where).toEqual({ id: 'pat-1', organisationId: ORG });
    expect(args.create).toEqual({ fullName: 'New', organisationId: ORG });
  });

  it('rejects an upsert whose create names another organisation', async () => {
    await expect(
      inTenant(() =>
        run({
          model: 'Patient',
          operation: 'upsert',
          args: {
            where: { id: 'pat-1' },
            create: { fullName: 'New', organisationId: OTHER },
            update: {},
          },
        }),
      ),
    ).rejects.toThrow(CrossTenantWriteError);
  });
});

describe('Organisation is scoped by primary key', () => {
  it('injects id when the caller gave none', async () => {
    const args = await inTenant(() =>
      run({ model: 'Organisation', operation: 'findMany', args: {} }),
    );

    expect(args.where).toEqual({ id: ORG });
  });

  it('adds the scope as a second condition when an id is supplied', async () => {
    const args = await inTenant(() =>
      run({ model: 'Organisation', operation: 'findUnique', args: { where: { id: OTHER } } }),
    );

    /**
     * STILL NOT REJECTED, and the reason has not changed: rule 7 requires a cross-tenant
     * read to answer NotFound, and an error that appears only for rows which exist is itself
     * a disclosure. What changed is HOW the empty answer is produced.
     *
     * This used to pass the id through untouched and rely on row-level security to return
     * nothing. That held while every cross-tenant read ran with row-level security ON.
     * `asOrganisationSystem` (D-017) sets `app.platform = 'on'`, which switches it off, and
     * a foreign id then returned the other clinic's row: measured against a real database,
     * not theorised. The `AND` makes a mismatch match nothing in the query itself, so the
     * answer no longer depends on which locks happen to be active.
     */
    expect(args.where).toEqual({ id: OTHER, AND: [{ id: ORG }] });
  });

  it('keeps a caller own AND conditions rather than replacing them', async () => {
    const args = await inTenant(() =>
      run({
        model: 'Organisation',
        operation: 'findFirst',
        args: { where: { id: ORG, AND: [{ name: { contains: 'Clinic' } }] } },
      }),
    );

    // Overwriting `AND` would silently widen a query the caller deliberately narrowed.
    expect(args.where).toEqual({
      id: ORG,
      AND: [{ name: { contains: 'Clinic' } }, { id: ORG }],
    });
  });

  it('accepts a single AND object as well as an array', async () => {
    const args = await inTenant(() =>
      run({
        model: 'Organisation',
        operation: 'findFirst',
        args: { where: { id: ORG, AND: { name: 'Test Clinic' } } },
      }),
    );

    // Prisma accepts either shape, so normalising to a list is what stops the object form
    // being dropped on the floor.
    expect(args.where).toEqual({ id: ORG, AND: [{ name: 'Test Clinic' }, { id: ORG }] });
  });

  it('does not inject organisationId into an Organisation create', async () => {
    const args = await inTenant(() =>
      run({ model: 'Organisation', operation: 'create', args: { data: { name: 'New Clinic' } } }),
    );

    // Organisation has no organisationId column; its primary key IS the tenant id.
    expect(args.data).toEqual({ name: 'New Clinic' });
  });
});

/**
 * A new query shape cannot slip past the extension unnoticed (Feature 3 review, I2 and I3).
 *
 * `updateManyAndReturn` was missing from the operation lists and so was passed on with no
 * injection, and a nested `connect` was never looked at. Both are refused now, and the two
 * lists these rules depend on are checked against what Prisma actually generates.
 */
describe('nothing reaches the database unclassified', () => {
  const generated = readFileSync(
    new URL('../generated/prisma/internal/prismaNamespace.ts', import.meta.url),
    'utf8',
  );
  const schema = readFileSync(new URL('../../prisma/schema.prisma', import.meta.url), 'utf8');

  /** The operations the generated client declares for one model, read from its type map. */
  const declaredOperations = (model: string): readonly string[] => {
    const start = generated.indexOf(`\n    ${model}: {\n`);
    const block = generated.slice(start, generated.indexOf('\n    }\n', start));
    const operations = block.slice(block.indexOf('operations: {'));
    return [...operations.matchAll(/^ {8}(\w+): \{$/gm)].map((match) => match[1] ?? '');
  };

  it('confines every operation the generated client declares', () => {
    const operations = declaredOperations('Patient');

    // A floor, so a parse that found nothing cannot pass vacuously.
    expect(operations.length).toBeGreaterThanOrEqual(17);
    expect(operations).toContain('updateManyAndReturn');

    for (const operation of operations) {
      expect(CONFINED_OPERATIONS, operation).toContain(operation);
    }
  });

  it('refuses an operation it does not know, on every confined scope', async () => {
    for (const scope of [inTenant, inPlatformOrganisation]) {
      await expect(
        scope(() => run({ model: 'Patient', operation: 'somethingNewFromPrisma', args: {} })),
      ).rejects.toThrow(/not an operation the tenant extension confines/);
    }
  });

  it('injects the scope into updateManyAndReturn', async () => {
    const seen = await inPlatformOrganisation(() =>
      run({
        model: 'Patient',
        operation: 'updateManyAndReturn',
        args: { where: { id: 'patient-of-another-clinic' }, data: { notes: null } },
      }),
    );

    expect(seen.where).toEqual({ id: 'patient-of-another-clinic', organisationId: ORG });
  });

  it.each([
    ['connect', { patient: { connect: { id: 'x' } } }],
    ['connectOrCreate', { patient: { connectOrCreate: { where: { id: 'x' }, create: {} } } }],
    ['a nested create', { items: { create: [{ name: 'x' }] } }],
    ['a nested update', { patient: { update: { fullName: 'x' } } }],
    ['a relation set', { items: { set: [{ id: 'x' }] } }],
  ])('refuses %s inside data, on every confined scope', async (_label, data) => {
    for (const scope of [inTenant, inPlatformOrganisation]) {
      await expect(
        scope(() => run({ model: 'Appointment', operation: 'update', args: { where: {}, data } })),
      ).rejects.toThrow(CrossTenantWriteError);
    }
  });

  it('refuses a nested write in either half of an upsert', async () => {
    const nested = { patient: { connect: { id: 'x' } } };

    for (const args of [
      { where: { id: 'a' }, create: { organisationId: ORG, ...nested }, update: {} },
      { where: { id: 'a' }, create: { organisationId: ORG }, update: nested },
    ]) {
      await expect(
        inPlatformOrganisation(() => run({ model: 'Appointment', operation: 'upsert', args })),
      ).rejects.toThrow(CrossTenantWriteError);
    }
  });

  it('still allows scalar operators, dates and JSON that happens to use the same words', async () => {
    const seen = await inTenant(() =>
      run({
        model: 'WebhookEvent',
        operation: 'update',
        args: {
          where: { id: 'e' },
          data: {
            attempts: { increment: 1 },
            status: { set: 'PROCESSED' },
            processedAt: new Date('2026-11-03T00:00:00.000Z'),
            // A provider payload stored as it arrived may contain any key at all.
            payload: { update: { anything: true }, create: [{ x: 1 }] },
          },
        },
      }),
    );

    expect(seen.data).toMatchObject({ attempts: { increment: 1 } });
  });

  it('leaves the unbounded platform scope alone, which row-level security does not confine either', async () => {
    const seen = await inPlatform(() =>
      run({
        model: 'Appointment',
        operation: 'update',
        args: { where: { id: 'a' }, data: { patient: { connect: { id: 'x' } } } },
      }),
    );

    expect(seen.data).toEqual({ patient: { connect: { id: 'x' } } });
  });

  it('knows exactly the schema’s Json fields, and no relation shares one of their names', () => {
    const models = [...schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)];
    const modelNames = new Set(models.map((match) => match[1]));
    const jsonFields = new Set<string>();
    const relationFields = new Set<string>();

    for (const [, , body] of models) {
      for (const line of (body ?? '').split('\n')) {
        const field = /^\s+(\w+)\s+(\w+)(\[\])?\??(\s|$)/.exec(line);
        if (field?.[1] === undefined || field[2] === undefined) {
          continue;
        }
        if (field[2] === 'Json') {
          jsonFields.add(field[1]);
        }
        if (modelNames.has(field[2])) {
          relationFields.add(field[1]);
        }
      }
    }

    expect(models.length).toBeGreaterThan(20);
    expect(relationFields.size).toBeGreaterThan(20);
    expect([...jsonFields].sort()).toEqual([...JSON_FIELDS].sort());
    expect([...relationFields].filter((name) => JSON_FIELDS.has(name))).toEqual([]);
  });
});
