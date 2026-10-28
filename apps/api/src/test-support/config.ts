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
    RATE_LIMIT_WINDOW_MS: 60_000,
    RATE_LIMIT_MAX: 100,
    JWT_SECRET: 'test-jwt-secret-at-least-32-bytes-long!!',
    ACCESS_TOKEN_TTL_SECONDS: 900,
    REFRESH_TOKEN_TTL_DAYS: 14,
    LOGIN_MAX_FAILURES: 5,
    LOCKOUT_MINUTES: 15,
    AUTH_RATE_LIMIT_WINDOW_MS: 60_000,
    AUTH_RATE_LIMIT_MAX_PER_IP: 10,
    AUTH_RATE_LIMIT_MAX_PER_EMAIL: 5,
    PAIRING_CODE_TTL_MINUTES: 10,
    COOKIE_SECURE: true,
    ...overrides,
  });
