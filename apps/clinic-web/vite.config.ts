import { readFileSync, statSync } from 'node:fs';
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
 * RAISED FROM 450 KB TO 550 KB IN THE CLINIC DASHBOARD FEATURE, WITH THE MEASUREMENTS.
 * The old figure was described here as "roughly three times what this feature needs", which
 * was not true by the time it was written: the sign-in feature shipped at 442.6 KB, 7.5 KB
 * of headroom. Adding Redux Toolkit and RTK Query (D-015) cost about 29 KB net of removing
 * TanStack Query, which put the build at 471.9 KB and failed it.
 *
 * What that 471.9 KB is, measured from the entry chunk's own sourcemap rather than guessed:
 * react-dom, react-router, zod, react-hook-form and Redux Toolkit, in that order, with the
 * application's own code at roughly 69 KB of unminified source. There is no careless import
 * to remove. It is the dependency floor of a typed, validated, routed React application,
 * and the gzipped transfer, which is what a receptionist on a slow connection actually
 * waits for, is 156 KB.
 *
 * What was tried first, and kept: the shell is now lazily loaded, matching the admin
 * console. It took 9 KB out of the entry, which was not enough on its own.
 *
 * What was NOT done, deliberately: lazy-loading the sign-in screen would have taken
 * react-hook-form and most of zod out of the entry, and it is the wrong trade. Sign-in is
 * the first screen a signed-out visitor loads, so splitting it buys a smaller entry chunk by
 * adding a blocking request to the one moment that cannot afford one.
 *
 * The budget still has a job: 550 KB catches a charting or date library arriving in the
 * entry chunk, which is what it was for. Every one of the nine dashboard screens is
 * lazily loaded per route, so they do not count against it. Raising it again is another
 * decision to discuss in review, and the next answer should probably be splitting rather
 * than a bigger number.
 */
const INITIAL_JS_BUDGET_BYTES = 550 * 1024;

/**
 * Fails the build when the entry chunk and anything it loads eagerly exceed the budget.
 *
 * Measures the entry and its static imports rather than every file in `dist`, because
 * lazily-loaded routes are the thing code splitting is FOR: counting them would punish the
 * split that makes the initial load small.
 *
 * IT READS THE BUILT HTML RATHER THAN MATCHING FILE NAMES. The previous version summed every
 * file called `index-*.js`, which happened to be right only because the entry had no static
 * import chunks. The moment a shared dependency is split out, that measurement would have
 * reported a smaller number for an initial load that had not shrunk at all, and a budget that
 * can be satisfied by renaming chunks is worse than no budget. The document lists exactly
 * what the browser fetches before it can render: the entry script and every `modulepreload`.
 */
const bundleBudget = (): Plugin => ({
  name: 'clinicai-bundle-budget',
  apply: 'build',
  closeBundle() {
    const outDir = join(import.meta.dirname, 'dist');

    let entryBytes = 0;
    try {
      const html = readFileSync(join(outDir, 'index.html'), 'utf8');

      const eager = [
        ...html.matchAll(/<script[^>]+type="module"[^>]+src="([^"]+)"/g),
        ...html.matchAll(/<link[^>]+rel="modulepreload"[^>]+href="([^"]+)"/g),
      ].flatMap((match) => (match[1] === undefined ? [] : [match[1]]));

      for (const href of eager) {
        entryBytes += statSync(join(outDir, href.replace(/^\//, ''))).size;
      }
    } catch {
      // No built document means the build produced nothing to measure, which the build
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
     * `*.clinicai.localhost` does not resolve on macOS without an /etc/hosts entry, and
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
    allowedHosts: ['app.clinicai.localhost'],
  },
  build: {
    // Sourcemaps are produced but not served in production: they would let anyone read the
    // application's source, which is not a secret but is free reconnaissance.
    sourcemap: true,
    target: 'es2023',
  },
});
