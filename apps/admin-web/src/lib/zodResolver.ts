import type { FieldErrors, FieldValues, Resolver } from 'react-hook-form';
import type { ZodType } from 'zod';

/**
 * A React Hook Form resolver built from a zod schema.
 *
 * WRITTEN HERE RATHER THAN ADDED AS A DEPENDENCY. `@hookform/resolvers` does this and is
 * not installed, and dependencies need approval before they are added (root CLAUDE.md). A
 * resolver is a function from values to `{ values, errors }`, so the whole adapter is the
 * thirty lines below, and the alternative was validating by hand in every submit handler,
 * which is how two forms end up disagreeing about what a valid phone number is.
 *
 * IT VALIDATES WITH THE SHARED SCHEMA, which is the point: the API parses the request with
 * the same object. A rule enforced in one place therefore holds in both, and a rule that
 * changes changes once.
 *
 * ON SUCCESS IT RETURNS THE PARSED VALUES, not the raw ones. That matters because these
 * schemas transform as well as validate: a phone number typed as `98765 43210` comes back
 * as `+919876543210`, and an email comes back lower-cased. Returning the raw input would
 * send the untransformed value and leave the normalisation to the server, which works but
 * means the form shows something different from what was stored.
 */
export const zodResolver =
  <TValues extends FieldValues>(schema: ZodType): Resolver<TValues> =>
  (values) => {
    const result = schema.safeParse(values);

    if (result.success) {
      return { values: result.data as TValues, errors: {} };
    }

    const errors: Record<string, { type: string; message: string }> = {};

    for (const issue of result.error.issues) {
      // `path` is empty for an object-level refinement, such as "a consent mode that plays
      // a notice needs the notice". Those are attached to the form root so they are shown
      // rather than silently dropped.
      const field = issue.path.length === 0 ? 'root' : issue.path.map(String).join('.');

      // First issue per field wins: showing a field's second complaint under its first is
      // noise, and the first is the one the user has to act on.
      errors[field] ??= { type: issue.code, message: issue.message };
    }

    return { values: {}, errors: errors as FieldErrors<TValues> };
  };
