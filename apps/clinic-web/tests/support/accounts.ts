import { execFileSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';

/**
 * Accounts for the browser suite, one per test.
 *
 * WHY THIS EXISTS. The suite used to share one account passed in by environment variable,
 * so its eight tests signed in as one email inside one sixty-second window against a
 * documented per-email limit of five. The suite threw a 429 at itself and failed partway
 * through with "Too many attempts". Review finding I3.
 *
 * THE LIMITS ARE NOT RAISED TO MAKE THIS PASS. They are a control, and this is the only
 * layer that exercises them with a real browser against a real API. Raising them for the
 * run would leave the production throttle untested by the one suite that can test it.
 *
 * THERE ARE TWO LIMITS, AND THE SECOND ONE SHAPES THIS FILE. `AUTH_RATE_LIMIT_MAX_PER_EMAIL`
 * is per account, and giving each test its own email settles it. `AUTH_RATE_LIMIT_MAX_PER_IP`
 * counts every login from one address, and in a local run the setup, the browser and
 * everything else share 127.0.0.1. An earlier version of this file spent each temporary
 * password over HTTP to prepare the account, which cost one login each; added to the
 * suite's own sign-ins that exceeded the per-address limit and the suite throttled itself a
 * second way. So the prepared accounts are created ready, by the provisioning script, and
 * this setup performs no login at all.
 *
 * THE DATABASE STAYS OUT OF THE SPECS. `pnpm provision:clinic` is the sanctioned way to
 * create a real account, it refuses any host that is not local, and it is the command the
 * runbook documents. This shells out to it rather than opening a connection, so no test
 * file owns a database handle or a Prisma dependency.
 */

/** An account whose temporary password has already been replaced, ready to sign in. */
export type ReadyAccount = {
  readonly email: string;
  readonly password: string;
};

/** An account still holding its administrator-issued temporary password. */
export type FirstLoginAccount = {
  readonly email: string;
  readonly temporaryPassword: string;
};

export type Accounts = {
  /** Reserved for the first-login tests, which need an unspent temporary password. */
  readonly firstLogin: FirstLoginAccount;
  /** Everything else: one per test, so no email is signed into twice in a window. */
  readonly ready: readonly ReadyAccount[];
};

/**
 * The password the prepared accounts are created with.
 *
 * Fixed rather than random: it is written to a file in the run's own output directory, it
 * lives only as long as the throwaway accounts do, and a value a developer can read makes
 * a failed run debuggable by hand.
 */
export const PREPARED_PASSWORD = 'e2e-prepared-password';

/**
 * Where the setup leaves the accounts for the specs to pick up.
 *
 * Under the app's own output directory, so a failed run leaves the credentials next to its
 * trace and screenshots instead of somewhere a developer has to go looking.
 */
export const accountsFile = (appDir: string): string =>
  join(appDir, 'test-results', '.accounts.json');

type ProvisionedUser = { readonly email: string; readonly password: string };

/**
 * Runs `provision:clinic --json` in the API workspace and returns its three accounts.
 *
 * The package SCRIPT, not `exec tsx`. The script carries the
 * `--env-file-if-exists=../../.env` flags that load `DATABASE_URL`, and calling `tsx`
 * directly skips them, which fails with "DATABASE_URL must be set".
 *
 * `readyPassword` creates the users already past their first sign-in. See the header for
 * why that matters rather than being a convenience.
 */
const provisionClinic = (
  repoRoot: string,
  label: string,
  readyPassword?: string,
): readonly ProvisionedUser[] => {
  const stdout = execFileSync(
    'pnpm',
    [
      '--filter',
      '@clinicai/api',
      'run',
      'provision:clinic',
      label,
      '--json',
      ...(readyPassword === undefined ? [] : ['--ready-password', readyPassword]),
    ],
    { cwd: repoRoot, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] },
  );

  // pnpm prints its own banner, so take the line that is the JSON object.
  const line = stdout
    .split('\n')
    .map((candidate) => candidate.trim())
    .find((candidate) => candidate.startsWith('{') && candidate.endsWith('}'));

  if (line === undefined) {
    throw new Error(`provision:clinic produced no JSON. Output was:\n${stdout}`);
  }

  const clinic = JSON.parse(line) as { users: readonly ProvisionedUser[] };
  return clinic.users;
};

/**
 * Provisions the accounts a run needs and writes them where the specs look.
 *
 * `readyCount` is how many tests need an account they can simply sign into. One further
 * account is provisioned the ordinary way, with an unspent temporary password, for the
 * first-login tests: that account has to arrive exactly as a real administrator-issued one
 * does, or those tests would not be testing the thing they claim to.
 */
export const createAccounts = (repoRoot: string, appDir: string, readyCount: number): Accounts => {
  const firstLoginUser = provisionClinic(repoRoot, 'E2E First Login')[0];

  if (firstLoginUser === undefined) {
    throw new Error('provision:clinic returned no accounts');
  }

  const provisioned: ProvisionedUser[] = [];
  for (let index = 0; index < Math.ceil(readyCount / 3); index += 1) {
    provisioned.push(...provisionClinic(repoRoot, `E2E Ready ${index + 1}`, PREPARED_PASSWORD));
  }

  const accounts: Accounts = {
    firstLogin: {
      email: firstLoginUser.email,
      temporaryPassword: firstLoginUser.password,
    },
    ready: provisioned.slice(0, readyCount).map((user) => ({
      email: user.email,
      password: PREPARED_PASSWORD,
    })),
  };

  const file = accountsFile(appDir);
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, JSON.stringify(accounts, null, 2));

  return accounts;
};

/** Reads what the global setup wrote. Throws a usable message if the setup did not run. */
export const readAccounts = (appDir: string): Accounts => {
  const file = accountsFile(appDir);

  try {
    return JSON.parse(readFileSync(file, 'utf8')) as Accounts;
  } catch {
    throw new Error(
      `no accounts at ${file}. The Playwright globalSetup provisions them, so run the ` +
        'suite through `pnpm e2e` rather than invoking a spec directly.',
    );
  }
};
