import { render, type RenderResult } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import type { ReactNode } from 'react';
import { ApiError, type ApiClient, type CurrentUser, type Session } from '@clinicai/api-client';
import type { Role } from '@clinicai/shared';
import { AuthProvider } from '../app/AuthProvider';
import { createSessionBus, type SessionBus } from '../app/sessionBus';

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

export type StubOptions = {
  /** The user a successful sign-in or boot produces. Absent means no session. */
  readonly user?: CurrentUser;
  /** Thrown by `login`. */
  readonly loginError?: Error;
  /** Thrown by `changePassword`. */
  readonly changePasswordError?: Error;
  /** When false, the boot refresh fails, which is the ordinary signed-out case. */
  readonly bootSucceeds?: boolean;
};

export type Stub = {
  readonly client: ApiClient;
  readonly bus: SessionBus;
  readonly calls: {
    login: number;
    refresh: number;
    logout: number;
    changePassword: number;
  };
};

export const stubClient = (options: StubOptions = {}): Stub => {
  const calls = { login: 0, refresh: 0, logout: 0, changePassword: 0 };
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
    request: () => Promise.resolve(new Response(null, { status: 204 })),
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

export const renderWith = (
  children: ReactNode,
  stub: Stub,
  initialEntries: readonly string[] = ['/'],
): RenderResult =>
  render(
    <MemoryRouter initialEntries={[...initialEntries]}>
      <AuthProvider client={stub.client} sessionLost={stub.bus.subscribe}>
        {children}
      </AuthProvider>
    </MemoryRouter>,
  );
