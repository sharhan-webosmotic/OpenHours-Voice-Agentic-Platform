import { describe, expect, it } from 'vitest';
import { buildTenantExtension } from './tenant-extension.js';
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

  it('leaves a supplied id alone so a foreign lookup becomes NotFound', async () => {
    const args = await inTenant(() =>
      run({ model: 'Organisation', operation: 'findUnique', args: { where: { id: OTHER } } }),
    );

    // Not rejected: rule 7 requires a cross-tenant read to answer NotFound, and an
    // error that only appears for rows which exist is itself a disclosure. The query
    // goes to the database and row-level security returns nothing.
    expect(args.where).toEqual({ id: OTHER });
  });

  it('does not inject organisationId into an Organisation create', async () => {
    const args = await inTenant(() =>
      run({ model: 'Organisation', operation: 'create', args: { data: { name: 'New Clinic' } } }),
    );

    // Organisation has no organisationId column; its primary key IS the tenant id.
    expect(args.data).toEqual({ name: 'New Clinic' });
  });
});
