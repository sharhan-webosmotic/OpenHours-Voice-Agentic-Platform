import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody } from '../src/test-support/http.js';
import { openSupportSession } from '../src/modules/support-sessions/support-sessions.service.js';
import { asSystem } from '../src/db/tenant-client.js';
import {
  asPlatform,
  asOrganisation,
  disconnectAll,
  ownerClient,
  appUserClient,
} from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * The audit trail end to end: entries are written for sensitive actions, readable only
 * by the roles the matrix allows, paginated, and immutable.
 *
 * Database-level immutability (app_user has no UPDATE or DELETE grant) is covered in
 * audit-immutability.test.ts; this file covers the application path.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let org: OrganisationGraph;
let ownerEmail: string;
let staffEmail: string;
let superAdminEmail: string;

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), async (tx) => {
    org = await createOrganisationGraph(tx, 'AuditLog');

    ownerEmail = `audit.owner.${Date.now()}@test.invalid`;
    staffEmail = `audit.staff.${Date.now()}@test.invalid`;
    superAdminEmail = `audit.super.${Date.now()}@test.invalid`;

    await tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: org.organisationId,
        email: ownerEmail,
        passwordHash,
        fullName: 'Audit Owner',
        role: 'CLINIC_OWNER',
        status: 'ACTIVE',
      },
    });
    await tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: org.organisationId,
        email: staffEmail,
        passwordHash,
        fullName: 'Audit Staff',
        role: 'STAFF',
        status: 'ACTIVE',
      },
    });
    await tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: null,
        email: superAdminEmail,
        passwordHash,
        fullName: 'Audit Super',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });
  });
}, 180_000);

afterAll(async () => {
  await disconnectAll();
});

const loginAs = async (email: string): Promise<string> => {
  const response = await request(app)
    .post('/api/v1/auth/login')
    .send({ email, password: PASSWORD });
  expect(response.status).toBe(200);
  return jsonBody<{ accessToken: string }>(response).accessToken;
};

type AuditPage = {
  readonly items: readonly {
    readonly id: string;
    readonly action: string;
    readonly createdAt: string;
  }[];
  readonly nextCursor: string | null;
};

describe('GET /api/v1/audit-logs is governed by the matrix', () => {
  it('a clinic owner may read the trail', async () => {
    const token = await loginAs(ownerEmail);

    const response = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(Array.isArray(jsonBody<AuditPage>(response).items)).toBe(true);
  });

  it('STAFF is refused: the matrix gives them nothing on audit_log', async () => {
    const token = await loginAs(staffEmail);

    const response = await request(app)
      .get('/api/v1/audit-logs')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(403);
  });

  it('rejects an unauthenticated request', async () => {
    expect((await request(app).get('/api/v1/audit-logs')).status).toBe(401);
  });
});

describe('platform roles read the trail the matrix grants them', () => {
  it('SUPER_ADMIN may read it, across organisations', async () => {
    // Regression: the route used to sit behind a middleware that required an
    // organisation, so a platform role (which has none) was refused outright even
    // though the matrix grants it read 'all'.
    const token = await loginAs(superAdminEmail);

    const response = await request(app)
      .get('/api/v1/audit-logs?limit=100')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(jsonBody<AuditPage>(response).items.length).toBeGreaterThan(0);
  });

  it('INTERNAL_ADMIN sees organisations it opened a session for, plus its own actions', async () => {
    const adminId = uuidV7();
    const adminEmail = `audit.internal.${Date.now()}@test.invalid`;
    const involved = await asPlatform(ownerClient(), async (tx) => {
      await tx.user.create({
        data: {
          id: adminId,
          organisationId: null,
          email: adminEmail,
          passwordHash: await hashPassword(PASSWORD),
          fullName: 'Audit Internal Admin',
          role: 'INTERNAL_ADMIN',
          status: 'ACTIVE',
        },
      });
      return createOrganisationGraph(tx, 'AuditInvolved');
    });

    const uninvolved = await asPlatform(ownerClient(), (tx) =>
      createOrganisationGraph(tx, 'AuditUninvolved'),
    );

    // Opening a session is what makes this admin involved with that clinic.
    await openSupportSession({
      actorUserId: adminId,
      actorRole: 'INTERNAL_ADMIN',
      organisationId: involved.organisationId,
      reason: 'Establishing involvement with this organisation',
    });

    const token = await loginAs(adminEmail);
    const response = await request(app)
      .get('/api/v1/audit-logs?limit=100')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    const ids = jsonBody<AuditPage>(response).items.map((i) => i.id);

    // Visible: the organisation it opened a session for.
    expect(ids).toContain(involved.ids.audit_logs);
    // Not visible: an organisation it has had nothing to do with.
    expect(ids).not.toContain(uninvolved.ids.audit_logs);
  });

  it('INTERNAL_ADMIN cannot see an unrelated organisation even by filtering for it', async () => {
    const adminId = uuidV7();
    const adminEmail = `audit.internal2.${Date.now()}@test.invalid`;
    await asPlatform(ownerClient(), async (tx) =>
      tx.user.create({
        data: {
          id: adminId,
          organisationId: null,
          email: adminEmail,
          passwordHash: await hashPassword(PASSWORD),
          fullName: 'Audit Internal Admin Two',
          role: 'INTERNAL_ADMIN',
          status: 'ACTIVE',
        },
      }),
    );

    const token = await loginAs(adminEmail);
    const response = await request(app)
      .get('/api/v1/audit-logs?limit=100&entityType=organisation')
      .set('Authorization', `Bearer ${token}`);

    expect(response.status).toBe(200);
    // No sessions opened and no actions of its own yet, so the scope is empty. A filter
    // cannot widen a scope.
    expect(jsonBody<AuditPage>(response).items).toHaveLength(0);
  });
});

describe('sensitive actions write an entry', () => {
  it('opening a support session is recorded with the actor and reason', async () => {
    const token = await loginAs(superAdminEmail);
    const reason = 'Auditing that this action is itself audited';

    const opened = await request(app)
      .post('/api/v1/support-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ organisationId: org.organisationId, reason });
    expect(opened.status).toBe(201);

    const entries = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findMany({
        where: { organisationId: org.organisationId, action: 'support_session.opened' },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.actorRole).toBe('SUPER_ADMIN');
    expect(JSON.stringify(entries[0]?.metadata)).toContain(reason);
  });

  it('records the request id, so a trail row ties back to its request', async () => {
    const token = await loginAs(superAdminEmail);
    const requestId = '0189d7f1-9b3a-4c2e-8f1a-aaaaaaaaaaaa';

    await request(app)
      .post('/api/v1/support-sessions')
      .set('Authorization', `Bearer ${token}`)
      .set('X-Request-Id', requestId)
      .send({ organisationId: org.organisationId, reason: 'Checking request id propagation' });

    const entries = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findMany({ where: { requestId }, take: 5 }),
    );

    expect(entries.length).toBeGreaterThan(0);
  });

  it('every asSystem use leaves a record, so the escape hatch is never silent', async () => {
    const before = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.count({ where: { action: 'system.scope.used' } }),
    );

    await loginAs(ownerEmail);

    const after = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.count({ where: { action: 'system.scope.used' } }),
    );

    expect(after).toBeGreaterThan(before);
  });

  /**
   * The row used to be written inside the work transaction, so a callback that threw
   * rolled back its own audit row. The three events that left no trace at all were a
   * rejected password change, a failed device pairing and a rejected device token, which
   * are the three an investigator would most want. Review finding I3.
   */
  it('leaves a record even when the work it opened the scope for fails', async () => {
    const reason = `test.failing-scope.${Date.now()}`;

    const before = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.count({ where: { action: 'system.scope.used' } }),
    );

    await expect(
      // Not an `async` arrow: it has nothing to await, and the lint rule is right to
      // say so. A rejected promise is the same failure to asSystem's signature.
      asSystem(reason, () =>
        Promise.reject(new Error('the work failed after the scope was opened')),
      ),
    ).rejects.toThrow('the work failed after the scope was opened');

    const after = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.count({ where: { action: 'system.scope.used' } }),
    );

    expect(after).toBe(before + 1);

    // The reason is what identifies which call opened the scope, so it has to survive
    // too: a count that went up without it would not tell an investigator anything.
    const rows = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findMany({ where: { action: 'system.scope.used' }, take: 200 }),
    );
    const reasons = rows.map((row) => (row.metadata as { reason?: string } | null)?.reason);
    expect(reasons).toContain(reason);
  });
});

describe('the trail is tenant-scoped', () => {
  it('a clinic owner never sees another organisation entry', async () => {
    const other = await asPlatform(ownerClient(), (tx) =>
      createOrganisationGraph(tx, 'AuditOther'),
    );

    const token = await loginAs(ownerEmail);
    const response = await request(app)
      .get('/api/v1/audit-logs?limit=100')
      .set('Authorization', `Bearer ${token}`);

    const ids = jsonBody<AuditPage>(response).items.map((i) => i.id);
    expect(ids).not.toContain(other.ids.audit_logs);
  });
});

describe('cursor pagination', () => {
  beforeAll(async () => {
    // Enough rows to page through. Written with platform scope because these are
    // fixture rows rather than the product of an audited action.
    await asPlatform(ownerClient(), async (tx) => {
      for (let i = 0; i < 12; i += 1) {
        await tx.auditLog.create({
          data: {
            id: uuidV7(),
            organisationId: org.organisationId,
            action: 'pagination.fixture',
            entityType: 'fixture',
            metadata: { index: i },
          },
        });
      }
    });
  });

  it('pages without skipping or repeating a row', async () => {
    const token = await loginAs(ownerEmail);

    const first = await request(app)
      .get('/api/v1/audit-logs?action=pagination.fixture&limit=5')
      .set('Authorization', `Bearer ${token}`);
    const firstPage = jsonBody<AuditPage>(first);

    expect(firstPage.items).toHaveLength(5);
    expect(firstPage.nextCursor).toBeTypeOf('string');

    const second = await request(app)
      .get(
        `/api/v1/audit-logs?action=pagination.fixture&limit=5&cursor=${firstPage.nextCursor ?? ''}`,
      )
      .set('Authorization', `Bearer ${token}`);
    const secondPage = jsonBody<AuditPage>(second);

    expect(secondPage.items).toHaveLength(5);

    // The ordering is (createdAt desc, id desc). Without the id tiebreaker, rows sharing
    // a timestamp could appear on both pages or on neither.
    const firstIds = new Set(firstPage.items.map((i) => i.id));
    for (const item of secondPage.items) {
      expect(firstIds.has(item.id)).toBe(false);
    }
  });

  it('caps the page size however large a limit is asked for', async () => {
    const token = await loginAs(ownerEmail);

    const response = await request(app)
      .get('/api/v1/audit-logs?limit=5000')
      .set('Authorization', `Bearer ${token}`);

    // Rejected by the schema rather than silently truncated, so the caller knows.
    expect(response.status).toBe(400);
  });

  it('filters by action and entity type', async () => {
    const token = await loginAs(ownerEmail);

    const response = await request(app)
      .get('/api/v1/audit-logs?action=pagination.fixture&entityType=fixture&limit=100')
      .set('Authorization', `Bearer ${token}`);

    const items = jsonBody<AuditPage>(response).items;
    expect(items.length).toBeGreaterThan(0);
    for (const item of items) {
      expect(item.action).toBe('pagination.fixture');
    }
  });
});

describe('the trail cannot be rewritten through the application', () => {
  it('app_user has no UPDATE or DELETE grant on audit_logs', async () => {
    const rows = await appUserClient().$queryRawUnsafe<{ privilege_type: string }[]>(
      `SELECT privilege_type FROM information_schema.role_table_grants
       WHERE table_name = 'audit_logs' AND grantee = 'app_user'
       ORDER BY privilege_type`,
    );

    const granted = rows.map((r) => r.privilege_type);
    expect(granted).toContain('SELECT');
    expect(granted).toContain('INSERT');
    // An audit trail the application can rewrite is not evidence.
    expect(granted).not.toContain('UPDATE');
    expect(granted).not.toContain('DELETE');
  });

  it('a tenant-scoped UPDATE is refused', async () => {
    const result = await asOrganisation(appUserClient(), org.organisationId, (tx) =>
      tx.$executeRawUnsafe(
        `UPDATE audit_logs SET action = 'tampered' WHERE id = $1`,
        org.ids.audit_logs ?? '',
      ),
    ).then(
      () => 'accepted' as const,
      (error: unknown) => String((error as Error).message),
    );

    expect(result).not.toBe('accepted');
    expect(String(result)).toMatch(/permission denied/i);
  });
});
