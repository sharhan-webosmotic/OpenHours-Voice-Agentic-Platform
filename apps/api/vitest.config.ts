import { defineConfig } from 'vitest/config';

/**
 * Two projects, because they need different setup and have very different cost.
 *
 *  unit     - src/**, no infrastructure, milliseconds.
 *  database - tests/**, one PostgreSQL container with the REAL migrations and the real
 *             hand-written SQL, connected as the non-owner app_user so row-level
 *             security is live. Tens of seconds, and requires Docker.
 *
 * Both run under `pnpm test`, so `pnpm check` covers the isolation guarantees rather
 * than leaving them to a command someone has to remember.
 */
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: 'unit',
          environment: 'node',
          include: ['src/**/*.test.ts'],
          // config.ts validates the environment at import time. Throwaway values for
          // tests that never open a real connection.
          env: {
            NODE_ENV: 'test',
            DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
            LOG_LEVEL: 'silent',
            JWT_SECRET: 'unit-test-jwt-secret-at-least-32-bytes!!',
          },
        },
      },
      {
        test: {
          name: 'database',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          globalSetup: ['tests/support/global-setup.ts'],
          // Runs in the worker before the test file's imports, which is the only point
          // at which src/config.ts can be pointed at the container.
          setupFiles: ['tests/support/setup-env.ts'],
          // Container start plus migrate plus the SQL migration.
          testTimeout: 60_000,
          hookTimeout: 180_000,
          // One worker: these tests share a database and some assert on concurrency,
          // so parallel files would interfere with each other.
          fileParallelism: false,
        },
      },
    ],
    /**
     * Measured on every `pnpm test`, so the floors below are part of the gate rather than a
     * report somebody has to remember to run.
     *
     * THE TWO OPERATOR COMMANDS ARE MEASURED TOO. They live in `prisma/`, outside `src/`, and
     * were invisible here: the bootstrap that creates the first super admin sat at 43% and the
     * prompt renderer's command at 0%, with the gate green. Every other script in `prisma/` is
     * left out deliberately, because they are migration and maintenance tooling exercised by
     * running them, not product code a request reaches.
     *
     * The floors are root CLAUDE.md's: 90% of lines for auth, tenancy and permissions, 80%
     * elsewhere in the API. The per-file entries are the files whose floor is the higher one
     * and that have fallen below it before.
     */
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'prisma/bootstrap-super-admin.ts', 'prisma/render-prompt.ts'],
      exclude: ['src/**/*.test.ts', 'src/server.ts', 'src/generated/**', 'src/test-support/**'],
      reporter: ['text-summary'],
      thresholds: {
        lines: 80,
        'prisma/bootstrap-super-admin.ts': { lines: 90 },
        'prisma/render-prompt.ts': { lines: 80 },
        'src/common/permissions.ts': { lines: 90 },
      },
    },
  },
});
