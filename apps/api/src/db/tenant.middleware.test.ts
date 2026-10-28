import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requestContextMiddleware } from '../common/request-context.middleware.js';
import { runWithContext } from '../common/request-context.js';
import { PROBLEM_JSON_CONTENT_TYPE, toProblemDetails } from '../common/problem-details.js';
import { uuidV7 } from '../common/uuid.js';

/**
 * What happens when the COMMIT itself fails.
 *
 * This is the second half of the defect the buffering fixes, and it cannot be provoked
 * against a real database without a deferrable constraint the schema does not have. So
 * withTenant is replaced here: the callback runs to completion, meaning the handler has
 * produced its 201, and only then does the transaction reject. The client must come away
 * with an error, never the success the handler asked for.
 */

const mocks = vi.hoisted(() => ({ withTenant: vi.fn() }));

vi.mock('./tenant-client.js', () => ({ withTenant: mocks.withTenant }));

const { tenantMiddleware } = await import('./tenant.middleware.js');

const appWithHandler = () => {
  const app = express();
  app.use(requestContextMiddleware);
  app.use((_req, _res, next) => {
    runWithContext(
      { requestId: uuidV7(), organisationId: uuidV7(), userId: 'usr-test', role: 'CLINIC_OWNER' },
      () => {
        next();
      },
    );
  });

  app.post('/thing', tenantMiddleware, (_req: Request, res: Response) => {
    res.status(201).json({ created: true });
  });

  // The same shape as the error handler in app.ts, including its headersSent guard.
  app.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (res.headersSent) {
      next(error);
      return;
    }
    const problem = toProblemDetails(error);
    res.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  });

  return app;
};

beforeEach(() => {
  mocks.withTenant.mockReset();
});

describe('tenantMiddleware when the transaction fails to commit', () => {
  it('sends an error, not the 2xx the handler asked for', async () => {
    mocks.withTenant.mockImplementation(
      async (_context: unknown, fn: (db: unknown) => Promise<unknown>) => {
        // The handler runs and writes its 201 into the buffer.
        await fn({});
        // Then the commit fails, which the old code could not act on because the 201
        // had already gone out and res.headersSent sent the error handler away.
        throw new Error('COMMIT failed');
      },
    );

    const response = await request(appWithHandler()).post('/thing').send({});

    expect(response.status).toBe(500);
    expect(response.status).not.toBe(201);
  });

  it('sends the handler response once the commit resolves', async () => {
    mocks.withTenant.mockImplementation(
      async (_context: unknown, fn: (db: unknown) => Promise<unknown>) => fn({}),
    );

    const response = await request(appWithHandler()).post('/thing').send({});

    expect(response.status).toBe(201);
    expect(response.body).toEqual({ created: true });
  });
});
