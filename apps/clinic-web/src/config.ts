import { z } from 'zod';

/**
 * The application's configuration, parsed once at module load.
 *
 * Parsed with zod rather than read ad hoc, for the same reason the API parses its
 * environment: a missing or malformed API origin must fail immediately and say what is
 * wrong, not surface later as a fetch to `undefined/api/v1/auth/login` that looks like a
 * network problem.
 *
 * Only `VITE_`-prefixed variables exist here, because Vite inlines nothing else into the
 * bundle. That is a useful property rather than a limitation: anything secret cannot be
 * put here by accident, since it would have to be renamed to be visible, and renaming it
 * is a deliberate act a reviewer can see.
 */

const schema = z.object({
  /** The API origin, without a trailing slash: `https://api.clinicai.health`. */
  VITE_API_URL: z
    .string()
    .url()
    .transform((value) => value.replace(/\/+$/, '')),
});

const parsed = schema.safeParse(import.meta.env);

if (!parsed.success) {
  // Thrown at import, so a misconfigured build fails on load rather than on first use.
  throw new Error(
    `Invalid configuration: ${parsed.error.issues
      .map((issue) => `${issue.path.join('.')} ${issue.message}`)
      .join('; ')}`,
  );
}

export const config = parsed.data;
