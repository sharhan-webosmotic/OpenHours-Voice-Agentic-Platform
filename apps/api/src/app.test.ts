import { describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { createApp } from './app.js';

const appWithReadiness = (readiness: () => Promise<void>) => createApp({ readiness });

describe('GET /health', () => {
  it('returns 200 without touching any dependency', async () => {
    const readiness = vi.fn<() => Promise<void>>(() => Promise.resolve());

    const response = await request(appWithReadiness(readiness)).get('/health');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ok' });
    expect(readiness).not.toHaveBeenCalled();
  });

  it('still returns 200 when the database is down', async () => {
    const response = await request(
      appWithReadiness(() => Promise.reject(new Error('connection refused'))),
    ).get('/health');

    expect(response.status).toBe(200);
  });
});

describe('GET /ready', () => {
  it('returns 200 when the database answers', async () => {
    const readiness = vi.fn<() => Promise<void>>(() => Promise.resolve());

    const response = await request(appWithReadiness(readiness)).get('/ready');

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ status: 'ready' });
    expect(readiness).toHaveBeenCalledOnce();
  });

  it('returns 503 problem+json when the database does not answer', async () => {
    const response = await request(
      appWithReadiness(() => Promise.reject(new Error('connection refused'))),
    ).get('/ready');

    expect(response.status).toBe(503);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(response.body).toMatchObject({ status: 503, title: 'Service Unavailable' });
  });

  it('never leaks the underlying driver error to the client', async () => {
    const response = await request(
      appWithReadiness(() =>
        Promise.reject(new Error('password authentication failed for user "openhours"')),
      ),
    ).get('/ready');

    expect(JSON.stringify(response.body)).not.toContain('password');
  });
});

describe('unknown routes', () => {
  it('return 404 problem+json', async () => {
    const response = await request(appWithReadiness(() => Promise.resolve())).get('/nope');

    expect(response.status).toBe(404);
    expect(response.body).toMatchObject({ status: 404, title: 'Not Found' });
  });
});
