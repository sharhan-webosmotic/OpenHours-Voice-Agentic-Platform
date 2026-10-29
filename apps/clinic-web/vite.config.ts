import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The initial JavaScript budget, in bytes, before compression.
 *
 * A number that fails the build rather than a note in a document, because a bundle budget
 * nobody enforces is a bundle budget that is already blown. Clinic staff open this on
 * whatever the practice has, often over a mobile connection, so the cost of a slow first
 * load is a receptionist standing in front of a patient waiting for a screen.
 *
 * 450 KB is roughly three times what this feature needs, which is deliberate: the budget
 * exists to catch a careless import of a charting or date library into the entry chunk,
 * not to make every commit a negotiation. Raising it is a decision to discuss in review.
 */
const INITIAL_JS_BUDGET_BYTES = 450 * 1024;

/**
 * Fails the build when the entry chunk and anything it loads eagerly exceed the budget.
 *
 * Measures the entry and its static imports rather than every file in `dist`, because
 * lazily-loaded routes are the thing code splitting is FOR: counting them would punish the
 * split that makes the initial load small.
 */
const bundleBudget = (): Plugin => ({
  name: 'openhours-bundle-budget',
  apply: 'build',
  closeBundle() {
    const assets = join(import.meta.dirname, 'dist', 'assets');

    let entryBytes = 0;
    try {
      for (const name of readdirSync(assets)) {
        // Vite names the entry chunk `index-<hash>.js`; route chunks carry their own names.
        if (name.startsWith('index-') && name.endsWith('.js')) {
          entryBytes += statSync(join(assets, name)).size;
        }
      }
    } catch {
      // No assets directory means the build produced nothing to measure, which the build
      // itself will already have failed on. Not this plugin's error to report.
      return;
    }

    if (entryBytes > INITIAL_JS_BUDGET_BYTES) {
      throw new Error(
        `Initial JS is ${(entryBytes / 1024).toFixed(1)} KB, over the ` +
          `${(INITIAL_JS_BUDGET_BYTES / 1024).toFixed(0)} KB budget. Lazy-load the new code, ` +
          'or raise the budget in vite.config.ts as a reviewed decision.',
      );
    }
  },
});

export default defineConfig({
  plugins: [react(), tailwindcss(), bundleBudget()],
  server: {
    // Named host rather than localhost: the API sets a SameSite=Strict cookie, and
    // same-site is evaluated on the registrable domain, so the dashboard and the API have
    // to be siblings under one. See docs/features/sign-in.md for the hosts file entry.
    /**
     * Binds the loopback address, not the name.
     *
     * `*.openhours.localhost` does not resolve on macOS without an /etc/hosts entry, and
     * `listen()` on an unresolvable name fails with ENOTFOUND, so binding the name made the
     * dev server unstartable on a machine that had not been set up by hand. The loopback
     * address always binds, and `allowedHosts` is what lets the named host reach it.
     */
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    /**
     * Vite refuses a Host header it does not recognise, which is correct: it is what stops a
     * DNS-rebinding attack reaching a developer's dev server. The name is listed so the
     * browser can use it, which it must, because SameSite is evaluated on the registrable
     * domain and `localhost:5173` would make the browser tests prove nothing about the
     * arrangement that ships.
     */
    allowedHosts: ['app.openhours.localhost'],
  },
  build: {
    // Sourcemaps are produced but not served in production: they would let anyone read the
    // application's source, which is not a secret but is free reconnaissance.
    sourcemap: true,
    target: 'es2023',
  },
});
