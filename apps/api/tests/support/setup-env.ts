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
// Webhooks are replayed from 127.0.0.1, so the address check is off on purpose (D-006).
// The one suite that tests the check sets its own allow-list.
process.env.SARVAM_WEBHOOK_IP_CHECK_DISABLED ??= 'true';

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

/**
 * Synthetic object-storage credentials, so a presigned URL can be SIGNED in tests.
 *
 * Signing is arithmetic over the key and the credentials: it opens no connection and needs
 * no bucket to exist. Without any credentials at all the SDK's provider chain searches the
 * environment, a shared credentials file and an instance profile, and then fails, which
 * surfaced as a 500 from the recording endpoint rather than as anything about credentials.
 *
 * The endpoint stays unset, so the URL is signed against a real AWS host that nothing in
 * these tests ever fetches. What is asserted is that a URL was minted and audited, never
 * that the bytes arrive.
 */
process.env.AWS_ACCESS_KEY_ID = 'database-test-access-key-id';
process.env.AWS_SECRET_ACCESS_KEY = 'database-test-secret-access-key';
