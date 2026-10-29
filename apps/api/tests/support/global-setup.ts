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
 */

const OWNER_USER = 'app_owner_test';
const OWNER_PASSWORD = 'owner_password_for_tests';
const APP_USER_PASSWORD = 'app_user_password_for_tests';

const apiRoot = resolve(dirname(fileURLToPath(import.meta.url)), '../..');

let container: StartedPostgreSqlContainer | undefined;

export const setup = async (project: TestProject): Promise<void> => {
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
