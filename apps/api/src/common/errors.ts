/**
 * Errors are AppError subclasses rendered as RFC 7807 problem+json (root CLAUDE.md).
 *
 * IMPORTANT: an error `message` and `detail` are logged and `detail` is returned to the
 * client. Neither may ever contain patient data or secrets (names, phone numbers, dates
 * of birth, notes, transcripts, prescriptions, tokens). Reference records by id instead:
 * "appointment not found" with an id field, never "no appointment for Priya Sharma".
 * Redaction cannot save a message, because a redacted message is useless for diagnosis.
 */

/** One field-level problem, for the `errors[]` member of a 400 response. */
export type FieldError = {
  readonly field: string;
  readonly message: string;
  readonly code?: string;
};

const PROBLEM_BASE = 'https://openhours.health/problems';

/** Exported so both web apps can branch on it without matching a message. */
export const PASSWORD_CHANGE_REQUIRED_TYPE = `${PROBLEM_BASE}/password-change-required`;

export abstract class AppError extends Error {
  abstract readonly status: number;
  abstract readonly type: string;
  abstract readonly title: string;

  /** Field-level problems. Empty for everything except validation failures. */
  readonly errors: readonly FieldError[];

  constructor(
    message: string,
    readonly detail?: string,
    errors: readonly FieldError[] = [],
  ) {
    super(message);
    this.name = new.target.name;
    this.errors = errors;
  }
}

export class ValidationError extends AppError {
  readonly status = 400;
  readonly type = `${PROBLEM_BASE}/validation-failed`;
  readonly title = 'Validation Failed';
}

/** Malformed or missing credentials. Pair with a `WWW-Authenticate` header at the edge. */
export class UnauthorizedError extends AppError {
  readonly status = 401;
  readonly type = `${PROBLEM_BASE}/unauthorized`;
  readonly title = 'Unauthorized';
}

/**
 * Authenticated but not permitted. NOT for cross-tenant access: reaching into another
 * organisation returns NotFoundError, so a 403 never confirms that a record exists
 * (root CLAUDE.md rule 7).
 */
export class ForbiddenError extends AppError {
  readonly status = 403;
  readonly type = `${PROBLEM_BASE}/forbidden`;
  readonly title = 'Forbidden';
}

/**
 * The signed-in user holds a temporary password and has not replaced it yet.
 *
 * A distinct type rather than a plain 403 because the client must act on it, by routing to
 * the password-change screen, and a generic "You do not have permission" is both wrong and
 * a dead end. `PASSWORD_CHANGE_REQUIRED_TYPE` is exported so the client can match the
 * `type` member instead of parsing prose.
 */
export class PasswordChangeRequiredError extends AppError {
  readonly status = 403;
  readonly type = PASSWORD_CHANGE_REQUIRED_TYPE;
  readonly title = 'Password Change Required';
}

export class NotFoundError extends AppError {
  readonly status = 404;
  readonly type = `${PROBLEM_BASE}/not-found`;
  readonly title = 'Not Found';
}

export class ConflictError extends AppError {
  readonly status = 409;
  readonly type = `${PROBLEM_BASE}/conflict`;
  readonly title = 'Conflict';
}

export class TooManyRequestsError extends AppError {
  readonly status = 429;
  readonly type = `${PROBLEM_BASE}/too-many-requests`;
  readonly title = 'Too Many Requests';
}

export class PayloadTooLargeError extends AppError {
  readonly status = 413;
  readonly type = `${PROBLEM_BASE}/payload-too-large`;
  readonly title = 'Payload Too Large';
}

export class ServiceUnavailableError extends AppError {
  readonly status = 503;
  readonly type = `${PROBLEM_BASE}/service-unavailable`;
  readonly title = 'Service Unavailable';
}

export const INTERNAL_ERROR_TYPE = `${PROBLEM_BASE}/internal-error`;
