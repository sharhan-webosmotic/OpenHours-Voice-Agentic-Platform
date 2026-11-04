import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  test: {
    // jsdom rather than happy-dom: slower, and markedly more faithful on focus management
    // and form behaviour, which is most of what these tests assert.
    environment: 'jsdom',
    // Headroom over the 5s asyncUtilTimeout in the setup file, so a genuinely stuck test
    // fails as a timeout rather than being killed mid-assertion.
    testTimeout: 15_000,
    /**
     * A third of the machine, not all of it, and never beside the other web suite.
     *
     * Vitest sizes its worker pool to the whole machine by default, and `turbo run test` ran
     * this suite, the other web app's and the API's database suite at the same time, so the
     * gate on its own started about twelve workers and a PostgreSQL container on six cores.
     * Every `findBy` here is a wall-clock limit on CPU-bound rendering, so that
     * oversubscription is what turned a 0.7 second first render into a five-second timeout.
     *
     * Two measures, because bounding the pool alone left one failure in three runs on a
     * heavily loaded machine. The pool is bounded to a third, and `turbo.json` makes the
     * clinic dashboard's tests wait for the admin console's (`@clinicai/clinic-web#test`
     * depends on `@clinicai/admin-web#test`), so the two jsdom suites never run together.
     * The gate is slower for it and that is the intended trade: a gate that sometimes fails is
     * a gate people learn to re-run. Kept identical in both web applications (D-009).
     */
    maxWorkers: '34%',
    globals: false,
    setupFiles: ['./src/test-support/setup.ts'],
    include: ['src/**/*.test.ts', 'src/**/*.test.tsx'],
    coverage: {
      provider: 'v8',
      include: ['src/**/*.ts', 'src/**/*.tsx'],
      exclude: ['src/main.tsx', 'src/test-support/**', 'src/**/*.test.*'],
    },
  },
  define: {
    // The app parses its configuration at import, so the tests have to supply it.
    'import.meta.env.VITE_API_URL': JSON.stringify('https://api.clinicai.test'),
  },
});
