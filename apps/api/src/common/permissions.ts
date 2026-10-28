import {
  isRole,
  permissionScope,
  type Action,
  type Resource,
  type Role,
  type Scope,
} from '@openhours/shared';
import { ForbiddenError, UnauthorizedError } from './errors.js';
import { getContext } from './request-context.js';

/**
 * Permission enforcement, for the SERVICE layer.
 *
 * Hiding a control in the UI is never the control (root CLAUDE.md rule 3), and a check
 * in a controller is too late to protect anything a service does on another path.
 *
 * The role comes from the request context, which is populated only from a verified
 * token, so nothing a client sends can influence the decision.
 */

export type Principal = {
  readonly userId: string;
  readonly role: Role;
  readonly organisationId: string | undefined;
};

export const currentPrincipal = (): Principal => {
  const context = getContext();

  if (context?.userId === undefined || context.role === undefined) {
    throw new UnauthorizedError('no authenticated principal', 'Authentication is required.');
  }

  /**
   * Checked, not cast. The context holds `role` as a string because it comes from a token
   * claim, and an `as Role` here asserted something nothing had verified. The verifier
   * already refuses an unrecognised claim, so reaching this is a bug rather than an
   * attack, and it fails closed as a 401 instead of a TypeError deeper in the matrix.
   */
  if (!isRole(context.role)) {
    throw new UnauthorizedError(
      `unrecognised role on principal: ${context.role}`,
      'Authentication is required.',
    );
  }

  return {
    userId: context.userId,
    role: context.role,
    organisationId: context.organisationId,
  };
};

/**
 * Asserts the permission and RETURNS ITS SCOPE.
 *
 * Returning the scope is the point: a caller that ignores it and treats the call as a
 * boolean gate would give a doctor every patient in the clinic rather than their own.
 * The scope has to be applied to the query, and handing it back makes forgetting
 * visible at the call site.
 */
export const requirePermission = (
  resource: Resource,
  action: Action,
  principal: Principal = currentPrincipal(),
): Scope => {
  const scope = permissionScope(principal.role, resource, action);

  if (scope === false) {
    // Not NotFound: the resource is not tenant-addressed here, so there is nothing to
    // conceal by pretending it is absent. Cross-tenant ids are the case that returns
    // NotFound, and that is handled by the tenant client.
    throw new ForbiddenError(
      `${principal.role} may not ${action} ${resource}`,
      'You do not have permission to do that.',
    );
  }

  return scope;
};

/** Patient-identifying fields, nulled for a platform role with no support session. */
export const MASKED_PATIENT_FIELDS = [
  'fullName',
  'phone',
  'dateOfBirth',
  'notes',
  'transcript',
] as const;

export type MaskablePatient = Record<string, unknown>;

/**
 * Nulls patient-identifying fields.
 *
 * Applied when the scope is `masked` and no support session is active. The row is still
 * returned, because a platform admin legitimately needs to see that an appointment
 * exists in order to diagnose a booking problem; what they do not need is who it is for.
 */
export const maskPatientFields = <T extends MaskablePatient>(row: T): T => {
  const masked: MaskablePatient = { ...row };
  for (const field of MASKED_PATIENT_FIELDS) {
    if (field in masked) {
      masked[field] = null;
    }
  }
  return masked as T;
};

/**
 * Resolves what a `masked` scope means for this request.
 *
 * A support session unmasks ONE organisation, never all of them, so the organisation
 * being read has to be passed in.
 */
export const shouldMask = (scope: Scope, hasActiveSupportSession: boolean): boolean =>
  scope === 'masked' && !hasActiveSupportSession;

/**
 * The extra `where` a scope implies, as a filter the repository merges in.
 *
 * `own` and `assigned` are not advisory: without these clauses a doctor would read the
 * whole clinic. Returning a filter rather than a boolean keeps the obligation in the
 * type.
 */
export type ScopeFilter =
  | { readonly kind: 'none' }
  | { readonly kind: 'own-doctor'; readonly doctorUserId: string }
  | { readonly kind: 'assigned-user'; readonly userId: string }
  | { readonly kind: 'denied-without-opt-in' };

export const scopeFilter = (scope: Scope, principal: Principal): ScopeFilter => {
  switch (scope) {
    case 'own':
      return { kind: 'own-doctor', doctorUserId: principal.userId };
    case 'assigned':
      return { kind: 'assigned-user', userId: principal.userId };
    case 'clinic_opt_in':
      // The caller must check the clinic setting; until then this is a denial, so
      // forgetting the check fails closed.
      return { kind: 'denied-without-opt-in' };
    default:
      return { kind: 'none' };
  }
};
