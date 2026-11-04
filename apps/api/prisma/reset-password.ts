import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
// The same generator as every other handover password: CSPRNG, readable alphabet.
import { temporaryPassword } from '../src/modules/clinic-users/temporary-password.js';
import { isLocalDatabase } from './provision-clinic.js';

/**
 * Resets one user's password to a new temporary one, for an operator who has lost it.
 *
 * A COMMAND AND NEVER AN HTTP ROUTE, for the reason `bootstrap-super-admin.ts` gives: an
 * endpoint that sets anybody's password has to decide who may call it, and every answer is a
 * back door. Holding database credentials is the authorisation here, and nothing in
 * `src/` imports this file, so no route can reach it.
 *
 * LOCAL BY DEFAULT, PRODUCTION ONLY ON PURPOSE. Against a local database it simply runs, because
 * a developer locked out of their own stack is the common case. Against any other host it
 * refuses unless `RESET_PASSWORD_CONFIRM` holds the exact phrase, so a `DATABASE_URL` left
 * pointing at production, or a command recalled from shell history, cannot reset a real
 * account by accident. "Local" is the allow-list `provision-clinic.ts` already keeps.
 *
 * WHAT A RESET DOES, all in one transaction:
 *   - stores the argon2 hash of a new random password, with the pinned parameters
 *   - sets `mustChangePassword`, so the printed password is a handover and not a credential
 *   - clears the failed-login count and any lockout, or the new password could not be used
 *   - revokes every live refresh token, so a stolen session cannot be renewed
 *   - writes an audit row naming the command as the actor
 *
 * WHAT IT CANNOT DO: end an access token already issued. Those are signed, short-lived and not
 * revocable (D-002), so one stolen before the reset works until it expires, at most
 * `ACCESS_TOKEN_TTL_SECONDS` (15 minutes by default). It cannot be renewed after that.
 *
 * THE PASSWORD IS PRINTED ONCE, to stdout, never through the logger.
 */

const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/** The exact value `RESET_PASSWORD_CONFIRM` must hold for a database that is not local. */
export const CONFIRMATION_PHRASE = 'i-am-resetting-a-password-on-a-shared-database';

export class ResetRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ResetRefused';
  }
}

export type ResetInput = {
  readonly email: string;
  /** Where the command is pointed, so the local check sees what Prisma will connect to. */
  readonly databaseUrl: string;
  /** The value of RESET_PASSWORD_CONFIRM, passed in rather than read from env. */
  readonly confirmation: string | undefined;
};

export type PasswordReset = {
  readonly userId: string;
  readonly email: string;
  readonly refreshTokensRevoked: number;
  /** Returned to the caller exactly once. Never stored, never logged. */
  readonly password: string;
};

export const resetPassword = async (
  prisma: PrismaClient,
  input: ResetInput,
): Promise<PasswordReset> => {
  if (!isLocalDatabase(input.databaseUrl) && input.confirmation !== CONFIRMATION_PHRASE) {
    throw new ResetRefused(
      'DATABASE_URL does not point at a local database. This command replaces a real ' +
        'person’s password, so against any other database it requires ' +
        `RESET_PASSWORD_CONFIRM=${CONFIRMATION_PHRASE}`,
    );
  }

  const email = input.email.trim().toLowerCase();

  // Checked here rather than with a zod schema, because this file must not import
  // src/config.ts transitively: the command runs with only DATABASE_URL set.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new ResetRefused('the argument must be an email address');
  }

  const password = temporaryPassword();
  // Hashed before the transaction opens, so argon2 does not hold it open.
  const passwordHash = await hashPassword(password);

  return prisma.$transaction(async (tx) => {
    // Row-level security is forced, and the target may be a platform user or any clinic's,
    // so the reset runs in platform scope. Transaction-local, as in the bootstrap.
    await tx.$executeRawUnsafe(`SELECT set_config('app.platform', 'on', true)`);

    const user = await tx.user.findUnique({
      where: { email },
      select: { id: true, organisationId: true },
    });

    if (user === null) {
      throw new ResetRefused('no user has that email address. Nothing was changed.');
    }

    await tx.user.update({
      where: { id: user.id },
      data: { passwordHash, mustChangePassword: true, failedLoginCount: 0, lockedUntil: null },
    });

    const revoked = await tx.refreshToken.updateMany({
      where: { userId: user.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });

    /**
     * Written directly, as in the bootstrap: a command has no request context, so there is no
     * actor user, role, address or request id to record, and naming the reset user as their
     * own actor would be false. `metadata.actor` says who did it. The organisation is the
     * user's own, NULL for a platform account. Ids and counts only, never the email.
     */
    await tx.auditLog.create({
      data: {
        id: uuidV7(),
        organisationId: user.organisationId,
        actorUserId: null,
        actorRole: null,
        action: 'user.password_reset',
        entityType: 'user',
        entityId: user.id,
        metadata: {
          actor: 'reset-password-command',
          mustChangePassword: true,
          refreshTokensRevoked: revoked.count,
        },
      },
    });

    return { userId: user.id, email, refreshTokensRevoked: revoked.count, password };
  });
};

export type CommandOutput = {
  readonly out: (line: string) => void;
  readonly err: (line: string) => void;
};

export const runResetPasswordCommand = async (
  args: readonly string[],
  env: Readonly<Record<string, string | undefined>>,
  output: CommandOutput,
): Promise<number> => {
  const connectionString = env.DATABASE_URL;

  if (connectionString === undefined || connectionString === '') {
    output.err('DATABASE_URL must be set to reset a password');
    return 1;
  }

  const [email] = args;

  if (email === undefined) {
    output.err('Usage: pnpm reset-password <email>');
    output.err('');
    output.err('Against a database that is not local, also requires');
    output.err(`RESET_PASSWORD_CONFIRM=${CONFIRMATION_PHRASE}`);
    return 1;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  let reset: PasswordReset;
  try {
    reset = await resetPassword(prisma, {
      email,
      databaseUrl: connectionString,
      confirmation: env.RESET_PASSWORD_CONFIRM,
    });
  } catch (error) {
    if (error instanceof ResetRefused) {
      output.err(`Refused: ${error.message}`);
      return 1;
    }
    throw error;
  } finally {
    await prisma.$disconnect();
  }

  output.out('');
  output.out('Password reset.');
  output.out('');
  output.out(`  User id:  ${reset.userId}`);
  output.out(`  Email:    ${reset.email}`);
  output.out(`  Password: ${reset.password}`);
  output.out('');
  output.out(
    `${String(reset.refreshTokensRevoked)} session(s) revoked. An access token issued before`,
  );
  output.out('the reset still works until it expires, at most 15 minutes by default.');
  output.out('');
  output.out('THE PASSWORD IS SHOWN ONCE and must be changed at the next sign-in. Hand it over');
  output.out('out of band. Do not paste it into a chat or a ticket.');
  output.out('');
  return 0;
};

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exitCode = await runResetPasswordCommand(process.argv.slice(2), process.env, {
    out,
    err: (line) => {
      process.stderr.write(`${line}\n`);
    },
  });
}
