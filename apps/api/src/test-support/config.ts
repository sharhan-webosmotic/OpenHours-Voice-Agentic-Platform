import type { Config } from '../config.js';

/**
 * Builds a Config for tests. Centralised so adding a config field does not break every
 * test that happens to need one. Values are synthetic: port 1 never hosts PostgreSQL,
 * so a connection attempt fails fast instead of reaching a real database.
 */
export const makeTestConfig = (overrides: Partial<Config> = {}): Config =>
  Object.freeze({
    NODE_ENV: 'test',
    PORT: 3000,
    LOG_LEVEL: 'silent',
    DATABASE_URL: 'postgresql://test:test@127.0.0.1:1/test',
    SHUTDOWN_TIMEOUT_MS: 10_000,
    CORS_ALLOWED_ORIGINS: [],
    CORS_ALLOW_CREDENTIALS: true,
    TRUST_PROXY: false,
    BODY_LIMIT: '100kb',
    WEBHOOK_BODY_LIMIT: '1mb',
    JWT_SECRET: 'test-jwt-secret-at-least-32-bytes-long!!',
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 14,
    LOGIN_MAX_FAILURES: 5,
    LOCKOUT_MINUTES: 15,
    SARVAM_ANALYTICS_BASE_URL: 'http://127.0.0.1:1',
    SARVAM_WEBHOOK_SOURCE_IPS: [],
    SARVAM_WEBHOOK_IP_CHECK_DISABLED: true,
    VOICE_TOOL_CALLS_PER_MINUTE_PER_CLINIC: 600,
    VOICE_TOOL_CALLS_PER_MINUTE_PER_ADDRESS: 3_000,
    AUTH_RATE_LIMIT_WINDOW_MS: 60_000,
    AUTH_RATE_LIMIT_MAX_PER_IP: 10,
    AUTH_RATE_LIMIT_MAX_PER_EMAIL: 5,
    PAIRING_CODE_TTL_MINUTES: 10,
    COOKIE_SECURE: true,
    /**
     * Object storage, pointed at a port nothing listens on, like the database URL above.
     * A test that reaches storage by accident fails fast rather than talking to a real
     * bucket, and the credentials are obviously synthetic.
     */
    S3_ENDPOINT: 'http://127.0.0.1:1',
    AWS_REGION: 'ap-south-1',
    S3_FORCE_PATH_STYLE: true,
    AWS_ACCESS_KEY_ID: 'test-access-key-id',
    AWS_SECRET_ACCESS_KEY: 'test-secret-access-key',
    RECORDINGS_BUCKET: 'test-recordings',
    BACKUPS_BUCKET: 'test-backups',
    PRESIGNED_URL_TTL_SECONDS: 300,
    BACKUP_RETENTION_DAYS: 30,
    ...overrides,
  });
