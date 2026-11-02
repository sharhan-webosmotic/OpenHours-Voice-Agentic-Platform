import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { Role, UserStatus } from '../src/generated/prisma/enums.js';
// Reused rather than copied: the readable-alphabet generator and the reasoning behind it
// (CSPRNG, no characters that are misread aloud) are documented there, and a second
// implementation would be a second opinion about how much entropy a handover password has.
import { temporaryPassword } from './provision-clinic.js';

/**
 * Creates the FIRST super admin, once, so that a freshly deployed platform has somebody
 * who can sign in to the admin console.
 *
 * A COMMAND AND NOT AN HTTP ROUTE. An endpoint that creates a super admin is an endpoint
 * that has to decide who may call it, and before the first super admin exists there is
 * nobody to authorise it. Every answer to that is a back door: a bootstrap token in the
 * environment, an "only if the table is empty" check reachable from the internet, a header
 * nobody rotates. A command run by a person who already holds database credentials needs no
 * such answer, because holding those credentials is the authorisation.
 *
 * THIS ONE DELIBERATELY RUNS AGAINST PRODUCTION, which is the opposite of
 * `provision-clinic.ts`. That script refuses any host outside an allow-list of local names,
 * because it mints working clinic credentials for development. This one has no host check
 * at all: creating the first real super admin on the real platform is the entire point, and
 * a local-only guard would make the command useless for the job it exists to do.
 *
 * SO THE CONFIRMATION VARIABLE IS THE CONTROL. `BOOTSTRAP_SUPER_ADMIN_CONFIRM` must be set
 * to an exact phrase. It is not a secret and is not pretending to be one: it exists so that
 * running this cannot be an accident, a shell-history recall or a copied command whose
 * `DATABASE_URL` points somewhere the operator has forgotten about. The refusal when a
 * super admin already exists is the other half, and it is enforced inside the transaction
 * under an advisory lock rather than by a read beforehand.
 *
 * THE PASSWORD IS PRINTED ONCE, to stdout, never through the logger. The logger has
 * redaction, and redaction is a mitigation for mistakes rather than a place to put a
 * credential on purpose. Under D-003 there is no email provider, so a temporary password
 * handed over out of band with `mustChangePassword` set is the only account-creation path
 * that exists, and this is that path for the first account.
 */

/** Written to stdout rather than through the logger, which must never see a password. */
const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/**
 * The exact value `BOOTSTRAP_SUPER_ADMIN_CONFIRM` must hold.
 *
 * A sentence rather than `yes` or `true`, because the whole purpose is that it cannot be
 * typed absent-mindedly or satisfied by a variable that happens to be set for some other
 * reason.
 */
export const CONFIRMATION_PHRASE = 'i-am-bootstrapping-the-first-super-admin';

/**
 * A 64-bit key for `pg_advisory_xact_lock`, derived from the purpose rather than random,
 * so two concurrent runs pick the same one.
 */
const BOOTSTRAP_LOCK_KEY = 4_815_162_342n;

export class BootstrapRefused extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BootstrapRefused';
  }
}

export type BootstrappedSuperAdmin = {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  /** Returned to the caller exactly once. Never stored, never logged. */
  readonly password: string;
};

export type BootstrapInput = {
  readonly email: string;
  readonly fullName: string;
  /** The value of BOOTSTRAP_SUPER_ADMIN_CONFIRM, passed in rather than read from env. */
  readonly confirmation: string | undefined;
};

/**
 * Creates the first super admin, or refuses.
 *
 * Separated from the CLI below so a test can drive it and then prove the printed password
 * actually authenticates, which is the only assertion that matters about a bootstrap: a
 * command that writes an unusable account has failed while appearing to succeed.
 */
export const bootstrapSuperAdmin = async (
  prisma: PrismaClient,
  input: BootstrapInput,
): Promise<BootstrappedSuperAdmin> => {
  if (input.confirmation !== CONFIRMATION_PHRASE) {
    throw new BootstrapRefused(
      'BOOTSTRAP_SUPER_ADMIN_CONFIRM is not set to the confirmation phrase. This command ' +
        'writes a real administrator to whatever database DATABASE_URL points at, so it ' +
        `requires BOOTSTRAP_SUPER_ADMIN_CONFIRM=${CONFIRMATION_PHRASE}`,
    );
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();

  // Checked here rather than with a zod schema, because this file must not import
  // src/config.ts transitively: config validates the whole environment at import time and
  // this command runs with only DATABASE_URL set.
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BootstrapRefused('the first argument must be an email address');
  }

  if (fullName.length < 2) {
    throw new BootstrapRefused('the second argument must be the person’s full name');
  }

  const password = temporaryPassword();
  // Hashed before the transaction opens: argon2 at the pinned cost would otherwise hold
  // the transaction and the advisory lock open for no reason.
  const passwordHash = await hashPassword(password);
  const userId = uuidV7();

  await prisma.$transaction(async (tx) => {
    // Row-level security is FORCED and applies even to the table owner, so writing a
    // platform user (organisation_id NULL) and a platform audit row requires platform
    // scope. Transaction-local, so it does not leak onto a pooled connection.
    await tx.$executeRawUnsafe(`SELECT set_config('app.platform', 'on', true)`);

    /**
     * Serialises concurrent runs before the count is taken.
     *
     * Without this, two operators starting the command at the same moment would both read
     * zero super admins and both insert one, because nothing in the schema forbids a
     * second. A partial unique index would forbid it for ever, which is wrong: a platform
     * with one super admin and no way to add another is a platform with a single point of
     * lockout. The lock is held until the transaction ends.
     */
    await tx.$executeRawUnsafe(`SELECT pg_advisory_xact_lock(${BOOTSTRAP_LOCK_KEY})`);

    const existing = await tx.user.count({ where: { role: Role.SUPER_ADMIN } });

    if (existing > 0) {
      throw new BootstrapRefused(
        `refusing to bootstrap: ${existing} SUPER_ADMIN account(s) already exist. This ` +
          'command is only for the first one. Create further platform users through the ' +
          'admin console, which audits who created them.',
      );
    }

    await tx.user.create({
      data: {
        id: userId,
        // NULL for a platform role, which the users CHECK constraint requires.
        organisationId: null,
        email,
        passwordHash,
        fullName,
        role: Role.SUPER_ADMIN,
        status: UserStatus.ACTIVE,
        // The whole point: the printed password is a handover, not a credential to keep.
        mustChangePassword: true,
      },
    });

    /**
     * The audit row, written in the SAME transaction, with the actor recorded as the
     * bootstrap rather than as a user.
     *
     * Written directly rather than through `audit.record`, which reads the request context
     * for actor, role, IP and request id. A command has no request context, so every one of
     * those is absent, and `actorUserId` stays NULL. Recording the new super admin's own id
     * as the actor would be a lie: they did not do this, an operator at a terminal did.
     * `metadata.actor` says so explicitly so the row reads correctly to whoever finds it.
     *
     * No organisation: a platform action belongs to none, and the column is nullable for
     * exactly this case.
     */
    await tx.auditLog.create({
      data: {
        id: uuidV7(),
        organisationId: null,
        actorUserId: null,
        actorRole: null,
        action: 'platform.super_admin.bootstrapped',
        entityType: 'user',
        entityId: userId,
        // Ids and flags only. The email is an account identifier for a staff member rather
        // than patient data, but it is still a personal detail that the trail does not need
        // in order to be useful, so only the id goes in.
        metadata: { actor: 'bootstrap', mustChangePassword: true },
      },
    });
  });

  return { userId, email, fullName, password };
};

const main = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL must be set to bootstrap a super admin');
  }

  const email = process.argv[2];
  const fullName = process.argv[3];

  if (email === undefined || fullName === undefined) {
    out('Usage: pnpm bootstrap:super-admin <email> "<full name>"');
    out('');
    out(`Requires BOOTSTRAP_SUPER_ADMIN_CONFIRM=${CONFIRMATION_PHRASE}`);
    out('');
    out('This writes a real administrator to the database DATABASE_URL points at,');
    out('including production. See docs/features/pilot-clinic.md before running it.');
    process.exit(1);
    return;
  }

  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  let created: BootstrappedSuperAdmin;
  try {
    created = await bootstrapSuperAdmin(prisma, {
      email,
      fullName,
      confirmation: process.env.BOOTSTRAP_SUPER_ADMIN_CONFIRM,
    });
  } finally {
    await prisma.$disconnect();
  }

  out('');
  out('Bootstrapped the first SUPER_ADMIN.');
  out('');
  out(`  User id:  ${created.userId}`);
  out(`  Email:    ${created.email}`);
  out(`  Name:     ${created.fullName}`);
  out(`  Password: ${created.password}`);
  out('');
  out('THE PASSWORD IS SHOWN ONCE. It is stored only as an argon2 hash, so a lost one');
  out('cannot be recovered: the account would have to be removed in SQL and this command');
  out('run again. It must be changed at first sign-in before the account can reach any');
  out('other endpoint.');
  out('');
  out('Sign in at the admin console. Do not paste this password into a chat, a ticket or');
  out('a password manager shared with anyone else: hand it over out of band and let the');
  out('first sign-in replace it.');
  out('');
};

/**
 * Runs only when executed directly, so a test can import `bootstrapSuperAdmin` without
 * this script connecting to a database and printing credentials as an import side effect.
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
