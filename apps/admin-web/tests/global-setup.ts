import { resolve } from 'node:path';
import { createAccounts } from './support/accounts.js';

/**
 * Provisions the clinic account this console's refusal test needs.
 *
 * Review finding I3, applied here too. The dashboard's suite was the one that throttled
 * itself, but this suite took its clinic account from `E2E_EMAIL` and `E2E_CLINIC_PASSWORD`,
 * which meant it depended on a password the dashboard's suite had chosen in another run.
 * Provisioning its own removes that coupling and the two environment variables with it.
 *
 * ONE ACCOUNT, because only one test here signs in as a clinic user. The platform account
 * still comes from the environment: nothing provisions a SUPER_ADMIN today except
 * `prisma/seed.ts`, which is the gap named in docs/features/sign-in.md.
 */
const READY_ACCOUNTS = 1;

const appDir = resolve(import.meta.dirname, '..');
const repoRoot = resolve(appDir, '../..');

/**
 * A default export, which root CLAUDE.md otherwise forbids.
 *
 * Playwright resolves `globalSetup` by importing the module and calling its DEFAULT
 * export; a named one is not read, so this is the framework's contract rather than a
 * style choice. Scoped to this one line, and the work it does lives in
 * `tests/support/accounts.ts` behind named exports. Review finding I3.
 */
// eslint-disable-next-line no-restricted-syntax -- Playwright requires a default export here
export default (): void => {
  createAccounts(repoRoot, appDir, READY_ACCOUNTS);
};
