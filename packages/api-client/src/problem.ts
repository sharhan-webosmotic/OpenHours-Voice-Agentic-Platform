/**
 * The error side of the API contract: RFC 7807 problem+json, as the API renders it.
 *
 * Mirrors `apps/api/src/common/problem-details.ts`. It is hand-written and so can drift
 * from it, which is the debt M1-03 pays off by generating both from one OpenAPI document
 * (see docs/BACKLOG.md). Until then the shape is small and the `type` constants below are
 * asserted against the API's own in a test, so drift fails the build rather than a user.
 */

export type FieldError = {
  readonly field: string;
  readonly message: string;
};

export type ProblemDetails = {
  readonly type: string;
  readonly title: string;
  readonly status: number;
  readonly detail?: string;
  readonly requestId?: string;
  readonly errors?: readonly FieldError[];
};

const PROBLEM_BASE = 'https://clinicai.health/problems';

/**
 * The problem types a caller branches on.
 *
 * A client that branches on `status` alone cannot tell a "change your temporary password"
 * 403 from a "you may not do this" 403, and those lead to completely different screens.
 * That is why the API gives the first one its own type.
 */
export const PASSWORD_CHANGE_REQUIRED_TYPE = `${PROBLEM_BASE}/password-change-required`;
export const FORBIDDEN_TYPE = `${PROBLEM_BASE}/forbidden`;
export const UNAUTHORIZED_TYPE = `${PROBLEM_BASE}/unauthorized`;
export const VALIDATION_FAILED_TYPE = `${PROBLEM_BASE}/validation-failed`;
export const TOO_MANY_REQUESTS_TYPE = `${PROBLEM_BASE}/too-many-requests`;

/**
 * A failed request, carrying the problem document.
 *
 * `message` is the API's `detail` when there is one. Every `detail` the API sends is
 * written for an end user and contains no patient data and no internal information, which
 * is a property of the API's error classes rather than an assumption made here, so it is
 * safe to show. The internal message never leaves the server.
 */
export class ApiError extends Error {
  readonly problem: ProblemDetails;

  constructor(problem: ProblemDetails) {
    super(problem.detail ?? problem.title);
    this.name = 'ApiError';
    this.problem = problem;
  }

  get status(): number {
    return this.problem.status;
  }

  get type(): string {
    return this.problem.type;
  }

  /** The field errors, keyed by field, for handing to a form. */
  fieldErrors(): Readonly<Record<string, string>> {
    const entries = (this.problem.errors ?? []).map(
      (error) => [error.field, error.message] as const,
    );
    return Object.fromEntries(entries);
  }
}

/**
 * Reads a problem document out of a failed response.
 *
 * A non-2xx that is not problem+json is still an error, so this never returns undefined:
 * a proxy 502 serving HTML, or a network layer that mangled the body, becomes a synthetic
 * problem carrying the real status. Returning undefined would push a null check into every
 * call site, and one of them would forget.
 */
export const toProblem = async (response: Response): Promise<ProblemDetails> => {
  try {
    const body: unknown = await response.json();

    if (
      typeof body === 'object' &&
      body !== null &&
      typeof (body as { type?: unknown }).type === 'string' &&
      typeof (body as { status?: unknown }).status === 'number'
    ) {
      return body as ProblemDetails;
    }
  } catch {
    // Not JSON, or an empty body. Fall through to the synthetic problem below.
  }

  return {
    type: `${PROBLEM_BASE}/unexpected-response`,
    title: 'Unexpected response',
    status: response.status,
    detail: 'Something went wrong. Please try again.',
  };
};
