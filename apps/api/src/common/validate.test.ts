import { describe, expect, it } from 'vitest';
import request from 'supertest';
import express from 'express';
import { z } from 'zod';
import { validate, validatedData } from './validate.js';
import { PROBLEM_JSON_CONTENT_TYPE, toProblemDetails } from './problem-details.js';
import { getContext } from './request-context.js';
import { requestContextMiddleware } from './request-context.middleware.js';
import { fieldErrors, jsonBody, problemBody } from '../test-support/http.js';

const bodySchema = z.object({
  email: z.string().email(),
  age: z.coerce.number().int().min(0).max(130),
});
const paramsSchema = z.object({ id: z.string().uuid() });
const querySchema = z.object({ limit: z.coerce.number().int().min(1).max(100).default(20) });

const buildApp = () => {
  const app = express();
  app.use(requestContextMiddleware);
  app.use(express.json());

  app.post(
    '/items/:id',
    validate({ params: paramsSchema, query: querySchema, body: bodySchema }),
    (req, res) => {
      res.status(200).json(validatedData(req));
    },
  );

  app.get('/unvalidated', (req, res) => {
    // Reading validated data where validate() never ran is a programming error.
    try {
      validatedData(req);
      res.status(200).json({ ok: true });
    } catch (error) {
      res.status(500).json({ message: (error as Error).message });
    }
  });

  app.use(
    (error: unknown, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
      const problem = toProblemDetails(error, getContext()?.requestId);
      res.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
    },
  );
  return app;
};

const VALID_ID = '0189d7f1-9b3a-4c2e-8f1a-2b3c4d5e6f70';

describe('validation failures render 400 problem+json with field errors', () => {
  it('reports a bad body field', async () => {
    const response = await request(buildApp())
      .post(`/items/${VALID_ID}`)
      .send({ email: 'not-an-email', age: 30 });

    expect(response.status).toBe(400);
    expect(response.headers['content-type']).toContain('application/problem+json');
    expect(problemBody(response)).toMatchObject({ status: 400, title: 'Validation Failed' });
    const errors = fieldErrors(response);
    expect(errors).toHaveLength(1);
    expect(errors[0]?.field).toBe('body.email');
    expect(errors[0]?.message).toBeTypeOf('string');
    expect(problemBody(response).requestId).toBeTypeOf('string');
  });

  it('reports every problem across params, query and body in one response', async () => {
    const response = await request(buildApp())
      .post('/items/not-a-uuid?limit=9999')
      .send({ email: 'nope', age: 500 });

    const fields = fieldErrors(response).map((e) => e.field);

    expect(response.status).toBe(400);
    // One round trip surfaces all of them, rather than the client fixing one at a time.
    expect(fields).toContain('params.id');
    expect(fields).toContain('query.limit');
    expect(fields).toContain('body.email');
    expect(fields).toContain('body.age');
  });

  it('reports a missing required field', async () => {
    const response = await request(buildApp()).post(`/items/${VALID_ID}`).send({});

    const fields = fieldErrors(response).map((e) => e.field);

    expect(response.status).toBe(400);
    expect(fields).toContain('body.email');
    expect(fields).toContain('body.age');
  });

  it('never echoes the rejected value, which may be patient data', async () => {
    const response = await request(buildApp())
      .post(`/items/${VALID_ID}`)
      .send({ email: 'priya.sharma@example.com-invalid', age: 'not-a-number' });

    expect(response.status).toBe(400);
    expect(JSON.stringify(problemBody(response))).not.toContain('priya.sharma');
  });

  it('carries a code for each field error', async () => {
    const response = await request(buildApp())
      .post(`/items/${VALID_ID}`)
      .send({ email: 'bad', age: 1 });

    expect(fieldErrors(response)[0]?.code).toBeTypeOf('string');
  });
});

describe('validation success', () => {
  it('exposes parsed and coerced values', async () => {
    const response = await request(buildApp())
      .post(`/items/${VALID_ID}?limit=5`)
      .send({ email: 'doctor@clinic.test', age: '42' });

    expect(response.status).toBe(200);
    expect(jsonBody<Record<string, unknown>>(response).params).toEqual({ id: VALID_ID });
    // Coercion applied: strings from the wire become numbers.
    expect(jsonBody<Record<string, unknown>>(response).query).toEqual({ limit: 5 });
    expect(jsonBody<Record<string, unknown>>(response).body).toEqual({
      email: 'doctor@clinic.test',
      age: 42,
    });
  });

  it('applies schema defaults for an absent query param', async () => {
    const response = await request(buildApp())
      .post(`/items/${VALID_ID}`)
      .send({ email: 'doctor@clinic.test', age: 42 });

    expect(jsonBody<Record<string, unknown>>(response).query).toEqual({ limit: 20 });
  });

  it('does not write back to req.query, which Express 5 makes read-only', async () => {
    // The parsed value lives only in validatedData(); touching req.query would throw
    // on Express 5 because it is defined as a getter.
    const response = await request(buildApp())
      .post(`/items/${VALID_ID}?limit=7`)
      .send({ email: 'doctor@clinic.test', age: 42 });

    expect(response.status).toBe(200);
    expect(jsonBody<Record<string, unknown>>(response).query).toEqual({ limit: 7 });
  });
});

describe('validatedData guard', () => {
  it('throws when validate() did not run', async () => {
    const response = await request(buildApp()).get('/unvalidated');

    expect(response.status).toBe(500);
    expect(jsonBody<{ message: string }>(response).message).toMatch(
      /without validate\(\) middleware/,
    );
  });
});
