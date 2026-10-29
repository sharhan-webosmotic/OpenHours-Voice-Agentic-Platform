import { randomInt } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { Role, UserStatus } from '../src/generated/prisma/enums.js';

/**
 * Provisions one clinic with an owner, a manager and a staff user, each holding a
 * one-time temporary password printed once.
 *
 * This is NOT `prisma/seed.ts`. The seed gives every user one fixed password written in
 * its source, which is right for a developer who wants to log in repeatedly and wrong for
 * exercising the flow real users get. Under D-003 there is no email provider, so every
 * real account begins as a temporary password handed over out of band with
 * `mustChangePassword` set, and that is the path the dashboard's first-login screen and
 * the API's gate have to work against. The seed leaves `mustChangePassword` false and so
 * never reaches either.
 *
 * SAFETY. Passwords are generated with `randomInt`, which draws from the CSPRNG, printed
 * to stdout exactly once, and stored only as an argon2 hash. Nothing goes through the
 * logger, which would be the one place a redaction mistake could leak them. The script
 * refuses to run against anything but a local database, so it cannot be pointed at
 * staging by a stray `DATABASE_URL`.
 */

/** Written to stdout rather than through the logger, which must never see a password. */
const out = (line: string): void => {
  process.stdout.write(`${line}\n`);
};

/**
 * Hosts a development database may live on.
 *
 * An allow-list, not a deny-list: a new deployment target must be added deliberately
 * rather than being permitted by an omission. `pnpm db:seed` carries no such check, but it
 * writes a password that is already public in its own source; this one mints credentials
 * that are meant to work.
 */
const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', 'postgres', 'host.docker.internal']);

export const assertLocalDatabase = (connectionString: string): void => {
  let host: string;

  try {
    host = new URL(connectionString).hostname;
  } catch {
    throw new Error('DATABASE_URL is not a valid URL, so it cannot be confirmed as local');
  }

  // A bracketed IPv6 literal arrives as `[::1]`.
  const bare = host.replace(/^\[|\]$/g, '');

  if (!LOCAL_HOSTS.has(bare)) {
    throw new Error(
      `refusing to provision against host "${bare}". This writes real credentials and is ` +
        'for local development only. Add the host to LOCAL_HOSTS only if it is genuinely local.',
    );
  }
};

/**
 * A readable temporary password with roughly 77 bits of entropy.
 *
 * Readable because a human reads it off a terminal and types it into a login form, and a
 * password that invites transcription errors gets written on a note instead. Six groups of
 * four from a 32-character alphabet is 120 bits of alphabet space; the alphabet omits
 * characters that are misread aloud or on screen (0/O, 1/l/I).
 *
 * `randomInt` is used rather than `Math.random`, which is not a CSPRNG. These passwords
 * are live credentials for as long as it takes someone to change them.
 */
const ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

export const temporaryPassword = (): string => {
  const groups = Array.from({ length: 6 }, () =>
    Array.from({ length: 4 }, () => ALPHABET[randomInt(ALPHABET.length)]).join(''),
  );

  return groups.join('-');
};

export type ProvisionedUser = {
  readonly email: string;
  readonly fullName: string;
  readonly role: Role;
  readonly password: string;
};

export type ProvisionedClinic = {
  readonly organisationId: string;
  readonly name: string;
  readonly users: readonly ProvisionedUser[];
};

/**
 * Creates the clinic and its three users, and returns the plaintext passwords to the
 * caller exactly once.
 *
 * Separated from the CLI so a test can drive it and then prove the passwords actually
 * work, rather than this script being the one thing in the repository nothing executes.
 * The plaintext is returned, never stored and never logged: the caller decides what to do
 * with it, and the CLI below prints it.
 */
export const provisionClinic = async (
  prisma: PrismaClient,
  name: string,
  slug = String(Date.now()).slice(-6),
): Promise<ProvisionedClinic> => {
  const organisationId = uuidV7();

  const users: readonly ProvisionedUser[] = [
    {
      email: `owner@clinic-${slug}.test`,
      fullName: 'Clinic Owner',
      role: Role.CLINIC_OWNER,
      password: temporaryPassword(),
    },
    {
      email: `manager@clinic-${slug}.test`,
      fullName: 'Clinic Manager',
      role: Role.CLINIC_MANAGER,
      password: temporaryPassword(),
    },
    {
      email: `staff@clinic-${slug}.test`,
      fullName: 'Clinic Staff',
      role: Role.STAFF,
      password: temporaryPassword(),
    },
  ];

  // Hashed before the transaction opens: argon2 at the pinned cost takes long enough that
  // three of them inside a transaction would hold it open for no reason.
  const hashes = await Promise.all(users.map((user) => hashPassword(user.password)));

  await prisma.$transaction(async (tx) => {
    // Row-level security is FORCED and applies even to the table owner, so a write that
    // creates an organisation has to declare platform scope. Transaction-local.
    await tx.$executeRawUnsafe(`SELECT set_config('app.platform', 'on', true)`);

    await tx.organisation.create({
      data: {
        id: organisationId,
        name,
        timezone: 'Asia/Kolkata',
        recordingRetentionDays: 90,
        settings: { recordings_visible_to_staff: false },
      },
    });

    for (const [index, user] of users.entries()) {
      const passwordHash = hashes[index];

      if (passwordHash === undefined) {
        throw new Error(`no hash produced for ${user.role}`);
      }

      await tx.user.create({
        data: {
          id: uuidV7(),
          organisationId,
          email: user.email,
          passwordHash,
          fullName: user.fullName,
          role: user.role,
          status: UserStatus.ACTIVE,
          // The whole point: every one of these must be replaced at first sign-in.
          mustChangePassword: true,
        },
      });
    }
  });

  return { organisationId, name, users };
};

const main = async (): Promise<void> => {
  const connectionString = process.env.DATABASE_URL;

  if (connectionString === undefined || connectionString === '') {
    throw new Error('DATABASE_URL must be set to provision a clinic');
  }

  assertLocalDatabase(connectionString);

  const slug = String(Date.now()).slice(-6);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  let clinic: ProvisionedClinic;
  try {
    clinic = await provisionClinic(prisma, process.argv[2] ?? `Test Clinic ${slug}`, slug);
  } finally {
    await prisma.$disconnect();
  }

  out('');
  out(`Provisioned clinic: ${clinic.name}`);
  out(`Organisation id:    ${clinic.organisationId}`);
  out('');
  out('TEMPORARY PASSWORDS, SHOWN ONCE. They are stored only as hashes, so a lost one');
  out('cannot be recovered and the user has to be provisioned again. Each must be changed');
  out('at first sign-in before the account can reach any other endpoint.');
  out('');

  for (const user of clinic.users) {
    out(`  ${user.role.padEnd(15)} ${user.email.padEnd(32)} ${user.password}`);
  }

  out('');
  out('Sign in at the clinic dashboard. These are clinic roles, so the admin console');
  out('will refuse them and say so.');
  out('');
};

/**
 * Runs only when executed directly, so a test can import `provisionClinic` without this
 * script connecting to a database and printing credentials as a side effect of the import.
 */
if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
