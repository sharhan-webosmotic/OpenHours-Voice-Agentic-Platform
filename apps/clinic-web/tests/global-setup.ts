import { resolve } from 'node:path';
import { createAccounts } from './support/accounts.js';

/**
 * Provisions one account per test before the suite starts.
 *
 * Review finding I3: the suite used to share one account passed in by environment
 * variable, so its eight tests signed in as one email inside one rate-limit window and
 * threw a 429 at themselves. The accounts are created here instead, and the production
 * limits are left exactly as they ship.
 *
 * SEVEN READY ACCOUNTS, plus one left unspent for the first-login tests. That is one per
 * test in `session.spec.ts` beyond the two that share the first-login account, with a
 * couple spare so adding a test does not mean editing this number on the same day.
 */
const READY_ACCOUNTS = 7;

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
