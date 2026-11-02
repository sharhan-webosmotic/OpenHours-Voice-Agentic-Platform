import { isPlatformRole } from '@clinicai/shared';
import { NotFoundError, ValidationError } from './errors.js';
import type { Principal } from './permissions.js';

/**
 * Which clinic a request is about, decided once for every tenant-addressed endpoint.
 *
 * THE RULE, AND WHY IT IS NOT "READ IT FROM THE REQUEST":
 *
 *  - A CLINIC ROLE's organisation comes from the verified token and nowhere else (root
 *    CLAUDE.md rule 2). If such a caller also names one, the two must agree. A mismatch
 *    answers 404, never 403, because a 403 would confirm that the clinic they named exists
 *    (rule 7).
 *  - A PLATFORM ROLE has no organisation of its own, and the matrix still grants it a
 *    masked read of patients and appointments. It therefore has to name the clinic it is
 *    asking about. A platform read with no clinic named is a 400 that says so, rather than
 *    every clinic's rows in one response.
 *
 * WHY A 400 RATHER THAN A DEFAULT. `asSystem` injects no organisation filter, so an absent
 * id would mean "no filter" to every query underneath. The one thing this must never do is
 * fail open.
 */
export const organisationInScope = (
  principal: Principal,
  requested: string | undefined,
): string => {
  if (isPlatformRole(principal.role)) {
    if (requested === undefined) {
      throw new ValidationError(
        'platform principal did not name an organisation',
        'Name the clinic this request is about.',
        [{ field: 'query.organisationId', message: 'is required for a platform role' }],
      );
    }

    return requested;
  }

  if (principal.organisationId === undefined) {
    // A clinic role with no organisation cannot be issued a token: the users table has a
    // CHECK constraint requiring one. Refused rather than silently widened.
    throw new NotFoundError(
      'clinic principal without an organisation',
      'That clinic was not found.',
    );
  }

  if (requested !== undefined && requested !== principal.organisationId) {
    throw new NotFoundError(
      `principal asked about organisation ${requested} from outside it`,
      'That clinic was not found.',
    );
  }

  return principal.organisationId;
};
