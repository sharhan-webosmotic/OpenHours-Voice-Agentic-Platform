import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

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
