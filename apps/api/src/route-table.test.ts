import { describe, expect, it } from 'vitest';
import type { Router } from 'express';
import { ROUTER_MOUNTS } from './app.js';
import { getRegisteredRoutes } from './common/route-registry.js';

/**
 * The route registry describes every route the application actually serves.
 *
 * WHY THIS TEST IS THE LOAD-BEARING ONE. Three guards walk `getRegisteredRoutes()`:
 * `tests/password-change-gate.test.ts` proves a temporary-password holder reaches nothing
 * but the four routes that lead out of that state, `tests/declared-permissions-are-enforced.test.ts`
 * proves every declared matrix cell is really checked, and `tests/phi-routes-are-audited.test.ts`
 * proves every PHI route writes an audit row. All three read a HAND-WRITTEN declaration.
 * `registerRoute` is a separate call from `router.get`, so a route mounted without one was
 * invisible to all three at once.
 *
 * That was not hypothetical. Adding `router.get('/shadow', requireAuth, requireUser, ...)`
 * to the auth router with no `registerRoute` call and no `requirePasswordChangeComplete`
 * left all 33 guard tests green, while a user holding an administrator-issued temporary
 * password received 200 from it and a correct 403 from `/api/v1/audit-logs`. Review
 * finding I2.
 *
 * This test removes the declaration from the trusted path. It asks Express what is mounted
 * and asserts set equality with what was declared, in both directions, so the three guards
 * above now cover every route rather than every route someone remembered to declare.
 *
 * IT RUNS IN THE `unit` PROJECT, with no database and no container, because building a
 * router neither opens a connection nor serves a request. Keeping it there means the whole
 * guarantee costs milliseconds and cannot be skipped for being slow.
 */

/** Every method and path a built router carries, as `METHOD /prefix/path`. */
const routesOf = (prefix: string, router: Router): string[] => {
  const found: string[] = [];

  const walk = (layers: readonly unknown[]): void => {
    for (const layer of layers) {
      const candidate = layer as {
        route?: { path?: unknown; methods?: Record<string, boolean> };
        handle?: { stack?: readonly unknown[] };
      };

      if (candidate.route !== undefined) {
        const path = typeof candidate.route.path === 'string' ? candidate.route.path : '';
        for (const [method, enabled] of Object.entries(candidate.route.methods ?? {})) {
          // Express adds a `_all` pseudo-method; it is not an HTTP method.
          if (enabled && method !== '_all') {
            // A router mounted at a prefix carries '/' for its own root.
            found.push(`${method.toUpperCase()} ${prefix}${path === '/' ? '' : path}`);
          }
        }
        continue;
      }

      // A nested router: recurse so a sub-router cannot hide a route from this walk.
      if (Array.isArray(candidate.handle?.stack)) {
        walk(candidate.handle.stack);
      }
    }
  };

  walk((router as unknown as { stack: readonly unknown[] }).stack);
  return found;
};

const mountedRoutes = (): string[] =>
  ROUTER_MOUNTS.flatMap(([prefix, build]) => routesOf(prefix, build())).sort();

const registeredRoutes = (): string[] =>
  getRegisteredRoutes()
    .map((route) => `${route.method.toUpperCase()} ${route.path}`)
    .sort();

describe('the route registry matches the routes Express actually serves', () => {
  it('declares every mounted route', () => {
    const undeclared = mountedRoutes().filter((route) => !registeredRoutes().includes(route));

    /**
     * If this fails, a route was mounted without a `registerRoute` call. It is therefore
     * absent from the first-login gate walk, the declared-permission check and the PHI
     * audit check, all three of which iterate the registry. Add the `registerRoute` call
     * next to the handler. Do not add the path to this test.
     */
    expect(undeclared, 'mounted but not registered').toEqual([]);
  });

  it('mounts every declared route', () => {
    const unmounted = registeredRoutes().filter((route) => !mountedRoutes().includes(route));

    /**
     * The other direction, which catches a stale declaration: a `registerRoute` left
     * behind after its handler was deleted or renamed. That would make the generated
     * OpenAPI advertise an endpoint that answers 404, and would let a guard "cover" a
     * route that does not exist while the real one goes unchecked.
     */
    expect(unmounted, 'registered but not mounted').toEqual([]);
  });

  it('finds the routes rather than trivially comparing two empty lists', () => {
    // Guards against the walk silently returning nothing, which would make both
    // assertions above pass for ever regardless of what is mounted.
    expect(mountedRoutes().length).toBeGreaterThan(0);
    expect(mountedRoutes()).toContain('POST /api/v1/auth/login');
  });
});
