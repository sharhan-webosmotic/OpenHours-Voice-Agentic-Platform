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
    .withDatabase('openhours_test')
    .withUsername(OWNER_USER)
    .withPassword(OWNER_PASSWORD)
    .start();

  const ownerUrl = container.getConnectionUri();

  const run = (args: readonly string[]): void => {
    execFileSync('pnpm', ['exec', ...args], {
      cwd: apiRoot,
      env: { ...process.env, DATABASE_URL: ownerUrl, APP_USER_PASSWORD },
      stdio: 'pipe',
    });
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
