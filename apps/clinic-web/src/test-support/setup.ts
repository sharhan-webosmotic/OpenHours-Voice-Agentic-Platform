import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup, configure } from '@testing-library/react';

/**
 * Testing Library's default `findBy*` timeout is one second, which is not enough here.
 *
 * The route tests navigate through two guards and then await a lazily-loaded chunk, and the
 * first such test in a file pays for the chunk's first compile. One second is comfortable
 * when the package runs alone and is not when `turbo` is running sixteen tasks across the
 * monorepo at once: the suite passed on its own and failed on the forced full run, on the
 * first test of the file, every time.
 *
 * Raised rather than papered over with a `waitFor` at each call site. A per-test wait would
 * have to be remembered, and forgetting one produces exactly this: a test that passes on a
 * quiet machine and fails in CI, which is the kind of flake people respond to by re-running
 * the build until it is green.
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
