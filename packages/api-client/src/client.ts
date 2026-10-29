import {
  ApiError,
  PASSWORD_CHANGE_REQUIRED_TYPE,
  toProblem,
  UNAUTHORIZED_TYPE,
  type ProblemDetails,
} from './problem.js';
import type { LoginAudience, Role } from '@openhours/shared';

/**
 * The typed client for the five auth endpoints, and the one place a session lives.
 *
 * HAND-WRITTEN, ON PURPOSE AND ON A DEADLINE. Everything in this repository describes
 * this package as generated from an OpenAPI document. Neither the document nor the
 * generator exists yet, and building them inside this feature would have meant settling
 * the zod-4 compatibility of three unexercised packages first. So these five endpoints are
 * written by hand and M1-03 owes the generator (docs/BACKLOG.md).
 *
 * THE ACCESS TOKEN LIVES IN THIS CLOSURE AND NOWHERE ELSE. Not `localStorage`, not
 * `sessionStorage`, not IndexedDB, not a script-readable cookie, not React state, not a
 * module-level export. That is D-002, and the reason is that this product holds patient
 * health data: anything a script can read leaves with the first cross-site scripting bug,
 * and a token in React state ends up in a dev-tools snapshot or an error-tracking payload.
 * A page reload therefore has no token, which is intended: the reload calls `refresh`, and
 * the httpOnly cookie the browser still holds is what restores the session.
 *
 * THE REFRESH TOKEN IS NEVER VISIBLE HERE AT ALL. It is an httpOnly cookie, so this code
 * cannot read it, which is why every call sets `credentials: 'include'` and lets the
 * browser attach it.
 */

export type CurrentUser = {
  readonly id: string;
  readonly organisationId: string | null;
  readonly role: Role;
  readonly mustChangePassword: boolean;
};

export type Session = {
  readonly accessToken: string;
  readonly mustChangePassword: boolean;
  readonly user: {
    readonly id: string;
    readonly organisationId: string | null;
    readonly role: Role;
  };
};

/**
 * The header that proves a cookie-bearing request came from one of our own pages.
 *
 * Sent on refresh and logout, which are the only two routes that authenticate from the
 * cookie and so the only two a cross-site page could trigger with the credential
 * attached. Any value is accepted: its presence is the signal, because a cross-site HTML
 * form cannot set a custom header and a cross-site `fetch` that sets one triggers a
 * preflight the API's origin allow-list refuses. See ADR-0001 and apps/api/src/common/csrf.ts.
 *
 * It lives here rather than in the applications so that no feature code has to remember
 * it, and so that forgetting it is impossible rather than merely unlikely.
 */
export const CSRF_HEADER = 'X-OpenHours-Csrf';

export type ApiClientOptions = {
  /** The API origin, for example `https://api.openhours.health`. No trailing slash. */
  readonly baseUrl: string;
  /** Which application is asking, so the API can refuse a role that belongs in the other. */
  readonly audience: LoginAudience;
  /**
   * Called when the session is gone and cannot be recovered: a refresh was refused, or a
   * retried request was refused again. The application signs the user out in response.
   *
   * The client does not navigate or clear anything beyond its own token, because a library
   * that redirects is a library you cannot test or reuse.
   */
  readonly onSessionLost: () => void;
  /** Injectable so tests drive the client without a server or a browser. */
  readonly fetchImpl?: typeof fetch;
};

export type ApiClient = ReturnType<typeof createApiClient>;

export const createApiClient = ({
  baseUrl,
  audience,
  onSessionLost,
  fetchImpl,
}: ApiClientOptions) => {
  const doFetch = fetchImpl ?? globalThis.fetch.bind(globalThis);

  /** D-002: memory only. See the header comment. */
  let accessToken: string | undefined;

  /**
   * The in-flight refresh, if one is running.
   *
   * SINGLE-FLIGHT, AND IT IS A CORRECTNESS REQUIREMENT RATHER THAN AN OPTIMISATION. The
   * refresh token rotates on every use and presenting a rotated token again is treated as
   * theft, which revokes the whole family. A dashboard that fires five queries on mount
   * and meets five 401s would, without this, send five refreshes: the first rotates, the
   * other four present a token that has just been superseded, and the user is signed out
   * by their own page load. So the first caller starts the refresh and the rest await the
   * same promise.
   */
  let refreshing: Promise<Session> | undefined;

  const parse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
      throw new ApiError(await toProblem(response));
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  };

  const call = async (
    path: string,
    init: {
      readonly method: string;
      readonly body?: unknown;
      readonly csrf?: boolean;
      readonly authorize?: boolean;
    },
  ): Promise<Response> => {
    const headers = new Headers();

    if (init.body !== undefined) {
      headers.set('Content-Type', 'application/json');
    }
    if (init.csrf === true) {
      headers.set(CSRF_HEADER, '1');
    }
    if (init.authorize === true && accessToken !== undefined) {
      headers.set('Authorization', `Bearer ${accessToken}`);
    }

    return doFetch(`${baseUrl}${path}`, {
      method: init.method,
      headers,
      // The refresh cookie is httpOnly and scoped to /api/v1/auth, so only the browser can
      // attach it, and only this flag lets it.
      credentials: 'include',
      ...(init.body === undefined ? {} : { body: JSON.stringify(init.body) }),
    });
  };

  const adopt = (session: Session): Session => {
    accessToken = session.accessToken;
    return session;
  };

  const login = async (email: string, password: string): Promise<Session> =>
    adopt(
      await parse<Session>(
        await call('/api/v1/auth/login', {
          method: 'POST',
          body: { email, password, audience },
        }),
      ),
    );

  /**
   * Rotates the refresh cookie and takes a new access token.
   *
   * On failure the token is dropped and `onSessionLost` fires exactly once, because the
   * cookie is either expired, revoked, or was replayed and the family is now revoked. In
   * every one of those cases there is nothing left to retry with, and a client that
   * retried would be the thing that keeps triggering the reuse detection.
   */
  const refresh = async (): Promise<Session> => {
    if (refreshing !== undefined) {
      return refreshing;
    }

    refreshing = (async () => {
      try {
        return adopt(
          await parse<Session>(await call('/api/v1/auth/refresh', { method: 'POST', csrf: true })),
        );
      } catch (error) {
        accessToken = undefined;
        onSessionLost();
        throw error;
      } finally {
        // Cleared whether it resolved or threw, so a later attempt is not handed a
        // settled rejected promise for ever.
        refreshing = undefined;
      }
    })();

    return refreshing;
  };

  const logout = async (): Promise<void> => {
    try {
      await parse<void>(await call('/api/v1/auth/logout', { method: 'POST', csrf: true }));
    } finally {
      // The local token goes regardless. A logout that left the user signed in because
      // the network blipped would be the worst possible failure mode for this button: the
      // server revokes the family, and if that call never landed the cookie expires on its
      // own, but the token in this tab must not outlive the user's intent.
      accessToken = undefined;
    }
  };

  /**
   * An authenticated request that recovers from an expired access token once.
   *
   * ONLY a 401 is retried, and only once. A 403 is a decision the server has made about
   * who you are, not a stale credential, so retrying it would turn one refusal into two
   * and, for `password-change-required`, would hide the screen the user needs to see.
   */
  const authed = async (path: string, method = 'GET', body?: unknown): Promise<Response> => {
    const first = await call(path, { method, body, authorize: true });

    if (first.status !== 401) {
      return first;
    }

    try {
      await refresh();
    } catch {
      // `refresh` has already dropped the token and told the application. Hand back the
      // original 401 so the caller reports one failure rather than two.
      return first;
    }

    const second = await call(path, { method, body, authorize: true });

    if (second.status === 401) {
      // A fresh token was refused, so this is not an expiry problem: the account or the
      // organisation was deactivated, or the role no longer reaches this route.
      accessToken = undefined;
      onSessionLost();
    }

    return second;
  };

  return {
    login,
    refresh,
    logout,

    /** The signed-in principal, used on boot to discover `mustChangePassword`. */
    me: async (): Promise<CurrentUser> => parse<CurrentUser>(await authed('/api/v1/auth/me')),

    changePassword: async (currentPassword: string, newPassword: string): Promise<void> => {
      await parse<void>(
        await authed('/api/v1/auth/change-password', 'POST', { currentPassword, newPassword }),
      );
      // Changing the password revokes every session, including this one, so the token in
      // hand is already dead. Dropping it here stops the next call from presenting it and
      // collecting a 401 that looks like an unrelated failure.
      accessToken = undefined;
    },

    /** For features beyond this one: an authenticated call with refresh-on-401 built in. */
    request: authed,

    /** True once a session is in hand. Used by the router, never to make a trust decision. */
    hasSession: (): boolean => accessToken !== undefined,
  };
};

export { ApiError, PASSWORD_CHANGE_REQUIRED_TYPE, UNAUTHORIZED_TYPE };
export type { ProblemDetails };
