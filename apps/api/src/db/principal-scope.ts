import { isPlatformRole, type Role } from '@clinicai/shared';
import { UnauthorizedError } from '../common/errors.js';
import { asSystem, withTenant, type TenantDb } from './tenant-client.js';

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
