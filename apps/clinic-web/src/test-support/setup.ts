import '@testing-library/jest-dom/vitest';
import { afterEach, beforeAll } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

/**
 * Every lazily loaded route module is imported before any test in the file runs.
 *
 * THIS IS THE FIX FOR THE GATE'S INTERMITTENT FAILURES, not a timeout. A lazy page is imported
 * the first time something renders it, so the first test in a file to render one paid for the
 * import inside its own `findBy`. Importing the shell measured 0.8 seconds on a quiet machine
 * and 4.4 seconds under the gate's parallel load, and "puts SUPER_ADMIN on a page their role
 * can actually read" failed in two runs out of two of `turbo run test`. Raising the wait from
 * one second to five, which is what was done first, only moved the threshold. Loading here
 * takes the import out of every assertion, so a `findBy` measures rendering alone.
 *
 * The hook has its own generous timeout because it is the one place that cost now lands, and
 * a slow import is not a test failure.
 */
beforeAll(async () => {
  const { preloadPages } = await import('../app/routes');
  await preloadPages();
}, 60_000);

/**
 * Testing Library's default `findBy*` timeout is one second. Five gives a real asynchronous
 * render (a mocked request resolving, a state update after it) headroom under load. It is no
 * longer what absorbs a module import: the preload above does that.
 */
configure({ asyncUtilTimeout: 5_000 });

/**
 * Unmounts between tests.
 *
 * Without this, a component from one test is still in the document for the next, and a
 * query that should find one element finds two. It fails as "found multiple elements",
 * which reads like a bug in the component rather than leakage between tests.
 */
afterEach(() => {
  cleanup();
});
