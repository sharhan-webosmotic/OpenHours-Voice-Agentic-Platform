import { z } from 'zod';

/**
 * The ONLY reader of process.env in apps/api (see apps/api/CLAUDE.md).
 * Everything else imports `config`. Parse, do not trust.
 */

/** Comma-separated origin allow-list. Empty means "no cross-origin browser access". */
const originListSchema = z
  .string()
  .default('')
  .transform((raw) =>
    raw
      .split(',')
      .map((value) => value.trim())
      .filter((value) => value.length > 0),
  );

/**
 * `false`, or the number of reverse-proxy hops to trust.
 *
 * Deliberately cannot be `true`. Express's `trust proxy: true` trusts the whole
 * X-Forwarded-For chain, which lets any client spoof its own address and evade a
 * rate limit keyed on IP. express-rate-limit rejects that setting for the same reason.
 */
const trustProxySchema = z
  .string()
  .default('false')
  .transform((raw) => raw.trim().toLowerCase())
  .refine((raw) => raw === 'false' || /^\d+$/.test(raw), {
    message: 'must be "false" or a number of proxy hops (never "true")',
  })
  .transform((raw) => (raw === 'false' ? (false as const) : Number.parseInt(raw, 10)));

const configSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    PORT: z.coerce.number().int().positive().max(65535).default(3000),
    LOG_LEVEL: z
      .enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal', 'silent'])
      .default('info'),
    DATABASE_URL: z.string().min(1),
    SHUTDOWN_TIMEOUT_MS: z.coerce.number().int().positive().default(10_000),

    CORS_ALLOWED_ORIGINS: originListSchema,
    CORS_ALLOW_CREDENTIALS: z
      .enum(['true', 'false'])
      .default('true')
      .transform((raw) => raw === 'true'),

    TRUST_PROXY: trustProxySchema,
    /** Max JSON request body, in the byte-string form `express.json` accepts. */
    BODY_LIMIT: z.string().default('100kb'),

    RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(100),

    /**
     * Signing key for access tokens. 32 bytes minimum: a shorter key weakens HS256 to
     * the point where the signature is the weakest part of the system.
     */
    JWT_SECRET: z.string().min(32),
    /** Access tokens are short-lived because they cannot be revoked once issued. */
    ACCESS_TOKEN_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(900),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().max(90).default(14),
    /** Failed logins before the account locks. */
    LOGIN_MAX_FAILURES: z.coerce.number().int().positive().default(5),
    LOCKOUT_MINUTES: z.coerce.number().int().positive().default(15),
    /**
     * Login throttling. Per IP blunts a distributed sweep; per email stops one account
     * being ground down from many addresses. Configurable because the right numbers
     * differ between a test run, a single-tenant staging box and production behind a
     * load balancer.
     */
    AUTH_RATE_LIMIT_WINDOW_MS: z.coerce.number().int().positive().default(60_000),
    AUTH_RATE_LIMIT_MAX_PER_IP: z.coerce.number().int().positive().default(10),
    AUTH_RATE_LIMIT_MAX_PER_EMAIL: z.coerce.number().int().positive().default(5),
    /** Lifetime of a device pairing code, in minutes. */
    PAIRING_CODE_TTL_MINUTES: z.coerce.number().int().positive().default(10),
    /** Set Secure on cookies. Off only for plain-HTTP local development. */
    COOKIE_SECURE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((raw) => raw === 'true'),
  })
  .superRefine((value, ctx) => {
    // A wildcard origin with credentials lets any site read authenticated responses.
    // Browsers reject the combination anyway; failing at boot makes it un-deployable
    // rather than a surprise at runtime.
    if (value.CORS_ALLOW_CREDENTIALS && value.CORS_ALLOWED_ORIGINS.includes('*')) {
      ctx.addIssue({
        code: 'custom',
        path: ['CORS_ALLOWED_ORIGINS'],
        message: 'wildcard origin "*" cannot be combined with CORS_ALLOW_CREDENTIALS=true',
      });
    }
  });

export type Config = Readonly<z.infer<typeof configSchema>>;

export const parseConfig = (env: NodeJS.ProcessEnv): Config => {
  const parsed = configSchema.safeParse(env);

  if (!parsed.success) {
    // Report which variables are wrong and why, never their values: process.env
    // holds secrets and this message reaches logs.
    const problems = parsed.error.issues
      .map((issue) => `${issue.path.join('.') || '(root)'}: ${issue.message}`)
      .join('; ');
    throw new Error(`Invalid environment configuration. ${problems}`);
  }

  return Object.freeze(parsed.data);
};

export const config: Config = parseConfig(process.env);
