import type { ZodType } from 'zod';

/**
 * In-memory catalogue of every route's zod schemas.
 *
 * M1-03 reads this to generate the OpenAPI document. Deliberately holds zod types and
 * nothing else: no OpenAPI library is a dependency of this module, so the registry
 * cannot drift towards one generator's data model.
 */

export type HttpMethod = 'get' | 'post' | 'patch' | 'put' | 'delete';

export type RouteSchemas = {
  readonly params?: ZodType;
  readonly query?: ZodType;
  readonly body?: ZodType;
  readonly response?: ZodType;
};

export type RouteDescriptor = RouteSchemas & {
  readonly method: HttpMethod;
  /** Path as registered on the router, e.g. `/api/v1/patients/:id`. */
  readonly path: string;
  readonly summary: string;
  /**
   * The matrix cell this route enforces, as `resource:action`, or omitted.
   *
   * ENFORCED, not descriptive. Four routes once declared a permission that nothing
   * checked, and two of them named a resource (`self`, `device`) that is not in the
   * matrix at all, so a reviewer could read a plausible string as a control that did not
   * exist. `tests/declared-permissions-are-enforced.test.ts` now fails unless the value
   * is a real matrix cell AND a real request proves that every granting role reaches the
   * route and every denied role gets a 403. Omit it when the route's control is something
   * other than the matrix, and say in a comment what that control is.
   */
  readonly permission?: string;
  /**
   * Whether the route reads or writes patient data. Drives the audit requirement and
   * marks the route for review; every route must state it explicitly.
   */
  readonly phiSensitive: boolean;
  /**
   * The audit action this route records. REQUIRED in practice for every phiSensitive
   * route: `phi-routes-are-audited.test.ts` fails the build when one is missing, so a
   * new PHI endpoint cannot ship without an audit trail.
   */
  readonly auditAction?: string;
};

const routes = new Map<string, RouteDescriptor>();

const keyOf = (method: HttpMethod, path: string): string => `${method.toUpperCase()} ${path}`;

/**
 * Registers a route. Throws on a duplicate method+path so two modules cannot silently
 * claim the same endpoint and leave the generated OpenAPI describing only one of them.
 */
export const registerRoute = (descriptor: RouteDescriptor): RouteDescriptor => {
  const key = keyOf(descriptor.method, descriptor.path);
  const existing = routes.get(key);

  if (existing !== undefined) {
    throw new Error(`Route already registered: ${key}`);
  }

  routes.set(key, descriptor);
  return descriptor;
};

/** Every registered route, sorted by path then method for a stable OpenAPI diff. */
export const getRegisteredRoutes = (): readonly RouteDescriptor[] =>
  [...routes.values()].sort(
    (a, b) => a.path.localeCompare(b.path) || a.method.localeCompare(b.method),
  );

export const findRegisteredRoute = (
  method: HttpMethod,
  path: string,
): RouteDescriptor | undefined => routes.get(keyOf(method, path));

/** Clears the registry. For tests only: route registration is otherwise append-only. */
export const resetRouteRegistry = (): void => {
  routes.clear();
};
