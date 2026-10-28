import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  ACTIONS,
  RESOURCES,
  ROLES,
  isPlatformRole,
  permissionScope,
  type Action,
  type Resource,
  type Role,
} from '@openhours/shared';
import { createApp } from '../src/app.js';
import { getRegisteredRoutes, type RouteDescriptor } from '../src/common/route-registry.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * A route that declares a permission must enforce it, for every role.
 *
 * The `permission` field on a route descriptor used to be decorative: nothing read it,
 * `requirePermission` had one caller, and four routes declared a permission they never
 * checked. Two of those named a resource (`self`, `device`) that is not in the matrix at
 * all. The failure mode is a reviewer reading a plausible string as enforcement, which is
 * the mechanism behind the audit-log defect, and M1-11 was about to copy the pattern
 * across every admin endpoint.
 *
 * Those four declarations are gone. This guard keeps the remaining ones honest, and it is
 * also the answer to the review's 64 untested matrix cells: it will not stop that gap
 * existing, but a NEW route cannot add to it, because declaring a permission now requires
 * a recipe and the recipe is checked against the matrix for all six roles.
 *
 * The granted and denied role sets are DERIVED from the shared matrix rather than listed
 * here. A test that hand-lists them would just be a second transcription of the table and
 * would agree with a wrong one.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let org: OrganisationGraph;
const emailByRole = new Map<Role, string>();

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'DeclaredPerms');

    for (const role of ROLES) {
      const email = `perm.${role.toLowerCase()}.${Date.now()}@test.invalid`;
      emailByRole.set(role, email);

      await tx.user.create({
        data: {
          id: uuidV7(),
          // A platform role belongs to no organisation; a clinic role must have one.
          organisationId: isPlatformRole(role) ? null : org.organisationId,
          email,
          passwordHash,
          fullName: `Perm ${role}`,
          role,
          status: 'ACTIVE',
        },
      });
    }
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const keyOf = (route: RouteDescriptor): string => `${route.method.toUpperCase()} ${route.path}`;

const tokenFor = async (role: Role): Promise<string> => {
  const email = emailByRole.get(role);
  if (email === undefined) {
    throw new Error(`no fixture user for ${role}`);
  }
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return jsonBody<{ accessToken: string }>(response).accessToken;
};

/** Drives one route as the holder of `token`, and returns the status. */
const RECIPES = new Map<string, (token: string) => Promise<number>>([
  [
    'GET /api/v1/audit-logs',
    async (token) => {
      const response = await request(app)
        .get('/api/v1/audit-logs')
        .set('Authorization', `Bearer ${token}`);
      return response.status;
    },
  ],
]);

const parsePermission = (
  value: string,
): { readonly resource: Resource; readonly action: Action } | undefined => {
  const [resource, action, ...rest] = value.split(':');
  if (rest.length > 0 || resource === undefined || action === undefined) {
    return undefined;
  }
  if (!(RESOURCES as readonly string[]).includes(resource)) {
    return undefined;
  }
  if (!(ACTIONS as readonly string[]).includes(action)) {
    return undefined;
  }
  return { resource: resource as Resource, action: action as Action };
};

describe('every declared route permission is a real matrix cell and is enforced', () => {
  const declaring = getRegisteredRoutes().filter((route) => route.permission !== undefined);

  it('found at least one route declaring a permission', () => {
    expect(declaring.length).toBeGreaterThan(0);
  });

  it('declares only permissions that exist in the shared matrix', () => {
    const invalid = declaring
      .filter((route) => parsePermission(route.permission ?? '') === undefined)
      .map((route) => `${keyOf(route)} declares ${String(route.permission)}`);

    // `self:update` and `device:create` failed exactly here: neither resource exists.
    expect(invalid).toEqual([]);
  });

  it('has a recipe for every route declaring a permission', () => {
    const withoutRecipe = declaring.filter((route) => !RECIPES.has(keyOf(route))).map(keyOf);

    // If this fails, add a recipe below that drives the new route with a bearer token.
    // Removing the `permission` field instead is correct ONLY if the route genuinely is
    // not gated by the matrix, and then the comment must say what gates it.
    expect(withoutRecipe).toEqual([]);
  });

  it('has no recipe for a route that no longer declares a permission', () => {
    const declared = new Set(declaring.map(keyOf));
    expect([...RECIPES.keys()].filter((key) => !declared.has(key))).toEqual([]);
  });

  for (const route of getRegisteredRoutes().filter(
    (candidate) => candidate.permission !== undefined,
  )) {
    const key = keyOf(route);

    it(`${key} enforces ${String(route.permission)} for all ${ROLES.length} roles`, async () => {
      const drive = RECIPES.get(key);
      const cell = parsePermission(route.permission ?? '');

      expect(drive).toBeDefined();
      expect(cell).toBeDefined();
      if (drive === undefined || cell === undefined) {
        return;
      }

      const wrong: string[] = [];

      for (const role of ROLES) {
        const scope = permissionScope(role, cell.resource, cell.action);
        const status = await drive(await tokenFor(role));

        if (scope === false) {
          // Denied by the matrix, so the route must refuse. 403 specifically: the
          // resource is not tenant-addressed, so there is nothing to conceal with a 404.
          if (status !== 403) {
            wrong.push(`${role} is denied by the matrix but got ${status}, expected 403`);
          }
          continue;
        }

        // Granted. The status may legitimately be anything that is not a refusal, so
        // this asserts only that the permission check did not reject it.
        if (status === 403) {
          wrong.push(`${role} is granted "${scope}" by the matrix but got 403`);
        }
      }

      expect(wrong).toEqual([]);
    }, 120_000);
  }
});
