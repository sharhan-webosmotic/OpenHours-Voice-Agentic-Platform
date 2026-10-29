import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

/**
 * The initial JavaScript budget, in bytes, before compression.
 *
 * The same number as the clinic dashboard's, and for the same reason: a budget that fails
 * the build rather than a note in a document. It already earned its place once, catching a
 * namespace import of lucide-react that pulled 1.2 MB of icons into the entry chunk.
 */
const INITIAL_JS_BUDGET_BYTES = 450 * 1024;

const bundleBudget = (): Plugin => ({
  name: 'openhours-bundle-budget',
  apply: 'build',
  closeBundle() {
    const assets = join(import.meta.dirname, 'dist', 'assets');

    let entryBytes = 0;
    try {
      for (const name of readdirSync(assets)) {
        if (name.startsWith('index-') && name.endsWith('.js')) {
          entryBytes += statSync(join(assets, name)).size;
        }
      }
    } catch {
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
    /**
     * A sibling of the API under one registrable domain, like the dashboard. The refresh
     * cookie is SameSite=Strict and same-site is evaluated on the registrable domain, so
     * `admin.openhours.localhost` and `api.openhours.localhost` are same-site while
     * `localhost:5174` and `localhost:3000` would not be.
     */
    /**
     * Binds the loopback address, not the name.
     *
     * `*.openhours.localhost` does not resolve on macOS without an /etc/hosts entry, and
     * `listen()` on an unresolvable name fails with ENOTFOUND, so binding the name made the
     * dev server unstartable on a machine that had not been set up by hand. The loopback
     * address always binds, and `allowedHosts` is what lets the named host reach it.
     */
    host: '127.0.0.1',
    port: 5174,
    strictPort: true,
    /**
     * Vite refuses a Host header it does not recognise, which is correct: it is what stops a
     * DNS-rebinding attack reaching a developer's dev server. The name is listed so the
     * browser can use it, which it must, because SameSite is evaluated on the registrable
     * domain and `localhost:5174` would make the browser tests prove nothing about the
     * arrangement that ships.
     */
    allowedHosts: ['admin.openhours.localhost'],
  },
  build: {
    sourcemap: true,
    target: 'es2023',
  },
});
