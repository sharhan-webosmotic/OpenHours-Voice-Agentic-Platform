import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createApiClient, CSRF_HEADER } from './client.js';
import { ApiError, PASSWORD_CHANGE_REQUIRED_TYPE } from './problem.js';

/**
 * The client's job is the session, so these tests are about the session rules rather than
 * about serialisation: the token never leaves memory, the CSRF header is always on the two
 * cookie routes, a 401 is recovered from exactly once, and concurrent 401s produce ONE
 * refresh.
 *
 * `fetch` is stubbed rather than mocked through MSW. MSW models a server; what is under
 * test here is which requests are made, in what order, with which headers, and that is
 * read more directly off a recorded call list. The browser's real cookie behaviour is not
 * simulated at all, because it cannot be: that is what the Playwright tests are for.
 */

const SESSION = {
  accessToken: 'access-1',
  mustChangePassword: false,
  user: { id: 'u1', organisationId: 'org1', role: 'CLINIC_OWNER' as const },
};

type Call = {
  readonly url: string;
  readonly method: string;
  readonly headers: Headers;
  readonly body: unknown;
};

const json = (body: unknown, status = 200): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const problem = (status: number, type = 'https://clinicai.health/problems/unauthorized') =>
  new Response(JSON.stringify({ type, title: 'Nope', status, detail: 'Please sign in again.' }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

/** Records every request and answers from a queue keyed by path. */
const harness = (responders: Record<string, () => Response>) => {
  const calls: Call[] = [];

  const fetchImpl = ((input: string, init?: RequestInit) => {
    const url = String(input);
    calls.push({
      url,
      method: init?.method ?? 'GET',
      headers: new Headers(init?.headers),
      body: typeof init?.body === 'string' ? (JSON.parse(init.body) as unknown) : undefined,
    });

    const path = new URL(url).pathname;
    const responder = responders[path];

    if (responder === undefined) {
      throw new Error(`no responder for ${path}`);
    }

    return Promise.resolve(responder());
  }) as unknown as typeof fetch;

  return { calls, fetchImpl };
};

const onSessionLost = vi.fn();

beforeEach(() => {
  onSessionLost.mockClear();
});

describe('login', () => {
  it('names the application, so a role belonging in the other one is refused', async () => {
    const { calls, fetchImpl } = harness({ '/api/v1/auth/login': () => json(SESSION) });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'admin',
      onSessionLost,
      fetchImpl,
    });

    await client.login('a@b.test', 'password');

    // The audience is the client's, not the caller's: a screen cannot ask to be treated
    // as the other application, so a clinic role meeting the admin console is refused by
    // the API before any token is issued. See ADR-0001 for why this is UX, not a control.
    expect(calls[0]?.body).toEqual({
      email: 'a@b.test',
      password: 'password',
      audience: 'admin',
    });
    expect(calls[0]?.url).toBe('https://api.test/api/v1/auth/login');
    expect(client.hasSession()).toBe(true);
  });

  it('keeps the access token out of every storage a script can read', async () => {
    const { fetchImpl } = harness({ '/api/v1/auth/login': () => json(SESSION) });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    await client.login('a@b.test', 'password');

    /**
     * D-002, and the reason this test exists rather than a comment: this product holds
     * patient data, and anything a script can read leaves with the first XSS. The client
     * is also not allowed to hand the token back, so there is no getter to assert on: the
     * only way out is the Authorization header it sets itself.
     */
    expect(Object.keys(globalThis.localStorage ?? {})).toHaveLength(0);
    expect(JSON.stringify(client)).not.toContain('access-1');
  });

  it('raises the problem document, with field errors a form can use', async () => {
    const { fetchImpl } = harness({
      '/api/v1/auth/login': () =>
        json(
          {
            type: 'https://clinicai.health/problems/validation-failed',
            title: 'Validation failed',
            status: 400,
            detail: 'Check the form.',
            errors: [{ field: 'email', message: 'Enter an email address.' }],
          },
          400,
        ),
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    await expect(client.login('bad', 'password')).rejects.toBeInstanceOf(ApiError);

    try {
      await client.login('bad', 'password');
    } catch (error) {
      expect((error as ApiError).fieldErrors()).toEqual({ email: 'Enter an email address.' });
    }
  });
});

describe('the CSRF header', () => {
  it('is sent on refresh and on logout, the two routes that carry the cookie', async () => {
    const { calls, fetchImpl } = harness({
      '/api/v1/auth/refresh': () => json(SESSION),
      '/api/v1/auth/logout': () => new Response(null, { status: 204 }),
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    await client.refresh();
    await client.logout();

    // Without this header the API refuses both routes, so a client that forgot it would
    // produce a session that cannot be renewed and a sign-out that does not sign out.
    expect(calls).toHaveLength(2);
    for (const call of calls) {
      expect(call.headers.get(CSRF_HEADER)).toBe('1');
    }
  });

  it('is not sent on routes that authenticate from the Authorization header', async () => {
    const { calls, fetchImpl } = harness({ '/api/v1/auth/me': () => json(SESSION.user) });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    await client.me();

    // Nothing is forged by a header a cross-site page cannot set anyway, so sending it
    // everywhere would be ceremony. ADR-0001 says so and this holds the line.
    expect(calls[0]?.headers.get(CSRF_HEADER)).toBeNull();
  });
});

describe('refresh on a 401', () => {
  it('recovers once and replays the original request', async () => {
    let meCalls = 0;
    const { calls, fetchImpl } = harness({
      '/api/v1/auth/me': () => {
        meCalls += 1;
        return meCalls === 1 ? problem(401) : json({ ...SESSION.user, mustChangePassword: false });
      },
      '/api/v1/auth/refresh': () => json({ ...SESSION, accessToken: 'access-2' }),
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    const user = await client.me();

    expect(user.id).toBe('u1');
    expect(calls.map((call) => new URL(call.url).pathname)).toEqual([
      '/api/v1/auth/me',
      '/api/v1/auth/refresh',
      '/api/v1/auth/me',
    ]);
    // The replay carries the NEW token, not the expired one.
    expect(calls[2]?.headers.get('Authorization')).toBe('Bearer access-2');
    expect(onSessionLost).not.toHaveBeenCalled();
  });

  it('sends exactly one refresh for concurrent 401s', async () => {
    let refreshes = 0;
    let meCalls = 0;
    const { fetchImpl } = harness({
      '/api/v1/auth/me': () => {
        meCalls += 1;
        return meCalls <= 3 ? problem(401) : json({ ...SESSION.user, mustChangePassword: false });
      },
      '/api/v1/auth/refresh': () => {
        refreshes += 1;
        return json({ ...SESSION, accessToken: 'access-2' });
      },
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    await Promise.all([client.me(), client.me(), client.me()]);

    /**
     * THIS IS A CORRECTNESS TEST, NOT A PERFORMANCE ONE. The refresh token rotates on
     * every use and a rotated token presented again is treated as theft, which revokes the
     * whole family. Three refreshes here would mean the second and third present a
     * superseded token and the user is signed out by their own page load.
     */
    expect(refreshes).toBe(1);
  });

  it('does not retry a 403, so the password-change screen is reachable', async () => {
    const { calls, fetchImpl } = harness({
      '/api/v1/audit-logs': () => problem(403, PASSWORD_CHANGE_REQUIRED_TYPE),
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    const response = await client.request('/api/v1/audit-logs');

    // A 403 is a decision about who you are, not a stale credential. Refreshing would
    // replace a token that was never the problem, and for this problem type it would hide
    // the one screen the user needs.
    expect(response.status).toBe(403);
    expect(calls).toHaveLength(1);
    expect(onSessionLost).not.toHaveBeenCalled();
  });
});

describe('when the session cannot be recovered', () => {
  it('drops the token and tells the application once', async () => {
    const { fetchImpl } = harness({
      '/api/v1/auth/me': () => problem(401),
      '/api/v1/auth/refresh': () => problem(401),
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    await client.request('/api/v1/auth/me');

    expect(onSessionLost).toHaveBeenCalledTimes(1);
    expect(client.hasSession()).toBe(false);
  });

  it('gives up when a freshly refreshed token is refused as well', async () => {
    const { fetchImpl } = harness({
      '/api/v1/auth/me': () => problem(401),
      '/api/v1/auth/refresh': () => json(SESSION),
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    await client.request('/api/v1/auth/me');

    // A new token refused immediately is not an expiry problem: the account or the
    // organisation was deactivated, or the role no longer reaches this route. Retrying
    // again would loop.
    expect(onSessionLost).toHaveBeenCalledTimes(1);
    expect(client.hasSession()).toBe(false);
  });

  it('can start a new refresh after an earlier one failed', async () => {
    let refreshes = 0;
    const { fetchImpl } = harness({
      '/api/v1/auth/refresh': () => {
        refreshes += 1;
        return refreshes === 1 ? problem(401) : json(SESSION);
      },
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    await expect(client.refresh()).rejects.toBeInstanceOf(ApiError);
    // The single-flight slot has to be cleared on rejection too, or every later attempt
    // would be handed the same settled rejection and refresh would be dead for the tab.
    await expect(client.refresh()).resolves.toMatchObject({ accessToken: 'access-1' });
  });
});

describe('logout', () => {
  it('drops the local token even when the call fails', async () => {
    const { fetchImpl } = harness({
      '/api/v1/auth/login': () => json(SESSION),
      '/api/v1/auth/logout': () => problem(503),
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    await client.login('a@b.test', 'password');
    await expect(client.logout()).rejects.toBeInstanceOf(ApiError);

    // Leaving the user signed in because the network blipped is the worst failure mode
    // this button has. The cookie expires on its own; the token must not outlive intent.
    expect(client.hasSession()).toBe(false);
  });
});

describe('changePassword', () => {
  it('drops the token, because the change revoked every session', async () => {
    const { fetchImpl } = harness({
      '/api/v1/auth/login': () => json(SESSION),
      '/api/v1/auth/change-password': () => new Response(null, { status: 204 }),
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    await client.login('a@b.test', 'password');
    await client.changePassword('old-password', 'a-much-longer-password');

    // The token in hand is already dead server-side. Keeping it would make the next call
    // fail with a 401 that looks like an unrelated problem.
    expect(client.hasSession()).toBe(false);
  });
});

describe('a response that is not problem+json', () => {
  it('still becomes an error carrying the real status', async () => {
    const { fetchImpl } = harness({
      '/api/v1/auth/login': () =>
        new Response('<html>502 Bad Gateway</html>', {
          status: 502,
          headers: { 'Content-Type': 'text/html' },
        }),
    });
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost,
      fetchImpl,
    });

    // A proxy serving HTML is still a failure. Returning undefined here would push a null
    // check into every call site and one of them would forget.
    await expect(client.login('a@b.test', 'password')).rejects.toMatchObject({ status: 502 });
  });
});
