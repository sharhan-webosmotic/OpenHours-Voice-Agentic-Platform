import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requestContextMiddleware } from '../src/common/request-context.middleware.js';
import { runWithContext } from '../src/common/request-context.js';
import { PROBLEM_JSON_CONTENT_TYPE, toProblemDetails } from '../src/common/problem-details.js';
import { tenantDb, tenantMiddleware } from '../src/db/tenant.middleware.js';
import { uuidV7 } from '../src/common/uuid.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * COMMIT happens before the response is sent.
 *
 * The regression this file exists for: the middleware used to end its transaction on the
 * response's `finish` event, so the client held a 201 while the row was still
 * uncommitted. A follow-up request took a different pooled connection and did not see
 * what it had just written.
 *
 * Which of the two tests below is the real guard: the ORDERING one. It reads
 * `res.headersSent` immediately after the handler has asked for its 201 and fails if the
 * bytes have already gone out, which is true of the old code on every run and false of
 * the new code on every run.
 *
 * The read-after-write loop is a regression guard and NOT a proof. The underlying race
 * is a genuine coin flip between a local COMMIT and an HTTP round trip, and the commit
 * usually wins when the process is otherwise idle: this loop passes 20 out of 20 against
 * the old middleware in isolation. The reviewer who found the defect reproduced it at
 * roughly 50 percent, and separately observed that the symptom in the auth suite showed
 * up only under full-suite load. So the loop catches a reintroduction only when the
 * machine is busy, and the ordering assertion is what catches it always.
 */

const ITERATIONS = 20;

/**
 * Set by the write handler AFTER it has asked for its response, and asserted below.
 * Module-level rather than returned in the body, because an argument to res.json() is
 * evaluated before the response is written and would read false either way.
 */
let headersSentAfterRespond: boolean | undefined;

let org: OrganisationGraph;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'CommitOrder');
  });
}, 120_000);

afterAll(async () => {
  await disconnectAll();
});

/**
 * Two tenant-scoped routes on one app. The write and the read-back are separate HTTP
 * requests on purpose: each opens its own transaction on its own pooled connection,
 * which is the only arrangement that can observe an uncommitted write.
 */
const appFor = (organisationId: string) => {
  const app = express();
  app.use(requestContextMiddleware);
  app.use(express.json());
  app.use((_req, _res, next) => {
    // Identity would normally come from a verified token; injected here so the
    // middleware under test is the only thing being exercised.
    runWithContext(
      {
        requestId: uuidV7(),
        organisationId,
        userId: 'usr-test',
        role: 'CLINIC_OWNER',
      },
      () => {
        next();
      },
    );
  });

  app.post('/patients', tenantMiddleware, (req: Request, res: Response, next: NextFunction) => {
    const id = uuidV7();
    tenantDb(req)
      .patient.create({
        data: {
          id,
          organisationId,
          fullName: 'Read After Write',
          // Unique per row: the id's last six hex characters keep it inside E.164.
          phone: `+9199${id.slice(-8, -2)}`,
        },
      })
      .then(() => {
        res.status(201).json({ id });
        // Read after the write, not inside it: with the old middleware the bytes are
        // already on the socket at this point and the COMMIT has not been issued yet.
        headersSentAfterRespond = res.headersSent;
      })
      .catch(next);
  });

  app.get('/patients/:id', tenantMiddleware, (req: Request, res: Response, next: NextFunction) => {
    const id = req.params['id'];
    if (typeof id !== 'string') {
      next(new Error('no id on the path'));
      return;
    }
    tenantDb(req)
      .patient.findUnique({ where: { id }, select: { id: true } })
      .then((found) => {
        if (found === null) {
          res.status(404).json({ found: false });
          return;
        }
        res.status(200).json({ found: true });
      })
      .catch(next);
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const problem = toProblemDetails(error);
    res.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  });

  return app;
};

describe('the tenant transaction commits before the response is sent', () => {
  it(`reads back its own write over HTTP, ${ITERATIONS} times in a row`, async () => {
    const app = appFor(org.organisationId);
    const failures: string[] = [];

    for (let iteration = 0; iteration < ITERATIONS; iteration += 1) {
      // Sequential and immediate, with nothing between the write and the read: a
      // retry or a delay would hide the race this asserts.
      const created = await request(app).post('/patients').send({});

      if (created.status !== 201) {
        failures.push(`iteration ${iteration}: create returned ${created.status}`);
        continue;
      }

      const { id } = created.body as { id: string };
      const readBack = await request(app).get(`/patients/${id}`);

      if (readBack.status !== 200) {
        failures.push(`iteration ${iteration}: read-back returned ${readBack.status}`);
      }
    }

    // Reported as a list rather than a count, so a failure names the iteration.
    expect(failures).toEqual([]);
  }, 120_000);

  it('has not sent a byte by the time the handler has finished responding', async () => {
    headersSentAfterRespond = undefined;

    const response = await request(appFor(org.organisationId)).post('/patients').send({});

    expect(response.status).toBe(201);
    // The handler asked for its 201 and nothing had left the process: the bytes are in
    // the buffer, waiting for the commit. The old middleware fails this on every run.
    expect(headersSentAfterRespond).toBe(false);
  });
});
