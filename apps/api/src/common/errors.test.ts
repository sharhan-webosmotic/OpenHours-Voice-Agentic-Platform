import { describe, expect, it } from 'vitest';
import request from 'supertest';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ServiceUnavailableError,
  TooManyRequestsError,
  UnauthorizedError,
  ValidationError,
} from './errors.js';
import { toProblemDetails } from './problem-details.js';
import { createApp } from '../app.js';
import { makeTestConfig } from '../test-support/config.js';
import { problemBody } from '../test-support/http.js';

const okReadiness = () => Promise.resolve();

const cases = [
  {
    error: new ValidationError('bad', 'The request is invalid.'),
    status: 400,
    title: 'Validation Failed',
  },
  {
    error: new UnauthorizedError('no creds', 'Authentication required.'),
    status: 401,
    title: 'Unauthorized',
  },
  { error: new ForbiddenError('nope', 'You may not do that.'), status: 403, title: 'Forbidden' },
  { error: new NotFoundError('missing', 'Not found.'), status: 404, title: 'Not Found' },
  { error: new ConflictError('taken', 'Slot already booked.'), status: 409, title: 'Conflict' },
  {
    error: new TooManyRequestsError('slow down', 'Too many requests.'),
    status: 429,
    title: 'Too Many Requests',
  },
  {
    error: new ServiceUnavailableError('down', 'A dependency is unavailable.'),
    status: 503,
    title: 'Service Unavailable',
  },
] as const;

describe('AppError subclasses render as problem+json', () => {
  for (const { error, status, title } of cases) {
    it(`${error.name} -> ${status}`, () => {
      const problem = toProblemDetails(error, 'req-1');

      expect(problem.status).toBe(status);
      expect(problem.title).toBe(title);
      expect(problem.type).toMatch(/^https:\/\/openhours\.health\/problems\//);
      expect(problem.detail).toBe(error.detail);
      expect(problem.requestId).toBe('req-1');
      expect(problem).not.toHaveProperty('stack');
    });
  }

  it('includes errors[] only for field problems', () => {
    const withFields = toProblemDetails(
      new ValidationError('bad', 'The request is invalid.', [
        { field: 'body.email', message: 'Invalid email', code: 'invalid_format' },
      ]),
      'req-2',
    );
    const withoutFields = toProblemDetails(new ConflictError('taken'), 'req-2');

    expect(withFields.errors).toHaveLength(1);
    expect(withFields.errors?.[0]?.field).toBe('body.email');
    expect(withoutFields).not.toHaveProperty('errors');
  });

  it('omits requestId when there is no context', () => {
    expect(toProblemDetails(new ConflictError('taken'))).not.toHaveProperty('requestId');
  });
});

describe('non-AppError values become an opaque 500', () => {
  it('leaks neither message nor stack', () => {
    const problem = toProblemDetails(
      new Error('ECONNREFUSED postgres://user:pa55w0rd@10.0.0.4:5432/openhours'),
      'req-3',
    );

    expect(problem.status).toBe(500);
    expect(problem.title).toBe('Internal Server Error');
    expect(problem).not.toHaveProperty('detail');
    expect(problem).not.toHaveProperty('stack');
    expect(JSON.stringify(problem)).not.toContain('pa55w0rd');
    expect(JSON.stringify(problem)).not.toContain('ECONNREFUSED');
  });

  it('handles thrown non-errors', () => {
    for (const thrown of ['a string', 42, null, undefined, { weird: true }]) {
      expect(toProblemDetails(thrown, 'req-4').status).toBe(500);
    }
  });
});

describe('error handling over HTTP', () => {
  const buildApp = (overrides = {}) =>
    createApp({ readiness: okReadiness, config: makeTestConfig(overrides) });

  it('unknown route -> 404 problem+json', async () => {
    const response = await request(buildApp()).get('/does-not-exist');

    expect(response.status).toBe(404);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(problemBody(response)).toMatchObject({ status: 404, title: 'Not Found' });
    expect(problemBody(response).requestId).toBeTypeOf('string');
  });

  it('malformed JSON body -> 400 problem+json', async () => {
    const response = await request(buildApp())
      .post('/health')
      .set('Content-Type', 'application/json')
      .send('{"not valid json');

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(problemBody(response)).toMatchObject({ status: 400, title: 'Validation Failed' });
    expect(problemBody(response)).not.toHaveProperty('stack');
  });

  it('oversized body -> 413 problem+json', async () => {
    const response = await request(buildApp({ BODY_LIMIT: '1kb' }))
      .post('/health')
      .set('Content-Type', 'application/json')
      .send(JSON.stringify({ padding: 'x'.repeat(4096) }));

    expect(response.status).toBe(413);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(problemBody(response)).toMatchObject({ status: 413, title: 'Payload Too Large' });
  });

  it('a failing readiness probe renders 503, not 500, and hides driver detail', async () => {
    const app = createApp({
      readiness: () => Promise.reject(new Error('password authentication failed for user "app"')),
      config: makeTestConfig(),
    });

    const response = await request(app).get('/ready');

    // 503 means "a dependency is down", which is what an orchestrator acts on. A 500
    // would say "this process is broken" and is the wrong signal.
    expect(response.status).toBe(503);
    expect(problemBody(response)).toMatchObject({ status: 503, title: 'Service Unavailable' });
    expect(JSON.stringify(problemBody(response))).not.toContain('password');
  });
});
