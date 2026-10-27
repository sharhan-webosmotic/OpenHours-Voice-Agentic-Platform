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
          },
        },
      },
      {
        test: {
          name: 'database',
          environment: 'node',
          include: ['tests/**/*.test.ts'],
          globalSetup: ['tests/support/global-setup.ts'],
          // Container start plus migrate plus the SQL migration.
          testTimeout: 60_000,
          hookTimeout: 180_000,
          // One worker: these tests share a database and some assert on concurrency,
          // so parallel files would interfere with each other.
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts'],
      exclude: ['src/**/*.test.ts', 'src/server.ts', 'src/generated/**', 'src/test-support/**'],
    },
  },
});
