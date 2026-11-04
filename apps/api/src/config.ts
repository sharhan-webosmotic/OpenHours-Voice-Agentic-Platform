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
 * Comma-separated IP addresses. Empty is only valid alongside an explicit decision to switch
 * the check off (`SARVAM_WEBHOOK_IP_CHECK_DISABLED`), which `configSchema` enforces.
 *
 * Trimmed and emptied-out entries dropped, like the origin list above, so a trailing comma
 * in an environment file does not become an entry that matches nothing.
 */
const addressListSchema = z
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
    /**
     * The Sarvam webhook's body limit. Larger than BODY_LIMIT because the body is a call's
     * whole transcript in two languages, and an invalid body is dropped rather than retried.
     */
    WEBHOOK_BODY_LIMIT: z.string().default('1mb'),

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
    /**
     * Voice tool calls allowed per clinic per minute, and per address before the clinic is
     * known.
     *
     * Tunable because the right number is a property of a clinic's call volume rather than
     * of the code, and because the only way to prove the limiter is keyed per clinic is to
     * lower it in a test and watch one clinic throttle while another does not. The defaults
     * and the arithmetic behind them are in `voice/tools.routes.ts`.
     */
    /**
     * Sarvam's management API, from `docs/sarvam-contract.md`.
     *
     * The key is OPTIONAL, and that is deliberate rather than lax: nothing on the clinic
     * dashboard needs it, the test suite must not have one, and an API that refused to boot
     * without a provider credential would be unrunnable for every developer who is not
     * working on the voice path. The adapter refuses at the point of use instead, which is a
     * clear error naming the missing setting rather than a process that will not start.
     */
    SARVAM_API_KEY: z.string().min(8).optional(),
    SARVAM_ORG_ID: z.string().min(1).optional(),
    SARVAM_WORKSPACE_ID: z.string().min(1).optional(),
    SARVAM_ANALYTICS_BASE_URL: z.url().default('https://apps.sarvam.ai/api/analytics'),
    /**
     * Sarvam's published egress addresses (contract section 2). With the URL secret, this is
     * the control on the webhook (D-006). Configurable because they are a published fact about
     * somebody else's infrastructure, which can change without our deployment changing.
     */
    SARVAM_WEBHOOK_SOURCE_IPS: addressListSchema,
    /**
     * The ONLY way to run without the address check, and it has to be said out loud.
     *
     * An empty allow-list used to mean "off" silently, so the control D-006 names could be
     * missing in production with nobody having decided that. It is not simply required either,
     * because the contract still marks as UNKNOWN whether those addresses are the ones
     * webhooks come from, and a guessed list would refuse every real call. So startup needs
     * one of the two, and fails on neither or both (checked below).
     */
    SARVAM_WEBHOOK_IP_CHECK_DISABLED: z
      .enum(['true', 'false'])
      .default('false')
      .transform((value) => value === 'true'),
    VOICE_TOOL_CALLS_PER_MINUTE_PER_CLINIC: z.coerce.number().int().positive().default(600),
    VOICE_TOOL_CALLS_PER_MINUTE_PER_ADDRESS: z.coerce.number().int().positive().default(3_000),
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

    /**
     * ─── OBJECT STORAGE ─────────────────────────────────────────────────────────
     *
     * S3-COMPATIBLE, NOT S3. The provider is Cloudflare R2 (D-018), and before that it
     * was AWS S3, and locally it is SeaweedFS. All three speak the same API, so the
     * provider is four environment variables rather than a code change: an endpoint, a
     * region, an addressing style and a pair of credentials.
     *
     * The variables keep their `AWS_` names where they already existed, because
     * `docker-compose.yml` and the local SeaweedFS setup use them and because the SDK
     * reads them as a fallback. They mean "S3-compatible credentials" here, not
     * "Amazon credentials".
     */

    /**
     * The S3 endpoint. EMPTY MEANS AWS, which is the only provider whose endpoint the
     * SDK can derive from a region on its own.
     *
     * R2 is `https://<account>.r2.cloudflarestorage.com`, local SeaweedFS is
     * `http://127.0.0.1:<port>`.
     */
    S3_ENDPOINT: z
      .string()
      .default('')
      .transform((raw) => raw.trim().replace(/\/+$/, ''))
      .refine((value) => value === '' || /^https?:\/\//.test(value), {
        message: 'must be empty (AWS) or an http(s) URL',
      }),

    /**
     * `auto` for R2, a real region for AWS.
     *
     * R2 has one global namespace and requires the literal `auto`. Signing still needs
     * SOME region in the credential scope, which is why this cannot simply be omitted.
     */
    AWS_REGION: z.string().min(1).default('ap-south-1'),

    /**
     * Path-style addressing: `endpoint/bucket/key` rather than `bucket.endpoint/key`.
     *
     * TRUE FOR EVERYTHING EXCEPT AWS. R2 and SeaweedFS both serve buckets as a path
     * segment, and a virtual-hosted request to either resolves to a host that does not
     * exist, which fails as a DNS error rather than as anything a reader would connect
     * to addressing.
     */
    S3_FORCE_PATH_STYLE: z
      .enum(['true', 'false'])
      .default('true')
      .transform((raw) => raw === 'true'),

    AWS_ACCESS_KEY_ID: z.string().default(''),
    AWS_SECRET_ACCESS_KEY: z.string().default(''),

    /** Call recordings. PHI, private, and only ever served as a presigned URL (D-007). */
    RECORDINGS_BUCKET: z.string().default('clinicai-recordings'),
    /** Nightly database dumps. Separate bucket: a different lifecycle and a different blast radius. */
    BACKUPS_BUCKET: z.string().default('clinicai-backups'),

    /**
     * How long a presigned URL stays valid, in seconds.
     *
     * Five minutes by default and capped at an hour. A recording URL is a bearer
     * credential for patient audio: anyone holding the link can play it, so it has to
     * outlive the click and nothing more.
     */
    PRESIGNED_URL_TTL_SECONDS: z.coerce.number().int().positive().max(3600).default(300),

    /** How many days of database dumps to keep in the backups bucket. */
    BACKUP_RETENTION_DAYS: z.coerce.number().int().positive().max(3650).default(30),
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

    /**
     * A non-AWS endpoint with virtual-hosted addressing is a misconfiguration that
     * fails as a DNS error at the first upload, which is a long way from its cause.
     */
    if (value.S3_ENDPOINT !== '' && !value.S3_FORCE_PATH_STYLE) {
      ctx.addIssue({
        code: 'custom',
        path: ['S3_FORCE_PATH_STYLE'],
        message:
          'a custom S3_ENDPOINT (R2, SeaweedFS, MinIO) needs path-style addressing: set S3_FORCE_PATH_STYLE=true',
      });
    }

    /**
     * The webhook's address check is either configured or deliberately switched off, never
     * missing by omission (D-006).
     */
    if (value.SARVAM_WEBHOOK_SOURCE_IPS.length === 0 && !value.SARVAM_WEBHOOK_IP_CHECK_DISABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['SARVAM_WEBHOOK_SOURCE_IPS'],
        message:
          'set the webhook source addresses, or set SARVAM_WEBHOOK_IP_CHECK_DISABLED=true to run without the check deliberately',
      });
    }

    if (value.SARVAM_WEBHOOK_SOURCE_IPS.length > 0 && value.SARVAM_WEBHOOK_IP_CHECK_DISABLED) {
      ctx.addIssue({
        code: 'custom',
        path: ['SARVAM_WEBHOOK_IP_CHECK_DISABLED'],
        message:
          'contradicts SARVAM_WEBHOOK_SOURCE_IPS: choose either an allow-list or a disabled check',
      });
    }

    /**
     * In production the credentials must be present. Locally they come from the compose
     * file, and in tests the storage client is never constructed, so an empty pair is
     * allowed to keep `pnpm test` runnable without secrets.
     */
    if (value.NODE_ENV === 'production') {
      for (const key of ['AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY'] as const) {
        if (value[key] === '') {
          ctx.addIssue({
            code: 'custom',
            path: [key],
            message: 'is required in production',
          });
        }
      }
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
