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
    'import.meta.env.VITE_API_URL': JSON.stringify('https://api.openhours.test'),
  },
});
