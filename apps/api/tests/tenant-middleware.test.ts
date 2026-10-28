import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import express, { type NextFunction, type Request, type Response } from 'express';
import { requestContextMiddleware } from '../src/common/request-context.middleware.js';
import { runWithContext } from '../src/common/request-context.js';
import { PROBLEM_JSON_CONTENT_TYPE, toProblemDetails } from '../src/common/problem-details.js';
import { tenantDb, tenantMiddleware } from '../src/db/tenant.middleware.js';
import { asSystem } from '../src/db/tenant-client.js';
import { uuidV7 } from '../src/common/uuid.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * The request-scoped transaction.
 *
 * The rollback behaviour is the part worth proving: the middleware keeps one transaction
 * open for the whole request so a two-step write cannot half-commit, which only holds if
 * an error actually rolls it back.
 */

let org: OrganisationGraph;

beforeAll(async () => {
  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'TenantMw');
  });
}, 120_000);

afterAll(async () => {
  await disconnectAll();
});

/** An app whose identity is injected, standing in for requireAuth. */
const appFor = (
  organisationId: string | undefined,
  handler: (req: Request, res: Response) => Promise<void>,
) => {
  const app = express();
  app.use(requestContextMiddleware);
  app.use(express.json());
  app.use((_req, _res, next) => {
    // Identity would normally come from a verified token; injected here so the
    // middleware under test is the only thing being exercised.
    runWithContext(
      {
        requestId: uuidV7(),
        ...(organisationId === undefined ? {} : { organisationId }),
        userId: 'usr-test',
        role: 'CLINIC_OWNER',
      },
      () => {
        next();
      },
    );
  });
  app.post('/thing', tenantMiddleware, (req, res, next) => {
    handler(req, res).catch(next);
  });
  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    const problem = toProblemDetails(error);
    res.status(problem.status).type(PROBLEM_JSON_CONTENT_TYPE).json(problem);
  });
  return app;
};

const patientExists = async (id: string): Promise<boolean> =>
  asSystem('test.check', async (db) => {
    const found = await db.patient.findUnique({ where: { id }, select: { id: true } });
    return found !== null;
  });

describe('tenantMiddleware', () => {
  it('commits what a successful request wrote', async () => {
    const id = uuidV7();

    const response = await request(
      appFor(org.organisationId, async (req, res) => {
        await tenantDb(req).patient.create({
          data: {
            id,
            organisationId: org.organisationId,
            fullName: 'Committed Patient',
            phone: '+919900005555',
          },
        });
        res.status(201).json({ id });
      }),
    ).post('/thing');

    expect(response.status).toBe(201);
    expect(await patientExists(id)).toBe(true);
  });

  it('ROLLS BACK everything when the handler throws', async () => {
    const first = uuidV7();
    const second = uuidV7();

    const response = await request(
      appFor(org.organisationId, async (req) => {
        const db = tenantDb(req);
        await db.patient.create({
          data: {
            id: first,
            organisationId: org.organisationId,
            fullName: 'First Write',
            phone: '+919900006661',
          },
        });
        await db.patient.create({
          data: {
            id: second,
            organisationId: org.organisationId,
            fullName: 'Second Write',
            phone: '+919900006662',
          },
        });
        // Fails after both writes: a half-applied multi-step write is worse than none.
        throw new Error('handler failed after writing');
      }),
    ).post('/thing');

    expect(response.status).toBe(500);
    expect(await patientExists(first)).toBe(false);
    expect(await patientExists(second)).toBe(false);
  });

  it('rolls back when the handler responds with a 4xx', async () => {
    const id = uuidV7();

    const response = await request(
      appFor(org.organisationId, async (req, res) => {
        await tenantDb(req).patient.create({
          data: {
            id,
            organisationId: org.organisationId,
            fullName: 'Rejected Patient',
            phone: '+919900007771',
          },
        });
        // A 4xx means the handler decided the request was invalid; whatever it wrote
        // before deciding must not survive.
        res.status(409).json({ conflict: true });
      }),
    ).post('/thing');

    expect(response.status).toBe(409);
    expect(await patientExists(id)).toBe(false);
  });

  it('refuses a request with no organisation in context', async () => {
    const response = await request(
      // Never reached: the middleware refuses before the handler runs.
      appFor(undefined, (_req, res) => {
        res.status(200).json({ ok: true });
        return Promise.resolve();
      }),
    ).post('/thing');

    // The organisation comes only from a verified token, so no organisation means not
    // authenticated for a tenant route.
    expect(response.status).toBe(401);
  });

  it('throws when tenantDb is used without the middleware', async () => {
    const app = express();
    app.use(requestContextMiddleware);
    app.get('/unwrapped', (req, res, next) => {
      try {
        tenantDb(req);
        res.status(200).json({ ok: true });
      } catch (error) {
        next(error);
      }
    });
    app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
      res.status(500).json({ message: (error as Error).message });
    });

    const response = await request(app).get('/unwrapped');

    expect(response.status).toBe(500);
    expect((response.body as { message: string }).message).toMatch(/without tenantMiddleware/);
  });
});

describe('asSystem', () => {
  it('leaves an audit row for every use', async () => {
    const before = await asSystem('test.count.before', (db) =>
      db.auditLog.count({ where: { action: 'system.scope.used' } }),
    );

    await asSystem('test.deliberate', () => Promise.resolve(undefined));

    const after = await asSystem('test.count.after', (db) =>
      db.auditLog.count({ where: { action: 'system.scope.used' } }),
    );

    // Each asSystem call writes its own row, so the escape hatch cannot be used quietly.
    expect(after).toBeGreaterThan(before);
  });

  it('sees across organisations, which is the whole point', async () => {
    const other = await asPlatform(ownerClient(), (tx) =>
      createOrganisationGraph(tx, 'TenantMwOther'),
    );

    const both = await asSystem('test.cross-tenant', (db) =>
      db.organisation.findMany({
        where: { id: { in: [org.organisationId, other.organisationId] } },
        select: { id: true },
      }),
    );

    expect(both).toHaveLength(2);
  });
});
