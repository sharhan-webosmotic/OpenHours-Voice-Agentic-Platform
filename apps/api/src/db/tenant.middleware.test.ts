import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import { EventEmitter } from 'node:events';
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

/**
 * A response stand-in for the buffering paths that an HTTP test cannot reach: a client
 * that disconnects mid-request, a handler that writes in several chunks, and the chunk
 * types `res.write` accepts. Only the ORIGINAL write and end are ever called on it,
 * because the middleware replaces both and puts them back at flush time.
 */
class StubResponse extends EventEmitter {
  statusCode = 200;
  flushed: Buffer | undefined;
  ended = false;

  write(): boolean {
    return true;
  }

  end(chunk?: unknown): this {
    this.ended = true;
    if (Buffer.isBuffer(chunk)) {
      this.flushed = chunk;
    }
    return this;
  }
}

const asResponse = (stub: StubResponse): Response => stub as unknown as Response;

/** Drives the middleware directly, with an organisation in context. */
const drive = (stub: StubResponse, handler: (res: Response) => void): Promise<{ error: unknown }> =>
  new Promise((resolve) => {
    runWithContext({ requestId: uuidV7(), organisationId: uuidV7(), userId: 'u' }, () => {
      tenantMiddleware({} as Request, asResponse(stub), ((error?: unknown) => {
        // next() with no argument is the signal to run the handler; with one it is the
        // middleware reporting a failure it could not turn into a response.
        if (error === undefined) {
          handler(asResponse(stub));
          return;
        }
        resolve({ error });
      }) as NextFunction);

      // Resolve once the flush has happened, which is the success path's only signal.
      const settle = setInterval(() => {
        if (stub.ended) {
          clearInterval(settle);
          resolve({ error: undefined });
        }
      }, 5);
    });
  });

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

describe('tenantMiddleware response buffering', () => {
  beforeEach(() => {
    mocks.withTenant.mockImplementation(
      async (_context: unknown, fn: (db: unknown) => Promise<unknown>) => fn({}),
    );
  });

  it('collects several chunks and flushes them as one body', async () => {
    const stub = new StubResponse();

    const { error } = await drive(stub, (res) => {
      res.write('first ');
      res.write('second ');
      res.end('third');
    });

    expect(error).toBeUndefined();
    expect(stub.flushed?.toString()).toBe('first second third');
  });

  it('accepts a Buffer, a Uint8Array and an explicit encoding', async () => {
    const stub = new StubResponse();

    const { error } = await drive(stub, (res) => {
      res.write(Buffer.from('buf-'));
      res.write(new Uint8Array([0x75, 0x38, 0x2d]));
      res.write('6865782d', 'hex');
      res.end();
    });

    expect(error).toBeUndefined();
    // The hex chunk decodes to 'hex-', which only happens if the encoding argument
    // reaches Buffer.from rather than being mistaken for a callback.
    expect(stub.flushed?.toString()).toBe('buf-u8-hex-');
  });

  it('invokes the write and end callbacks the caller passed', async () => {
    const stub = new StubResponse();
    const called: string[] = [];

    const { error } = await drive(stub, (res) => {
      res.write('x', () => {
        called.push('write');
      });
      res.end(() => {
        called.push('end');
      });
    });

    expect(error).toBeUndefined();
    // A dropped callback is a handler that waits for ever on a response it already sent.
    expect(called).toEqual(['write', 'end']);
  });

  it('rolls back and sends nothing when the client goes away', async () => {
    const stub = new StubResponse();

    const outcome = await new Promise<string>((resolve) => {
      mocks.withTenant.mockImplementation(
        async (_context: unknown, fn: (db: unknown) => Promise<unknown>) => {
          try {
            await fn({});
            resolve('committed');
          } catch {
            // The abandoned signal arrives here as a rejection, which is the rollback.
            resolve('rolled back');
          }
        },
      );

      runWithContext({ requestId: uuidV7(), organisationId: uuidV7() }, () => {
        tenantMiddleware({} as Request, asResponse(stub), (() => {
          // The handler never responds; the client disconnects instead.
          setTimeout(() => stub.emit('close'), 5);
        }) as NextFunction);
      });
    });

    expect(outcome).toBe('rolled back');
    // Nothing is owed to a client that is no longer there.
    expect(stub.ended).toBe(false);
  });

  it('refuses a chunk type it cannot buffer rather than dropping bytes', async () => {
    const stub = new StubResponse();

    const { error } = await drive(stub, (res) => {
      // No route streams, and silently discarding part of a response would be worse than
      // failing. Cast because the real signature does not allow this.
      (res.write as unknown as (chunk: unknown) => boolean)({ not: 'a chunk' });
      res.end();
    });

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/cannot buffer this response chunk type/);
  });

  it('reports a transaction that failed before the handler ran', async () => {
    const stub = new StubResponse();
    const failure = new Error('could not open a transaction');
    mocks.withTenant.mockRejectedValue(failure);

    const { error } = await drive(stub, () => undefined);

    // The response was never captured, so there is nothing to restore and nothing to
    // flush; the error has to reach the error handler.
    expect(error).toBe(failure);
    expect(stub.ended).toBe(false);
  });

  it('refuses a request with no organisation in context', async () => {
    const error = await new Promise<unknown>((resolve) => {
      runWithContext({ requestId: uuidV7() }, () => {
        tenantMiddleware({} as Request, asResponse(new StubResponse()), ((cause?: unknown) => {
          resolve(cause);
        }) as NextFunction);
      });
    });

    expect(error).toBeInstanceOf(Error);
  });
});
