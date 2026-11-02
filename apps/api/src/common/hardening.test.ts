import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { createApp } from '../app.js';
import { parseConfig, type Config } from '../config.js';
import { makeTestConfig } from '../test-support/config.js';
import { createRateLimiter } from './rate-limit.js';
import { PROBLEM_JSON_CONTENT_TYPE, toProblemDetails } from './problem-details.js';
import { getContext } from './request-context.js';
import { requestContextMiddleware } from './request-context.middleware.js';
import { problemBody } from '../test-support/http.js';

const ALLOWED = 'https://clinic.clinicai.health';
const DENIED = 'https://evil.example.com';

const buildApp = (overrides: Partial<Config> = {}) =>
  createApp({
    readiness: () => Promise.resolve(),
    config: makeTestConfig({ CORS_ALLOWED_ORIGINS: [ALLOWED], ...overrides }),
  });

describe('CORS allow-list', () => {
  it('allows an allow-listed origin and echoes it, never "*"', async () => {
    const response = await request(buildApp()).get('/health').set('Origin', ALLOWED);

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(response.headers['access-control-allow-origin']).not.toBe('*');
    expect(response.headers['access-control-allow-credentials']).toBe('true');
  });

  it('denies an unknown origin by omitting the CORS header', async () => {
    const response = await request(buildApp()).get('/health').set('Origin', DENIED);

    // cors omits the header rather than erroring; the browser then blocks the read.
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('allows a preflight from an allow-listed origin', async () => {
    const response = await request(buildApp())
      .options('/health')
      .set('Origin', ALLOWED)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBe(ALLOWED);
    expect(response.headers['access-control-allow-methods']).toContain('POST');
  });

  it('denies a preflight from an unknown origin', async () => {
    const response = await request(buildApp())
      .options('/health')
      .set('Origin', DENIED)
      .set('Access-Control-Request-Method', 'POST');

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('adds no CORS headers when there is no Origin (server-to-server)', async () => {
    const response = await request(buildApp()).get('/health');

    expect(response.status).toBe(200);
    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('exposes X-Request-Id to the browser', async () => {
    const response = await request(buildApp()).get('/health').set('Origin', ALLOWED);

    expect(response.headers['access-control-expose-headers']).toContain('X-Request-Id');
  });

  it('an empty allow-list denies every origin', async () => {
    const response = await request(buildApp({ CORS_ALLOWED_ORIGINS: [] }))
      .get('/health')
      .set('Origin', ALLOWED);

    expect(response.headers['access-control-allow-origin']).toBeUndefined();
  });
});

/** The minimum a valid environment needs, so each test varies only what it is about. */
const REQUIRED_ENV = {
  DATABASE_URL: 'postgresql://t:t@127.0.0.1:1/t',
  JWT_SECRET: 'config-test-jwt-secret-at-least-32-bytes',
} as const;

describe('config refuses a wildcard origin with credentials', () => {
  const base = { ...REQUIRED_ENV, CORS_ALLOWED_ORIGINS: '*' };

  it('requires a JWT secret of at least 32 bytes', () => {
    // A shorter key makes the HS256 signature the weakest part of the system.
    expect(() => parseConfig({ ...REQUIRED_ENV, JWT_SECRET: 'too-short' })).toThrow(/JWT_SECRET/);
  });

  it('throws when credentials are enabled', () => {
    expect(() => parseConfig({ ...base, CORS_ALLOW_CREDENTIALS: 'true' })).toThrow(
      /wildcard origin/,
    );
  });

  it('permits a wildcard only without credentials', () => {
    const config = parseConfig({ ...base, CORS_ALLOW_CREDENTIALS: 'false' });

    expect(config.CORS_ALLOWED_ORIGINS).toEqual(['*']);
    expect(config.CORS_ALLOW_CREDENTIALS).toBe(false);
  });
});

describe('trust proxy', () => {
  it('defaults to false', () => {
    const config = parseConfig(REQUIRED_ENV);

    expect(config.TRUST_PROXY).toBe(false);
  });

  it('refuses "true", which would let any client spoof its address', () => {
    expect(() => parseConfig({ ...REQUIRED_ENV, TRUST_PROXY: 'true' })).toThrow(/never "true"/);
  });

  it('accepts a hop count', () => {
    const config = parseConfig({ ...REQUIRED_ENV, TRUST_PROXY: '2' });

    expect(config.TRUST_PROXY).toBe(2);
  });

  it('the real app applies TRUST_PROXY to express', () => {
    expect(buildApp({ TRUST_PROXY: false }).get('trust proxy')).toBe(false);
    expect(buildApp({ TRUST_PROXY: 2 }).get('trust proxy')).toBe(2);
  });

  it('ignores X-Forwarded-For when trust proxy is false', async () => {
    let observedIp: string | undefined;
    const probe = express();
    probe.set('trust proxy', false);
    probe.get('/ip', (req, res) => {
      observedIp = req.ip;
      res.status(200).json({ ok: true });
    });

    await request(probe).get('/ip').set('X-Forwarded-For', '203.0.113.9');

    // The spoofed address must not become req.ip, or an IP-keyed rate limit is bypassed
    // by sending a different X-Forwarded-For on every request.
    expect(observedIp).not.toBe('203.0.113.9');
  });

  it('honours X-Forwarded-For once a hop is trusted', async () => {
    let observedIp: string | undefined;
    const probe = express();
    probe.set('trust proxy', 1);
    probe.get('/ip', (req, res) => {
      observedIp = req.ip;
      res.status(200).json({ ok: true });
    });

    await request(probe).get('/ip').set('X-Forwarded-For', '203.0.113.9');

    expect(observedIp).toBe('203.0.113.9');
  });
});

/** Minimal app: context -> limiter -> route -> problem+json handler. */
const rateLimitedApp = (limiter: express.RequestHandler) => {
  const app = express();
  app.set('trust proxy', false);
  app.use(requestContextMiddleware);
  app.use(express.json());
  app.post('/limited', limiter, (_req, res) => {
    res.status(200).json({ ok: true });
  });
  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const problem = toProblemDetails(error, getContext()?.requestId);
      res.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
    },
  );
  return app;
};

describe('rate limiter', () => {
  it('returns 429 problem+json once the limit is exceeded', async () => {
    const app = rateLimitedApp(createRateLimiter({ windowMs: 60_000, limit: 1 }));

    const first = await request(app).post('/limited').send({});
    const second = await request(app).post('/limited').send({});

    expect(first.status).toBe(200);
    expect(second.status).toBe(429);
    expect(second.headers['content-type']).toContain('application/problem+json');
    expect(problemBody(second)).toMatchObject({
      status: 429,
      title: 'Too Many Requests',
      type: 'https://clinicai.health/problems/too-many-requests',
    });
    expect(problemBody(second).requestId).toBeTypeOf('string');
    expect(problemBody(second)).not.toHaveProperty('stack');
  });

  it('sets draft-8 RateLimit headers and no legacy X-RateLimit headers', async () => {
    const app = rateLimitedApp(createRateLimiter({ windowMs: 60_000, limit: 5 }));

    const response = await request(app).post('/limited').send({});

    expect(response.headers['ratelimit']).toBeDefined();
    expect(response.headers['x-ratelimit-limit']).toBeUndefined();
  });

  it('buckets by a custom keyGenerator', async () => {
    // Voice and webhook routes arrive from a small set of fixed provider addresses, so
    // an IP bucket would throttle every clinic together. They key on the id resolved
    // from the verified payload instead.
    const app = rateLimitedApp(
      createRateLimiter({
        windowMs: 60_000,
        limit: 1,
        keyGenerator: (req) => String((req.body as { agentId?: string } | undefined)?.agentId),
      }),
    );

    const agentA1 = await request(app).post('/limited').send({ agentId: 'agent_a' });
    const agentA2 = await request(app).post('/limited').send({ agentId: 'agent_a' });
    const agentB1 = await request(app).post('/limited').send({ agentId: 'agent_b' });

    expect(agentA1.status).toBe(200);
    // Same key is throttled...
    expect(agentA2.status).toBe(429);
    // ...while a different key still has its own budget.
    expect(agentB1.status).toBe(200);
  });
});

describe('helmet', () => {
  it('sets baseline security headers and removes x-powered-by', async () => {
    const response = await request(buildApp()).get('/health');

    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['x-frame-options']).toBeDefined();
    expect(response.headers['x-powered-by']).toBeUndefined();
  });
});
