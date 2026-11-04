import { UserStatus, type Role } from '../../generated/prisma/enums.js';
import type { TenantDb } from '../../db/tenant-client.js';
import { uuidV7 } from '../../common/uuid.js';

/**
 * Clinic logins.
 *
 * `clinicUserRow` is the one shape a new clinic user is written in, used by
 * `pnpm provision:clinic` and by the admin console's "create clinic owner" alike, so an account
 * made one way cannot differ from one made the other: neither can forget
 * `mustChangePassword` or the status.
 */

export type ClinicUserInput = {
  readonly organisationId: string;
  readonly email: string;
  readonly fullName: string;
  readonly role: Role;
  /** An argon2 hash. The plaintext never reaches this module. */
  readonly passwordHash: string;
  /**
   * True for every account a person will sign in to. False only for the browser suites'
   * ready accounts, which `provision:clinic` alone may create (see its `readyPassword`).
   */
  readonly mustChangePassword: boolean;
};

/** The row for a new clinic user, as every caller writes it. */
export const clinicUserRow = (input: ClinicUserInput) => ({
  id: uuidV7(),
  organisationId: input.organisationId,
  email: input.email,
  passwordHash: input.passwordHash,
  fullName: input.fullName,
  role: input.role,
  status: UserStatus.ACTIVE,
  mustChangePassword: input.mustChangePassword,
});

/** Creates the user and returns its id. A taken email surfaces as Prisma's P2002. */
export const createClinicUser = async (db: TenantDb, input: ClinicUserInput): Promise<string> => {
  const row = clinicUserRow(input);
  await db.user.create({ data: row, select: { id: true } });
  return row.id;
};
