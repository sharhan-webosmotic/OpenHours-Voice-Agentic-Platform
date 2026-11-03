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
     * A third of the machine, not all of it.
     *
     * Vitest sizes its worker pool to the whole machine by default, and `turbo run test` runs
     * this suite, the other web app's and the API's database suite at the same time, so the
     * gate on its own started about twelve workers and a PostgreSQL container on six cores.
     * Every `findBy` here is a wall-clock limit on CPU-bound rendering, so that
     * oversubscription is what turned a 0.7 second first render into a five-second timeout.
     * Bounding both web suites to a third leaves the API suite and the rest of the machine
     * room. Kept identical in both web applications (D-009).
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
