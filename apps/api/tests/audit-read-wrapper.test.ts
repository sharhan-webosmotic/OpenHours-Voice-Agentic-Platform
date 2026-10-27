import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requestContextMiddleware } from '../src/common/request-context.middleware.js';
import { runWithContext } from '../src/common/request-context.js';
import { PROBLEM_JSON_CONTENT_TYPE, toProblemDetails } from '../src/common/problem-details.js';
import { tenantMiddleware } from '../src/db/tenant.middleware.js';
import { auditRead } from '../src/modules/audit/audit.middleware.js';
import { asSystem } from '../src/db/tenant-client.js';
import { uuidV7 } from '../src/common/uuid.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * The auditRead wrapper.
 *
 * No route uses it yet: the patient, prescription and recording endpoints it is meant
 * for arrive in M2. Tested directly rather than left unexercised, so it is verified and
 * ready when those routes are built instead of being code nobody has ever run.
 */

let org: OrganisationGraph;
/** A real UUID: actor_user_id is a uuid column, which the database enforces. */
const READER_ID = uuidV7();

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'AuditRead');
  });
}, 120_000);

afterAll(async () => {
  await disconnectAll();
});

const appWith = (handler: (req: Request, res: Response) => void) => {
  const app = express();
  app.use(requestContextMiddleware);
  app.use((_req, _res, next) => {
    runWithContext(
      {
        requestId: uuidV7(),
        organisationId: org.organisationId,
        userId: READER_ID,
        role: 'CLINIC_OWNER',
      },
      () => {
        next();
      },
    );
  });
  app.get('/patients/:id', tenantMiddleware, auditRead('patient'), handler);
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const problem = toProblemDetails(error);
    res.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  });
  return app;
};

const entriesFor = async (entityId: string) =>
  asSystem('test.read-audit', (db) =>
    db.auditLog.findMany({
      where: { action: 'patient.read', entityId },
      select: { entityType: true, entityId: true, actorUserId: true, requestId: true },
    }),
  );

describe('auditRead', () => {
  it('records a read with the entity type and id', async () => {
    const patientId = org.ids.patients ?? '';

    const response = await request(
      appWith((req, res) => {
        res.status(200).json({ id: req.params.id });
      }),
    ).get(`/patients/${patientId}`);

    expect(response.status).toBe(200);

    const entries = await entriesFor(patientId);
    expect(entries.length).toBeGreaterThan(0);
    expect(entries[0]?.entityType).toBe('patient');
    // For PHI, looking IS the sensitive act, so the actor is the point of the row.
    expect(entries[0]?.actorUserId).toBe(READER_ID);
    expect(entries[0]?.requestId).toBeTypeOf('string');
  });

  it('rolls the audit row back when the handler fails', async () => {
    const patientId = uuidV7();

    const response = await request(
      appWith(() => {
        throw new Error('handler failed after the audit row was written');
      }),
    ).get(`/patients/${patientId}`);

    expect(response.status).toBe(500);

    // The row is written inside the request transaction, so a failed read leaves no
    // claim that a disclosure happened. Nothing was disclosed.
    expect(await entriesFor(patientId)).toHaveLength(0);
  });
});
