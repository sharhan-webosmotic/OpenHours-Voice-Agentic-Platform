import { beforeEach, describe, expect, it } from 'vitest';
import { z } from 'zod';
import {
  findRegisteredRoute,
  getRegisteredRoutes,
  registerRoute,
  resetRouteRegistry,
} from './route-registry.js';

const descriptor = {
  method: 'get',
  path: '/api/v1/patients/:id',
  summary: 'Fetch a patient',
  permission: 'patient:read',
  phiSensitive: true,
  params: z.object({ id: z.string().uuid() }),
  response: z.object({ id: z.string() }),
} as const;

describe('route registry', () => {
  beforeEach(() => {
    resetRouteRegistry();
  });

  it('registers a route and finds it again', () => {
    registerRoute(descriptor);

    expect(findRegisteredRoute('get', '/api/v1/patients/:id')).toMatchObject({
      summary: 'Fetch a patient',
      permission: 'patient:read',
      phiSensitive: true,
    });
  });

  it('keeps the zod schemas so M1-03 can generate OpenAPI from them', () => {
    registerRoute(descriptor);

    const params = findRegisteredRoute('get', '/api/v1/patients/:id')?.params;

    expect(params?.safeParse({ id: '0189d7f1-9b3a-4c2e-8f1a-2b3c4d5e6f70' }).success).toBe(true);
    expect(params?.safeParse({ id: 'nope' }).success).toBe(false);
  });

  it('rejects a duplicate method and path', () => {
    registerRoute(descriptor);

    // Two modules silently claiming one endpoint would leave the generated document
    // describing only whichever registered last.
    expect(() => registerRoute(descriptor)).toThrow(/already registered/);
  });

  it('allows the same path under a different method', () => {
    registerRoute(descriptor);
    registerRoute({ ...descriptor, method: 'patch', summary: 'Update a patient' });

    expect(getRegisteredRoutes()).toHaveLength(2);
  });

  it('returns routes in a stable order so the OpenAPI diff is reviewable', () => {
    registerRoute({ ...descriptor, method: 'get', path: '/api/v1/zeta' });
    registerRoute({ ...descriptor, method: 'post', path: '/api/v1/alpha' });
    registerRoute({ ...descriptor, method: 'get', path: '/api/v1/alpha' });

    expect(getRegisteredRoutes().map((r) => `${r.method} ${r.path}`)).toEqual([
      'get /api/v1/alpha',
      'post /api/v1/alpha',
      'get /api/v1/zeta',
    ]);
  });

  it('requires phiSensitive to be stated', () => {
    registerRoute({ ...descriptor, path: '/api/v1/services', phiSensitive: false });

    expect(findRegisteredRoute('get', '/api/v1/services')?.phiSensitive).toBe(false);
  });
});
