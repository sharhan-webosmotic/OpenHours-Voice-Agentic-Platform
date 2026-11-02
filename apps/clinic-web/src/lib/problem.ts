import { ApiError, type ProblemDetails } from '@clinicai/api-client';
import type { FieldValues, Path, UseFormSetError } from 'react-hook-form';

/**
 * Turning the API's problem+json into something a screen can show.
 *
 * ONE COPY PER APPLICATION (D-009). The admin console has the same three functions inside
 * its clinics feature, and when that console moves to its own repository this is the copy
 * that stays here. A change to one has to be applied to both, and nothing enforces it.
 *
 * TWO ERROR SHAPES REACH THESE, which is why the narrowing exists. A direct call on the API
 * client rejects with the `ApiError` class; anything that went through the RTK Query cache
 * rejects with the bare problem document, because the store may only hold serializable
 * values. Handling one and not the other is how an error message becomes "[object Object]".
 */

/** Narrows either shape to a problem document, without casting anything unchecked. */
export const toProblemDetails = (error: unknown): ProblemDetails | undefined => {
  if (error instanceof ApiError) {
    return error.problem;
  }

  if (typeof error === 'object' && error !== null && 'status' in error && 'title' in error) {
    const candidate = error as { readonly status: unknown; readonly title: unknown };

    if (typeof candidate.status === 'number' && typeof candidate.title === 'string') {
      return error as ProblemDetails;
    }
  }

  return undefined;
};

/**
 * A sentence to show the user, never a stack trace and never a raw object.
 *
 * The `detail` the API sends is written to be read by a person: "That time was just taken by
 * another booking. Please choose another." The fallback matters as much, because an error
 * with no message at all is how a screen ends up showing nothing when something went wrong.
 */
export const errorMessage = (error: unknown, fallback: string): string => {
  const problem = toProblemDetails(error);

  if (problem === undefined) {
    return error instanceof Error ? error.message : fallback;
  }

  // `status: 0` is the transport failure the baseQuery produces when no server answered.
  if (problem.status === 0) {
    return 'Could not reach the server. Check the connection and try again.';
  }

  return problem.detail ?? problem.title ?? fallback;
};

/** Whether the server said "not found", which a screen renders as its own state. */
export const isNotFound = (error: unknown): boolean => toProblemDetails(error)?.status === 404;

/**
 * Puts the server's field errors onto a form.
 *
 * The API answers a validation failure with `errors[]`, each naming a field as `body.phone`.
 * The prefix is stripped because the form knows its fields by their own names, and anything
 * unrecognised is returned to be shown at the top rather than swallowed: an unmapped field
 * error otherwise leaves the user looking at a form that refused to save and said nothing.
 */
export const applyServerErrors = <TValues extends FieldValues>(
  error: unknown,
  setError: UseFormSetError<TValues>,
  fallback: string,
): string | undefined => {
  const problem = toProblemDetails(error);
  const fieldErrors = problem?.errors ?? [];

  if (fieldErrors.length === 0) {
    return errorMessage(error, fallback);
  }

  const unmapped: string[] = [];

  for (const fieldError of fieldErrors) {
    const name = fieldError.field.replace(/^body\./, '');

    if (name === '' || name === 'body') {
      unmapped.push(fieldError.message);
      continue;
    }

    setError(name as Path<TValues>, { type: 'server', message: fieldError.message });
  }

  return unmapped.length === 0 ? undefined : unmapped.join(' ');
};
