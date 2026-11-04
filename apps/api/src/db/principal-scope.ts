import { isPlatformRole, type Role } from '@clinicai/shared';
import { NotFoundError, UnauthorizedError } from '../common/errors.js';
import { asOrganisationSystem, asSystem, withTenant, type TenantDb } from './tenant-client.js';

/**
 * Runs `fn` under whichever database scope the principal's role actually has.
 *
 * This exists because gating a route on `tenantMiddleware` is wrong for any endpoint a
 * platform role may call. That middleware requires an organisation in context, and
 * SUPER_ADMIN and INTERNAL_ADMIN have none, so such a route refuses them outright even
 * when the permission matrix grants the action. That is exactly what happened to
 * GET /api/v1/audit-logs, and every /api/v1/admin route in M1-11 is the same shape.
 *
 *  - A clinic role runs inside `withTenant`, so row-level security and the client
 *    extension confine it to its own organisation.
 *  - A platform role runs inside `asSystem`, which is deliberately cross-tenant and
 *    records the use of that scope, so a platform read is never silent.
 *
 * It decides WHERE the query may look, never WHETHER the caller may run it. The
 * permission check stays in the service layer and must happen first: calling this
 * without `requirePermission` would hand a platform role cross-tenant access purely
 * because of its role.
 */
export type ScopedPrincipal = {
  readonly userId: string;
  readonly role: Role;
  readonly organisationId: string | undefined;
};

/**
 * Runs `fn` against ONE organisation, whichever kind of principal is asking.
 *
 * Use this, not `withPrincipalScope`, for anything tenant-addressed. The difference is the
 * one that matters for isolation: `withPrincipalScope` hands a platform role UNBOUNDED
 * cross-tenant scope, where nothing is injected and confinement depends on every repository
 * function filtering by hand. This one names the organisation, so the extension injects it
 * and a missing filter cannot return another clinic's rows.
 *
 * `withPrincipalScope` remains for the paths that genuinely have no single organisation: the
 * clinic LIST, login, provider resolution and jobs.
 */
export const withOrganisationScope = async <T>(
  principal: ScopedPrincipal,
  organisationId: string,
  reason: string,
  fn: (db: TenantDb) => Promise<T>,
): Promise<T> => {
  if (isPlatformRole(principal.role)) {
    return asOrganisationSystem(reason, organisationId, fn);
  }

  if (principal.organisationId !== organisationId) {
    /**
     * A clinic principal may only ever be scoped to its own organisation.
     *
     * Reaching this means a caller resolved the organisation from something other than the
     * token, which is rule 2, so it fails closed rather than opening a scope. The service
     * layer resolves it through `organisationInScope`, which answers 404 first.
     */
    throw new UnauthorizedError(
      'clinic principal scoped to another organisation',
      'Authentication is required.',
    );
  }

  return withTenant({ organisationId }, fn);
};

export const withPrincipalScope = async <T>(
  principal: ScopedPrincipal,
  reason: string,
  fn: (db: TenantDb) => Promise<T>,
): Promise<T> => {
  if (isPlatformRole(principal.role)) {
    return asSystem(reason, fn);
  }

  if (principal.organisationId === undefined) {
    // A clinic role with no organisation cannot happen through a verified token: the
    // users CHECK constraint requires one. Refused rather than silently widened.
    throw new UnauthorizedError(
      'clinic role without an organisation',
      'Authentication is required.',
    );
  }

  return withTenant({ organisationId: principal.organisationId }, fn);
};

/**
 * One clinic named by the request path: the platform-organisation scope for a platform role
 * (D-017), the caller's own tenant scope for a clinic role.
 *
 * It differs from `withOrganisationScope` only in what a clinic principal naming ANOTHER
 * clinic gets. There the organisation comes from something the server derived, so a mismatch
 * is a defect and is refused as one. Here it comes from the URL, which the caller controls, so
 * a mismatch is an ordinary request for something they cannot see and answers 404, the same
 * as an id that does not exist (root CLAUDE.md rule 7).
 */
export const withClinicScope = async <T>(
  principal: ScopedPrincipal,
  organisationId: string,
  reason: string,
  fn: (db: TenantDb) => Promise<T>,
): Promise<T> => {
  if (!isPlatformRole(principal.role) && principal.organisationId !== organisationId) {
    throw new NotFoundError(
      `organisation ${organisationId} is not reachable by this principal`,
      'That clinic was not found.',
    );
  }

  return withOrganisationScope(principal, organisationId, reason, fn);
};
