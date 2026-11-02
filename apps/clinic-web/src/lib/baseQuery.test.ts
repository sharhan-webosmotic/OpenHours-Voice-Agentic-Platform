import { describe, expect, it } from 'vitest';
import { configureStore } from '@reduxjs/toolkit';
import { createApi } from '@reduxjs/toolkit/query';
import { createApiClient, type ApiClient } from '@clinicai/api-client';
import { createApiBaseQuery } from './baseQuery';

/**
 * The one thing that matters about this baseQuery: the session still works through it.
 *
 * These tests exist because an RTK Query baseQuery built on `fetch` would pass every
 * feature test in this repository and still break the product. The access token is in
 * memory and expires after fifteen minutes, so the first query after that expiry gets a 401
 * and the client is supposed to refresh once and retry. The refresh token rotates on every
 * use, and presenting a rotated one is treated as theft, so a dashboard that sent several
 * refreshes at once would sign the user out by its own page load.
 *
 * They are driven against a stubbed `fetch` with the REAL client, because the behaviour
 * under test is the client's and the point is to prove the baseQuery does not get in its
 * way.
 */

type Call = { readonly path: string; readonly authorization: string | null };

const setup = (
  respond: (call: Call, index: number) => Response,
): { readonly client: ApiClient; readonly calls: Call[]; readonly lost: () => number } => {
  const calls: Call[] = [];
  let sessionsLost = 0;

  const client = createApiClient({
    baseUrl: 'https://api.test',
    audience: 'clinic',
    onSessionLost: () => {
      sessionsLost += 1;
    },
    fetchImpl: ((input: RequestInfo | URL, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      // `RequestInfo | URL` has three shapes and only two of them stringify usefully, so
      // the URL is read out rather than coerced.
      const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;

      const call: Call = {
        path: url.replace('https://api.test', ''),
        authorization: headers.get('Authorization'),
      };
      calls.push(call);
      return Promise.resolve(respond(call, calls.length - 1));
    }),
  });

  return { client, calls, lost: () => sessionsLost };
};

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

const problem = (status: number): Response =>
  new Response(JSON.stringify({ type: 'about:blank', title: 'Refused', status }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });

const session = () =>
  json(200, {
    accessToken: 'fresh-token',
    mustChangePassword: false,
    user: { id: 'user-1', organisationId: 'org-1', role: 'CLINIC_OWNER' },
  });

/** A throwaway service over the baseQuery, so the test does not depend on a feature. */
const buildStore = (client: ApiClient) => {
  const api = createApi({
    reducerPath: 'api',
    baseQuery: createApiBaseQuery(client),
    endpoints: (build) => ({
      patients: build.query<{ readonly items: readonly string[] }, void>({
        query: () => ({ path: '/api/v1/patients' }),
      }),
      doctors: build.query<{ readonly items: readonly string[] }, void>({
        query: () => ({ path: '/api/v1/doctors' }),
      }),
      services: build.query<{ readonly items: readonly string[] }, void>({
        query: () => ({ path: '/api/v1/services' }),
      }),
      createPatient: build.mutation<{ readonly id: string }, { readonly fullName: string }>({
        query: (body) => ({ path: '/api/v1/patients', method: 'POST', body }),
      }),
    }),
  });

  const store = configureStore({
    reducer: { [api.reducerPath]: api.reducer },
    middleware: (getDefault) => getDefault().concat(api.middleware),
  });

  return { api, store };
};

describe('the RTK Query baseQuery', () => {
  it('refreshes once and retries the request when a query meets a 401', async () => {
    const { client, calls } = setup((call, index) => {
      if (call.path === '/api/v1/auth/refresh') {
        return session();
      }
      // The first attempt has the expired token, the retry has the fresh one.
      return index === 0 ? problem(401) : json(200, { items: ['patient-1'] });
    });

    const { api, store } = buildStore(client);
    const result = await store.dispatch(api.endpoints.patients.initiate());

    expect(result.data).toEqual({ items: ['patient-1'] });

    expect(calls.map((call) => call.path)).toEqual([
      '/api/v1/patients',
      '/api/v1/auth/refresh',
      '/api/v1/patients',
    ]);
    expect(calls.filter((call) => call.path === '/api/v1/auth/refresh')).toHaveLength(1);
  });

  it('sends ONE refresh when three queries meet a 401 at the same time', async () => {
    /**
     * The failure this guards against is the whole reason the refresh is single-flight.
     *
     * Three queries on mount, three 401s, three refreshes: the first rotates the token and
     * the other two present one that has just been superseded, which the API treats as a
     * replayed token and answers by revoking the family. The user is signed out by their own
     * page load, and it only reproduces when several queries are in flight together, which
     * is every real dashboard and no single-request test.
     */
    const expired = new Set(['/api/v1/patients', '/api/v1/doctors', '/api/v1/services']);
    const seen = new Map<string, number>();

    const { client, calls } = setup((call) => {
      if (call.path === '/api/v1/auth/refresh') {
        return session();
      }
      const attempts = (seen.get(call.path) ?? 0) + 1;
      seen.set(call.path, attempts);
      return attempts === 1 && expired.has(call.path)
        ? problem(401)
        : json(200, { items: [call.path] });
    });

    const { api, store } = buildStore(client);

    const results = await Promise.all([
      store.dispatch(api.endpoints.patients.initiate()),
      store.dispatch(api.endpoints.doctors.initiate()),
      store.dispatch(api.endpoints.services.initiate()),
    ]);

    for (const result of results) {
      expect(result.data).toBeDefined();
    }

    expect(calls.filter((call) => call.path === '/api/v1/auth/refresh')).toHaveLength(1);
    // Three originals, one refresh, three retries.
    expect(calls).toHaveLength(7);
  });

  it('retries a mutation after a refresh too, so a write is not lost to an expired token', async () => {
    const { client, calls } = setup((call, index) => {
      if (call.path === '/api/v1/auth/refresh') {
        return session();
      }
      return index === 0 ? problem(401) : json(201, { id: 'patient-1' });
    });

    const { api, store } = buildStore(client);
    const result = await store.dispatch(
      api.endpoints.createPatient.initiate({ fullName: 'Test Patient' }),
    );

    expect('data' in result && result.data).toEqual({ id: 'patient-1' });
    expect(calls.filter((call) => call.path === '/api/v1/auth/refresh')).toHaveLength(1);
  });

  it('reports the original refusal and does not refresh again when the refresh itself fails', async () => {
    const { client, calls, lost } = setup((call) =>
      call.path === '/api/v1/auth/refresh' ? problem(401) : problem(401),
    );

    const { api, store } = buildStore(client);
    const result = await store.dispatch(api.endpoints.patients.initiate());

    expect(result.error).toMatchObject({ status: 401 });
    // One attempt, one refresh, and then it stops: there is nothing left to retry with.
    expect(calls.map((call) => call.path)).toEqual(['/api/v1/patients', '/api/v1/auth/refresh']);
    expect(lost()).toBe(1);
  });

  it('does not retry a 4xx that is not a 401, because the answer would be the same', async () => {
    const { client, calls } = setup(() => problem(409));

    const { api, store } = buildStore(client);
    const result = await store.dispatch(
      api.endpoints.createPatient.initiate({ fullName: 'Test Patient' }),
    );

    expect(result.error).toMatchObject({ status: 409 });
    // A taken slot or a duplicate name is refused for the same reason on a second attempt,
    // so retrying would make the user wait twice to be told once.
    expect(calls).toHaveLength(1);
  });

  it('turns a transport failure into a problem document with status 0', async () => {
    const client = createApiClient({
      baseUrl: 'https://api.test',
      audience: 'clinic',
      onSessionLost: () => undefined,
      fetchImpl: (() => Promise.reject(new Error('Failed to fetch'))),
    });

    const { api, store } = buildStore(client);
    const result = await store.dispatch(api.endpoints.patients.initiate());

    // Shaped like every other error, so a screen handles one type rather than two, and
    // `status: 0` says no server answered rather than implying a 500, which is a server
    // that did.
    expect(result.error).toMatchObject({ status: 0, title: 'Network error' });
  });

  it('returns undefined rather than throwing when the API answers 204', async () => {
    const { client } = setup((call) =>
      call.path === '/api/v1/auth/refresh' ? session() : new Response(null, { status: 204 }),
    );

    const { api, store } = buildStore(client);
    const result = await store.dispatch(api.endpoints.patients.initiate());

    expect(result.error).toBeUndefined();
    expect(result.data).toBeUndefined();
  });
});
