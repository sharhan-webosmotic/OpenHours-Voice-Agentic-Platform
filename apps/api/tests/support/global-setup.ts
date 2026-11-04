import { execFileSync } from 'node:child_process';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import type { TestProject } from 'vitest/node';

/**
 * One PostgreSQL container for the whole database-test run.
 *
 * The real migrations and the real hand-written SQL are applied, because a test against
 * a schema built some other way proves nothing about what will be deployed. Tests then
 * connect as the non-owner `app_user`, which is what the API connects as: connecting as
 * the owner would quietly bypass the policies this suite exists to verify.
 *
 * ─── RUNNING THE SAME SUITE AGAINST A REAL DATABASE ─────────────────────────────
 *
 * Set `TEST_OWNER_DATABASE_URL` and `TEST_APP_USER_DATABASE_URL` and no container is
 * started: the suite runs against whatever those point at. That exists for one specific
 * question, which a container cannot answer.
 *
 * Tenant isolation rests on `set_config('app.org_id', ..., true)`, which is
 * TRANSACTION-LOCAL, inside an interactive transaction. A connection pooler in transaction
 * mode hands a server connection back when the transaction ends, so the setting and the
 * queries that depend on it stay together by construction. If that were ever untrue, for
 * this pooler or a future one, the consequence would be a query reading another clinic's
 * rows with nothing logged anywhere. The local container has no pooler in front of it and
 * therefore cannot tell us (D-019).
 *
 * MIGRATIONS ARE NOT APPLIED to an external database. Pointing this at a project and
 * having it run `prisma migrate deploy` would be a schema change to somebody's database as
 * a side effect of running tests. The runbook says to apply them deliberately first.
 */

const OWNER_USER = 'app_owner_test';
const OWNER_PASSWORD = 'owner_password_for_tests';
const APP_USER_PASSWORD = 'app_user_password_for_tests';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

let container: StartedPostgreSqlContainer | undefined;

export const setup = async (project: TestProject): Promise<void> => {
  const externalOwnerUrl = process.env.TEST_OWNER_DATABASE_URL;
  const externalAppUserUrl = process.env.TEST_APP_USER_DATABASE_URL;

  if (externalOwnerUrl !== undefined && externalAppUserUrl !== undefined) {
    /**
     * An external target. Both URLs are required: the owner connection builds fixtures and
     * asserts what a table really holds, and the `app_user` connection is the one the
     * policies apply to. Running the suite with one of them pointed at the wrong role would
     * make every isolation assertion pass for the wrong reason.
     */
    /**
     * Written to stderr rather than through the logger, which is silenced in tests, and
     * rather than `console.log`, which the lint rules forbid for good reason.
     *
     * It is the only signal that the suite is not using the container. A reader who missed
     * it would take a green run against a laptop's PostgreSQL as evidence about Supabase.
     */
    process.stderr.write(
      '[global-setup] TEST_OWNER_DATABASE_URL is set: running against an EXTERNAL database. No container, no migrations applied.\n',
    );

    project.provide('ownerUrl', externalOwnerUrl);
    project.provide('appUserUrl', externalAppUserUrl);
    return;
  }

  container = await new PostgreSqlContainer('postgres:16.15-alpine')
    .withDatabase('clinicai_test')
    .withUsername(OWNER_USER)
    .withPassword(OWNER_PASSWORD)
    .start();

  const ownerUrl = container.getConnectionUri();

  /**
   * stdio is piped to keep a normal run quiet, but the output is re-thrown on failure.
   * Swallowing it meant a migration that failed on a CI runner surfaced only as an
   * opaque non-zero exit, with the actual SQL error sitting unread in a buffer.
   */
  const run = (args: readonly string[]): void => {
    try {
      execFileSync('pnpm', ['exec', ...args], {
        cwd: apiRoot,
        env: { ...process.env, DATABASE_URL: ownerUrl, APP_USER_PASSWORD },
        stdio: 'pipe',
      });
    } catch (error) {
      const failure = error as { stdout?: Buffer; stderr?: Buffer };
      const detail = [failure.stdout?.toString(), failure.stderr?.toString()]
        .filter((part) => part !== undefined && part.length > 0)
        .join('\n');
      // cause keeps the original error, including its exit status, reachable.
      throw new Error(`pnpm exec ${args.join(' ')} failed:\n${detail}`, { cause: error });
    }
  };

  run(['prisma', 'migrate', 'deploy']);
  run(['tsx', 'prisma/sql/apply.ts']);

  const appUserUrl = ownerUrl.replace(
    `${OWNER_USER}:${OWNER_PASSWORD}`,
    `app_user:${APP_USER_PASSWORD}`,
  );

  project.provide('ownerUrl', ownerUrl);
  project.provide('appUserUrl', appUserUrl);
};

export const teardown = async (): Promise<void> => {
  await container?.stop();
};

declare module 'vitest' {
  interface ProvidedContext {
    ownerUrl: string;
    appUserUrl: string;
  }
}
