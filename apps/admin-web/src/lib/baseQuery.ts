import { toProblem, type ApiClient, type ProblemDetails } from '@clinicai/api-client';
import { retry, type BaseQueryFn } from '@reduxjs/toolkit/query';

/**
 * RTK Query's transport: `packages/api-client`, never `fetch`.
 *
 * THIS IS THE WHOLE POINT OF THE FILE, so it is stated before anything else. The client
 * holds three things that took a real browser to verify in the sign-in feature: the
 * single-flight refresh on 401, the CSRF header, and `credentials: 'include'` so the
 * httpOnly refresh cookie is attached. `fetchBaseQuery` has none of them.
 *
 * The failure mode of bypassing it is not a broken request, which would be noticed. It is a
 * dashboard that fires five queries on mount, meets five 401s, sends five refreshes, and
 * signs the user out by its own page load, because the refresh token rotates on every use
 * and presenting a rotated token is treated as theft. `createApiClient` de-duplicates those
 * five into one. A baseQuery that called `fetch` would quietly reintroduce the bug.
 *
 * D-015 records this as a binding decision rather than a preference.
 */

/** What an endpoint hands the transport. One shape, so there is nothing to get wrong. */
export type ApiRequest = {
  readonly path: string;
  readonly method?: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE';
  readonly body?: unknown;
  /**
   * Extra headers, for the one thing a body cannot carry: `Idempotency-Key` (root CLAUDE.md
   * rule 8). The client applies them before its own, so none of these can overwrite the
   * `Authorization` or CSRF headers.
   */
  readonly headers?: Readonly<Record<string, string>>;
};

/**
 * The error every RTK Query endpoint rejects with: the API's problem+json, unchanged.
 *
 * A plain object rather than the `ApiError` class, because Redux state must be
 * serializable: a class instance in the store breaks time-travel debugging and trips RTK's
 * own serializability check. Nothing is lost, since `ApiError` carries only the problem.
 */
export type ApiQueryError = ProblemDetails;

const createTransport =
  (client: ApiClient): BaseQueryFn<ApiRequest, unknown, ApiQueryError> =>
  async ({ path, method = 'GET', body, headers }) => {
    let response: Response;

    try {
      response = await client.request(path, method, body, headers);
    } catch (cause) {
      /**
       * A transport failure, which is not a problem+json because no server answered.
       *
       * It is given the same shape as one anyway, so that every consumer of an RTK Query
       * error handles exactly one type. `status: 0` is the signal that there was no
       * response, and it is deliberately not 500: a 500 is a server that answered.
       */
      return {
        error: {
          type: 'about:blank',
          title: 'Network error',
          status: 0,
          detail:
            cause instanceof Error
              ? cause.message
              : 'The request could not be sent. Check the connection and try again.',
        },
      };
    }

    if (!response.ok) {
      return { error: await toProblem(response) };
    }

    // 204 is the API's answer to a successful write with nothing to return. Parsing it as
    // JSON throws, so it is handled before the parse rather than caught after it.
    if (response.status === 204) {
      return { data: undefined };
    }

    return { data: (await response.json()) as unknown };
  };

/**
 * One retry, and never on a 4xx. The reasoning is carried over from the query client this
 * replaced, because it has not changed.
 *
 * The client already recovers from an expired access token by refreshing once, so retrying
 * a 401 would re-send a request whose credential problem has either been fixed already or
 * cannot be. Retrying a 403 is worse: it turns one refusal into several, and for
 * `password-change-required` it delays the screen the user needs. A 409 on a taken
 * appointment slot must not be retried either, because the second attempt would be refused
 * for the same reason and the user would wait twice to be told once.
 *
 * `status: 0` is the transport failure above, which is the case a retry genuinely helps.
 */
export const createApiBaseQuery = (
  client: ApiClient,
): BaseQueryFn<ApiRequest, unknown, ApiQueryError> =>
  retry(createTransport(client), {
    /**
     * `retryCondition` rather than `maxRetries`, because RTK Query's own types make the two
     * mutually exclusive: the attempt limit is expressed inside the condition instead.
     */
    retryCondition: (error, _args, { attempt }) => attempt <= 1 && !isClientError(error),
  });

/**
 * Whether an error is a 4xx, read from a value RTK Query hands over as `unknown`.
 *
 * Narrowed rather than cast. The transport above only ever produces `ApiQueryError`, so the
 * `status` is always there in practice, but a cast would be a place the types stop checking
 * on the strength of that "in practice".
 */
const isClientError = (error: unknown): boolean => {
  if (typeof error !== 'object' || error === null || !('status' in error)) {
    return false;
  }

  const { status } = error;
  return typeof status === 'number' && status >= 400 && status < 500;
};
