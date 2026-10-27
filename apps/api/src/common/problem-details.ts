import { AppError, INTERNAL_ERROR_TYPE, type FieldError } from './errors.js';

/** RFC 7807 problem detail. `errors[]` is present only when there are field problems. */
export type ProblemDetails = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly requestId?: string;
  readonly errors?: readonly FieldError[];
};

export const PROBLEM_JSON_CONTENT_TYPE = 'application/problem+json';

/**
 * Renders any thrown value as problem+json.
 *
 * A stack trace is NEVER included, in any environment, and an unrecognised error's
 * message is never echoed: it may carry SQL, a file path, a provider payload or patient
 * data. Unknown failures become an opaque 500 and the real cause is logged server-side
 * against the same requestId.
 */
export const toProblemDetails = (error: unknown, requestId?: string): ProblemDetails => {
  if (error instanceof AppError) {
    return {
      type: error.type,
      title: error.title,
      status: error.status,
      ...(error.detail === undefined ? {} : { detail: error.detail }),
      ...(requestId === undefined ? {} : { requestId }),
      ...(error.errors.length === 0 ? {} : { errors: error.errors }),
    };
  }

  return {
    type: INTERNAL_ERROR_TYPE,
    title: 'Internal Server Error',
    status: 500,
    ...(requestId === undefined ? {} : { requestId }),
  };
};
