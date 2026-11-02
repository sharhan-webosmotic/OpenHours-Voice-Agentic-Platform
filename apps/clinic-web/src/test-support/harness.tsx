import { render, type RenderResult } from '@testing-library/react';
import { Provider } from 'react-redux';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { ApiError, type ApiClient, type CurrentUser, type Session } from '@clinicai/api-client';
import type { Role } from '@clinicai/shared';
import { AuthProvider } from '../app/AuthProvider';
import { createSessionBus, type SessionBus } from '../app/sessionBus';
import { createAppStore } from '../app/store';

/**
 * A stub API client, and the renderer the component tests use.
 *
 * STUBBED RATHER THAN MOCKED THROUGH MSW. What these tests assert is how the interface
 * behaves given an answer from the server: which screen appears, what the form says, where
 * the router goes. Modelling an HTTP server to produce those answers adds a layer between
 * the test and the thing it is checking. The client's own suite already tests the HTTP
 * behaviour against a stubbed `fetch`, and the real cookie behaviour cannot be tested in
 * jsdom at all, which is what the Playwright tests are for.
 */

export const problem = (status: number, type: string, detail: string): ApiError =>
  new ApiError({ type, title: 'Refused', status, detail });

/**
 * What the stubbed `request` answers, keyed by METHOD and PATH PREFIX.
 *
 * A screen reads four or five endpoints, so a test that stubbed one call at a time would
 * spend more lines arranging than asserting. A route table reads like the API it is standing
 * in for, and a path with no entry answers 404 rather than an empty 200: a screen that
 * renders happily against a missing endpoint is a screen whose loading states are untested.
 */
export type StubRoute = {
  readonly status?: number;
  readonly body?: unknown;
};

export type StubRoutes = Readonly<Record<string, StubRoute>>;

export type StubOptions = {
  /** The user a successful sign-in or boot produces. Absent means no session. */
  readonly user?: CurrentUser;
  /** Thrown by `login`. */
  readonly loginError?: Error;
  /** Thrown by `changePassword`. */
  readonly changePasswordError?: Error;
  /** When false, the boot refresh fails, which is the ordinary signed-out case. */
  readonly bootSucceeds?: boolean;
  /**
   * `'GET /api/v1/patients': { body: { items: [] } }`.
   *
   * Matched on the longest prefix, so a list and one of its rows can both be stubbed, and
   * the query string is ignored because a filter is the screen's business rather than the
   * stub's.
   */
  readonly routes?: StubRoutes;
};

export type Stub = {
  readonly client: ApiClient;
  readonly bus: SessionBus;
  readonly calls: {
    login: number;
    refresh: number;
    logout: number;
    changePassword: number;
    /** Every authenticated request the screen made, in order. */
    requests: { path: string; method: string; body: unknown }[];
  };
};

export const stubClient = (options: StubOptions = {}): Stub => {
  const calls = {
    login: 0,
    refresh: 0,
    logout: 0,
    changePassword: 0,
    requests: [] as { path: string; method: string; body: unknown }[],
  };
  const bus = createSessionBus();
  let current = options.user;

  const session = (user: CurrentUser): Session => ({
    accessToken: 'access-token',
    mustChangePassword: user.mustChangePassword,
    user: { id: user.id, organisationId: user.organisationId, role: user.role },
  });

  const expired = () =>
    problem(401, 'https://clinicai.health/problems/unauthorized', 'Sign in again.');

  const client: ApiClient = {
    login: () => {
      calls.login += 1;
      if (options.loginError !== undefined) {
        return Promise.reject(options.loginError);
      }
      if (current === undefined) {
        return Promise.reject(new Error('stub has no user to sign in'));
      }
      return Promise.resolve(session(current));
    },
    refresh: () => {
      calls.refresh += 1;
      // Default false: a fresh test starts signed out, which is the common starting point.
      if (options.bootSucceeds !== true || current === undefined) {
        return Promise.reject(expired());
      }
      return Promise.resolve(session(current));
    },
    logout: () => {
      calls.logout += 1;
      return Promise.resolve();
    },
    me: () => (current === undefined ? Promise.reject(expired()) : Promise.resolve(current)),
    changePassword: () => {
      calls.changePassword += 1;
      if (options.changePasswordError !== undefined) {
        return Promise.reject(options.changePasswordError);
      }
      current = undefined;
      return Promise.resolve();
    },
    /**
     * Answers from `options.routes`, or 404.
     *
     * The recorded calls are what a test asserts a mutation actually sent, which matters for
     * the ones whose body is built from several pieces of screen state.
     */
    request: (path: string, method = 'GET', body?: unknown) => {
      calls.requests.push({ path, method, body });

      const key = `${method.toUpperCase()} ${path.split('?')[0] ?? path}`;
      const match = Object.keys(options.routes ?? {})
        .filter((candidate) => key === candidate || key.startsWith(`${candidate}`))
        .sort((a, b) => b.length - a.length)[0];

      const route = match === undefined ? undefined : options.routes?.[match];

      if (route === undefined) {
        return Promise.resolve(
          new Response(
            JSON.stringify({
              type: 'https://clinicai.health/problems/not-found',
              title: 'Not Found',
              status: 404,
              detail: `No stub for ${key}`,
            }),
            { status: 404, headers: { 'Content-Type': 'application/problem+json' } },
          ),
        );
      }

      const status = route.status ?? (route.body === undefined ? 204 : 200);

      return Promise.resolve(
        status === 204
          ? new Response(null, { status })
          : new Response(JSON.stringify(route.body ?? null), {
              status,
              headers: { 'Content-Type': 'application/json' },
            }),
      );
    },
    hasSession: () => current !== undefined,
  };

  return { client, bus, calls };
};

export const user = (role: Role, mustChangePassword = false): CurrentUser => ({
  id: 'user-1',
  organisationId: role === 'SUPER_ADMIN' || role === 'INTERNAL_ADMIN' ? null : 'org-1',
  role,
  mustChangePassword,
});

/**
 * A fresh store per render.
 *
 * FRESH, because a store shared between tests would carry one test's cached response into
 * the next and the assertions would then pass or fail depending on the order they ran in.
 * The store is built by a factory for exactly this reason (`app/store.ts`).
 */
export const renderWith = (
  children: ReactNode,
  stub: Stub,
  initialEntries: readonly string[] = ['/'],
): RenderResult =>
  render(
    <Provider store={createAppStore(stub.client)}>
      <MemoryRouter initialEntries={[...initialEntries]}>
        <AuthProvider client={stub.client} sessionLost={stub.bus.subscribe}>
          {children}
        </AuthProvider>
      </MemoryRouter>
    </Provider>,
  );
