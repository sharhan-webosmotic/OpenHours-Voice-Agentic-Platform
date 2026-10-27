import { z } from 'zod';

/**
 * The ONLY reader of process.env in apps/api (see apps/api/CLAUDE.md).
 * Everything else imports `config`. Parse, do not trust.
 */
const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().max(65535).default(3000),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent']).default('info'),
  DATABASE_URL: z.string().min(1),
  SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),
});

export type Config = Readonly<z.infer<typeof configSchema>>;

const parsed = configSchema.safeParse(process.env);

if (!parsed.success) {
  // Never print the values, only which variables are wrong: process.env holds secrets.
  const invalid = parsed.error.issues.map((issue) => issue.path.join('.')).join(', ');
  throw new Error(`Invalid environment configuration. Check these variables: ${invalid}`);
}

export const config: Config = Object.freeze(parsed.data);
