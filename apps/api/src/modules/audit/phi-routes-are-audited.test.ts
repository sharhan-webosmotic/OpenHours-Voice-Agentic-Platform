import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.js';
import { getRegisteredRoutes } from '../../common/route-registry.js';

/**
 * The guard the ticket asks for: a route flagged as PHI-sensitive must declare the audit
 * action it records.
 *
 * Importing the app is what registers the routes, so this runs against the real surface
 * rather than a list someone maintains. A new PHI endpoint added without an audit action
 * fails the build here, which is the only point at which anyone is still thinking about
 * it. Root CLAUDE.md rule 5: sensitive reads and writes call audit.record.
 */
createApp({ readiness: () => Promise.resolve() });

describe('every PHI-sensitive route is audited', () => {
  const routes = getRegisteredRoutes();

  it('found the registered routes', () => {
    expect(routes.length).toBeGreaterThan(0);
  });

  it('declares phiSensitive explicitly on every route', () => {
    // Optional would default to "not sensitive", which is the wrong default for a
    // product whose whole surface is near patient data.
    for (const route of routes) {
      expect(typeof route.phiSensitive).toBe('boolean');
    }
  });

  it('gives every PHI-sensitive route an audit action', () => {
    const unaudited = routes
      .filter((route) => route.phiSensitive)
      .filter((route) => route.auditAction === undefined || route.auditAction.length === 0)
      .map((route) => `${route.method.toUpperCase()} ${route.path}`);

    expect(unaudited).toEqual([]);
  });

  it('does not require an audit action on a route that touches no PHI', () => {
    // The guard must not push teams into fake audit entries on, say, a login route,
    // which is audited by the auth module rather than by a route wrapper.
    const nonPhi = routes.filter((route) => !route.phiSensitive);
    expect(nonPhi.length).toBeGreaterThan(0);
  });
});
