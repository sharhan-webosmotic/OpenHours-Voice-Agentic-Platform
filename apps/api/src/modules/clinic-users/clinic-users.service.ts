import type { CreateClinicOwnerInput } from '@clinicai/shared';
import { ConflictError, NotFoundError } from '../../common/errors.js';
import { hashPassword } from '../../common/passwords.js';
import { requirePermission, type Principal } from '../../common/permissions.js';
import { logger } from '../../common/logger.js';
import { withClinicScope } from '../../db/principal-scope.js';
import { record } from '../audit/audit.service.js';
import {
  findOrganisationById,
  uniqueViolationTarget,
} from '../organisations/organisations.repository.js';
import { createClinicUser } from './clinic-users.repository.js';
import { temporaryPassword } from './temporary-password.js';

export type CreatedClinicOwner = {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  /** Returned to the caller exactly once. Stored only as an argon2 hash, never logged. */
  readonly temporaryPassword: string;
};

/**
 * Creates a CLINIC_OWNER login for one clinic, with a temporary password shown once.
 *
 * THE SAME PATH AS `pnpm provision:clinic`: the password comes from the same generator, is
 * hashed by the same `hashPassword`, and the row is built by the same `clinicUserRow`, with
 * `mustChangePassword` set so the first sign-in has to replace it (D-003). The plaintext is
 * returned in this one response and exists nowhere else: not in the audit row, not in the log.
 *
 * GOVERNED BY `clinic_users`, the matrix cell for creating a clinic's logins, which grants the
 * two platform roles that may use the rest of this page. Run under the clinic's own scope, so
 * the user cannot be written to any organisation but the one in the URL.
 */
export const createClinicOwner = async (
  principal: Principal,
  organisationId: string,
  input: CreateClinicOwnerInput,
): Promise<CreatedClinicOwner> => {
  requirePermission('clinic_users', 'write', principal);

  const password = temporaryPassword();
  // Hashed before the transaction opens: argon2 at the pinned cost would otherwise hold it.
  const passwordHash = await hashPassword(password);

  return withClinicScope(principal, organisationId, 'clinic_users.create_owner', async (db) => {
    if ((await findOrganisationById(db, organisationId)) === null) {
      throw new NotFoundError(
        `organisation ${organisationId} is not reachable by this principal`,
        'That clinic was not found.',
      );
    }

    let userId: string;
    try {
      userId = await createClinicUser(db, {
        organisationId,
        email: input.email,
        fullName: input.fullName,
        role: 'CLINIC_OWNER',
        passwordHash,
        mustChangePassword: true,
      });
    } catch (error) {
      if (uniqueViolationTarget(error) !== undefined) {
        throw new ConflictError(
          'clinic owner email already in use',
          'An account with that email address already exists.',
        );
      }
      throw error;
    }

    await record(db, {
      organisationId,
      action: 'clinic_user.created',
      entityType: 'user',
      entityId: userId,
      // The role and the handover state only. Never the password, its hash or the email.
      metadata: { role: 'CLINIC_OWNER', mustChangePassword: true },
    });

    logger.info({ organisationId, userId }, 'clinic owner created');

    return { userId, email: input.email, fullName: input.fullName, temporaryPassword: password };
  });
};
