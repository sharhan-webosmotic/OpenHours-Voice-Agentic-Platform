import { inject } from 'vitest';

/**
 * Points src/config.ts at the test container.
 *
 * Runs as a Vitest setupFile, i.e. in the worker BEFORE the test file's imports, which
 * is the only moment this can happen: config.ts validates process.env at import time, so
 * setting these afterwards would be too late.
 *
 * The connection is app_user's, the same non-owner role the API uses, so anything the
 * application code does in these tests is subject to row-level security.
 */
process.env.DATABASE_URL = inject('appUserUrl');
process.env.NODE_ENV = 'test';
process.env.LOG_LEVEL = 'silent';
process.env.JWT_SECRET = 'database-test-jwt-secret-at-least-32-bytes';
// Plain HTTP in tests, so Secure would stop supertest from ever sending the cookie back.
process.env.COOKIE_SECURE = 'false';
process.env.CORS_ALLOWED_ORIGINS = 'https://clinic.test';

/**
 * Login throttling is raised for the suite. The limiters are module singletons with an
 * in-memory store, so every test in a file shares one bucket and the production limits
 * would throttle the suite itself rather than the behaviour under test.
 *
 * The throttle is not untested as a result: auth.test.ts exhausts the per-email bucket
 * against a dedicated address, and hardening.test.ts covers the 429 problem+json body
 * and the keyGenerator at the factory level.
 */
process.env.AUTH_RATE_LIMIT_MAX_PER_IP = '1000';
process.env.AUTH_RATE_LIMIT_MAX_PER_EMAIL = '1000';
