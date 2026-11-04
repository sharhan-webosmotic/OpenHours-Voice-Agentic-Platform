import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../src/generated/prisma/client.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { Role } from '../src/generated/prisma/enums.js';
import { clinicUserRow } from '../src/modules/clinic-users/clinic-users.repository.js';
import { temporaryPassword } from '../src/modules/clinic-users/temporary-password.js';

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

/** The database's host, without IPv6 brackets, or undefined when the URL cannot be read. */
const databaseHost = (connectionString: string): string | undefined => {
  try {
    // A bracketed IPv6 literal arrives as `[::1]`.
    return new URL(connectionString).hostname.replace(/^\[|\]$/g, '');
  } catch {
    return undefined;
  }
};

/** Whether a connection string points at a local development database. Unreadable is not local. */
export const isLocalDatabase = (connectionString: string): boolean => {
  const host = databaseHost(connectionString);
  return host !== undefined && LOCAL_HOSTS.has(host);
};

export const assertLocalDatabase = (connectionString: string): void => {
  const bare = databaseHost(connectionString);

  if (bare === undefined) {
    throw new Error('DATABASE_URL is not a valid URL, so it cannot be confirmed as local');
  }

  if (!LOCAL_HOSTS.has(bare)) {
    throw new Error(
      `refusing to provision against host "${bare}". This writes real credentials and is ` +
        'for local development only. Add the host to LOCAL_HOSTS only if it is genuinely local.',
    );
  }
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
export type ProvisionOptions = {
  /**
   * Create the users already past their first sign-in, with this password.
   *
   * ONLY FOR THE BROWSER SUITES, and only because of the login rate limits. Those suites
   * need an account per test (review finding I3), and spending each temporary password
   * over HTTP first cost one login per account. Added to the suite's own sign-ins, that
   * exceeded `AUTH_RATE_LIMIT_MAX_PER_IP`, which counts every login from one address, so
   * the suite throttled itself a second way. Creating the accounts ready removes those
   * requests entirely rather than relaxing a production limit to accommodate them.
   *
   * It is safe to expose here and nowhere else: this script refuses any host that is not
   * local, so it cannot mint a first-login-exempt account against staging or production.
   * Omit it and every user is created the way D-003 requires, with a temporary password
   * that must be replaced.
   */
  readonly readyPassword?: string;
};

export const provisionClinic = async (
  prisma: PrismaClient,
  name: string,
  slug = String(Date.now()).slice(-6),
  options: ProvisionOptions = {},
): Promise<ProvisionedClinic> => {
  const organisationId = uuidV7();
  const ready = options.readyPassword;

  const users: readonly ProvisionedUser[] = [
    {
      email: `owner@clinic-${slug}.test`,
      fullName: 'Clinic Owner',
      role: Role.CLINIC_OWNER,
      password: ready ?? temporaryPassword(),
    },
    {
      email: `manager@clinic-${slug}.test`,
      fullName: 'Clinic Manager',
      role: Role.CLINIC_MANAGER,
      password: ready ?? temporaryPassword(),
    },
    {
      email: `staff@clinic-${slug}.test`,
      fullName: 'Clinic Staff',
      role: Role.STAFF,
      password: ready ?? temporaryPassword(),
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
        data: clinicUserRow({
          organisationId,
          email: user.email,
          passwordHash,
          fullName: user.fullName,
          role: user.role,
          // The whole point: every one of these must be replaced at first sign-in, unless
          // the caller asked for ready accounts (see ProvisionOptions.readyPassword).
          mustChangePassword: ready === undefined,
        }),
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

  /**
   * `--json` prints the clinic as one JSON object instead of the human table.
   *
   * The browser suites provision their own accounts rather than being handed one by
   * environment variable, because sharing a single account made eight tests sign in as one
   * email inside one rate-limit window and the suite throttled itself (review finding I3).
   * Their Playwright global setup shells out to this script, so it needs a format that is
   * not a table meant for a person. The credentials are still shown exactly once and still
   * never stored: a caller that discards the output cannot recover them.
   */
  const raw = process.argv.slice(2);
  const asJson = raw.includes('--json');
  const readyAt = raw.indexOf('--ready-password');
  const readyPassword = readyAt === -1 ? undefined : raw[readyAt + 1];

  if (readyAt !== -1 && (readyPassword === undefined || readyPassword.startsWith('--'))) {
    throw new Error('--ready-password needs a value');
  }

  const args = raw.filter(
    (arg, index) =>
      arg !== '--json' && index !== readyAt && !(readyAt !== -1 && index === readyAt + 1),
  );

  const slug = String(Date.now()).slice(-6);
  const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString }) });

  let clinic: ProvisionedClinic;
  try {
    clinic = await provisionClinic(
      prisma,
      args[0] ?? `Test Clinic ${slug}`,
      slug,
      readyPassword === undefined ? {} : { readyPassword },
    );
  } finally {
    await prisma.$disconnect();
  }

  if (asJson) {
    out(JSON.stringify(clinic));
    return;
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
