import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { getRegisteredRoutes, type RouteDescriptor } from '../src/common/route-registry.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * Every PHI-sensitive route must actually WRITE the audit row it declares.
 *
 * The earlier version of this guard read the route descriptor and asserted that
 * `auditAction` was a non-empty string. Declaring one was therefore sufficient to satisfy
 * it, and the only PHI-flagged endpoint that shipped declared an action and recorded
 * nothing. A reviewer deleted the one real `audit.record` call in the application and this
 * file still passed 4 of 4.
 *
 * So the guard drives each route for real and asserts the row appears. The recipe table is
 * the part that keeps it honest: a new PHI route with no recipe fails, which is the only
 * moment anyone is still thinking about its audit trail. Writing a recipe is deliberately
 * cheaper than arguing with the test.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let org: OrganisationGraph;
let ownerEmail: string;
let ownerUserId: string;
let superAdminEmail: string;
let superAdminUserId: string;

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'PhiAudit');
    ownerEmail = `phi.audit.owner.${Date.now()}@test.invalid`;
    ownerUserId = uuidV7();
    superAdminEmail = `phi.audit.super.${Date.now()}@test.invalid`;
    superAdminUserId = uuidV7();

    await tx.user.create({
      data: {
        id: ownerUserId,
        organisationId: org.organisationId,
        email: ownerEmail,
        passwordHash,
        fullName: 'Phi Audit Owner',
        role: 'CLINIC_OWNER',
        status: 'ACTIVE',
      },
    });
    await tx.user.create({
      data: {
        id: superAdminUserId,
        organisationId: null,
        email: superAdminEmail,
        passwordHash,
        fullName: 'Phi Audit Super',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const keyOf = (route: RouteDescriptor): string => `${route.method.toUpperCase()} ${route.path}`;

const loginAs = async (email: string): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return jsonBody<{ accessToken: string }>(response).accessToken;
};

/** Audit rows for one action, attributed to one actor. Read as owner, past every policy. */
const auditRowCount = async (action: string, actorUserId: string): Promise<number> =>
  asPlatform(ownerClient(), (tx) => tx.auditLog.count({ where: { action, actorUserId } }));

/**
 * The outcome of driving one route: the status, and WHO the audit row should name. The
 * actor is part of the recipe because the two PHI routes need different roles, and
 * asserting on the actor is what stops an unrelated row from satisfying the test.
 */
type Driven = {
  readonly status: number;
  readonly actorUserId: string;
};

/**
 * How to drive each PHI-sensitive route, keyed exactly as the registry names it. Each
 * recipe makes one real request through the whole middleware chain.
 */
const RECIPES = new Map<string, () => Promise<Driven>>([
  [
    'GET /api/v1/audit-logs',
    async () => {
      const token = await loginAs(ownerEmail);
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      return { status: response.status, actorUserId: ownerUserId };
    },
  ],
  [
    'POST /api/v1/support-sessions',
    async () => {
      // Only a platform role may open one, so the clinic owner above cannot drive this.
      const token = await loginAs(superAdminEmail);
      const response = await request(app)
        .post('/api/v1/support-sessions')
        .set('Authorization', `Bearer ${token}`)
        .send({
          organisationId: org.organisationId,
          reason: 'Driving the PHI audit guard against a real request.',
        });
      return { status: response.status, actorUserId: superAdminUserId };
    },
  ],
]);

describe('every PHI-sensitive route is audited', () => {
  const routes = getRegisteredRoutes();
  const phiRoutes = routes.filter((route) => route.phiSensitive);

  it('found the registered routes', () => {
    expect(routes.length).toBeGreaterThan(0);
    expect(phiRoutes.length).toBeGreaterThan(0);
  });

  it('declares phiSensitive explicitly on every route', () => {
    // Optional would default to "not sensitive", which is the wrong default for a
    // product whose whole surface is near patient data.
    for (const route of routes) {
      expect(typeof route.phiSensitive).toBe('boolean');
    }
  });

  it('gives every PHI-sensitive route an audit action', () => {
    const unaudited = phiRoutes
      .filter((route) => route.auditAction === undefined || route.auditAction.length === 0)
      .map(keyOf);

    expect(unaudited).toEqual([]);
  });

  it('has a recipe for every PHI-sensitive route, so none can ship unproven', () => {
    const withoutRecipe = phiRoutes.filter((route) => !RECIPES.has(keyOf(route))).map(keyOf);

    // If this fails, add a recipe above that drives the new route. Do not delete the
    // route from the list: that is how the defect this guard exists for got in.
    expect(withoutRecipe).toEqual([]);
  });

  it('has no recipe for a route that no longer exists', () => {
    const registered = new Set(phiRoutes.map(keyOf));
    const stale = [...RECIPES.keys()].filter((key) => !registered.has(key));

    expect(stale).toEqual([]);
  });

  it('does not require an audit action on a route that touches no PHI', () => {
    // The guard must not push teams into fake audit entries on, say, a login route,
    // which is audited by the auth module rather than by a route wrapper.
    expect(routes.filter((route) => !route.phiSensitive).length).toBeGreaterThan(0);
  });

  for (const route of getRegisteredRoutes().filter((candidate) => candidate.phiSensitive)) {
    const key = keyOf(route);

    it(`${key} writes its declared audit row when driven`, async () => {
      const drive = RECIPES.get(key);
      const action = route.auditAction;

      // Both are asserted by their own tests above; these keep this one honest rather
      // than silently passing on a missing recipe.
      expect(drive).toBeDefined();
      expect(action).toBeDefined();
      if (drive === undefined || action === undefined) {
        return;
      }

      const driven = await drive();
      const before = await auditRowCount(action, driven.actorUserId);
      const again = await drive();
      const after = await auditRowCount(action, again.actorUserId);

      expect(driven.status).toBeLessThan(400);
      expect(again.status).toBeLessThan(400);
      // The row, attributed to the actor who made the request. A route that declares an
      // action and records nothing fails here, which the descriptor check could not see.
      expect(after).toBe(before + 1);
    }, 60_000);
  }
});
