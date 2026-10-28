import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { withPrincipalScope } from '../src/db/principal-scope.js';
import { UnauthorizedError } from '../src/common/errors.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';
import { uuidV7 } from '../src/common/uuid.js';

/**
 * The scope helper every /api/v1/admin route in M1-11 will use.
 *
 * Worth testing on its own because the bug it exists to prevent was invisible: a route
 * gated on tenantMiddleware refuses a platform role with a 401 that looks like an
 * authentication problem rather than a wiring mistake.
 */

let orgA: OrganisationGraph;
let orgB: OrganisationGraph;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    orgA = await createOrganisationGraph(tx, 'ScopeA');
    orgB = await createOrganisationGraph(tx, 'ScopeB');
  });
}, 120_000);

afterAll(async () => {
  await disconnectAll();
});

describe('withPrincipalScope', () => {
  it('confines a clinic role to its own organisation', async () => {
    const ids = await withPrincipalScope(
      { userId: uuidV7(), role: 'CLINIC_OWNER', organisationId: orgA.organisationId },
      'test.clinic',
      (db) => db.organisation.findMany({ select: { id: true } }),
    );

    expect(ids.map((o) => o.id)).toEqual([orgA.organisationId]);
  });

  it('lets a platform role see across organisations', async () => {
    const ids = await withPrincipalScope(
      { userId: uuidV7(), role: 'SUPER_ADMIN', organisationId: undefined },
      'test.platform',
      (db) =>
        db.organisation.findMany({
          where: { id: { in: [orgA.organisationId, orgB.organisationId] } },
          select: { id: true },
        }),
    );

    // The case tenantMiddleware made impossible: a platform role has no organisation,
    // so a tenant-gated route refused it entirely.
    expect(ids).toHaveLength(2);
  });

  it('records the platform scope use, so a cross-tenant read is never silent', async () => {
    const before = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.count({ where: { action: 'system.scope.used' } }),
    );

    await withPrincipalScope(
      { userId: uuidV7(), role: 'INTERNAL_ADMIN', organisationId: undefined },
      'test.platform.audited',
      (db) => db.organisation.count(),
    );

    const after = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.count({ where: { action: 'system.scope.used' } }),
    );

    expect(after).toBeGreaterThan(before);
  });

  it('refuses a clinic role with no organisation rather than widening it', async () => {
    // Cannot arise from a verified token, since the users CHECK constraint requires an
    // organisation for clinic roles. Refused rather than quietly granted platform reach.
    await expect(
      withPrincipalScope(
        { userId: uuidV7(), role: 'STAFF', organisationId: undefined },
        'test.invalid',
        (db) => db.organisation.count(),
      ),
    ).rejects.toThrow(UnauthorizedError);
  });
});
