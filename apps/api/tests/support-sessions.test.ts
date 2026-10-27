import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { hashPassword } from '../src/common/passwords.js';
import { uuidV7 } from '../src/common/uuid.js';
import { jsonBody, problemBody } from '../src/test-support/http.js';
import {
  hasActiveSupportSession,
  openSupportSession,
} from '../src/modules/support-sessions/support-sessions.service.js';
import { asPlatform, disconnectAll, ownerClient } from './support/db.js';
import { createOrganisationGraph, type OrganisationGraph } from './support/fixtures.js';

/**
 * Support sessions, against the real database.
 *
 * The grant is what makes a platform admin's access to patient data accountable, so the
 * tests cover both that it works and that it is bounded: one organisation, one hour, and
 * refused to clinic roles.
 */

const PASSWORD = 'correct-horse-battery-staple';
const app = createApp({ readiness: () => Promise.resolve() });

let orgA: OrganisationGraph;
let orgB: OrganisationGraph;
let superAdminId: string;
let superAdminEmail: string;
let clinicOwnerEmail: string;

beforeAll(async () => {
  const passwordHash = await hashPassword(PASSWORD);

  await asPlatform(ownerClient(), async (tx) => {
    orgA = await createOrganisationGraph(tx, 'SupportA');
    orgB = await createOrganisationGraph(tx, 'SupportB');

    superAdminId = uuidV7();
    superAdminEmail = `support.super.${Date.now()}@test.invalid`;
    await tx.user.create({
      data: {
        id: superAdminId,
        // Platform roles have no organisation; the CHECK constraint enforces it.
        organisationId: null,
        email: superAdminEmail,
        passwordHash,
        fullName: 'Support Super Admin',
        role: 'SUPER_ADMIN',
        status: 'ACTIVE',
      },
    });

    clinicOwnerEmail = `support.owner.${Date.now()}@test.invalid`;
    await tx.user.create({
      data: {
        id: uuidV7(),
        organisationId: orgA.organisationId,
        email: clinicOwnerEmail,
        passwordHash,
        fullName: 'Support Clinic Owner',
        role: 'CLINIC_OWNER',
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

describe('opening a support session', () => {
  it('a platform role may open one for a named organisation', async () => {
    const token = await loginAs(superAdminEmail);

    const response = await request(app)
      .post('/api/v1/support-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ organisationId: orgA.organisationId, reason: 'Investigating a duplicate booking' });

    expect(response.status).toBe(201);
    const body = jsonBody<{ organisationId: string; expiresAt: string }>(response);
    expect(body.organisationId).toBe(orgA.organisationId);

    // 60 minutes, give or take the round trip.
    const minutes = (Date.parse(body.expiresAt) - Date.now()) / 60_000;
    expect(minutes).toBeGreaterThan(58);
    expect(minutes).toBeLessThanOrEqual(60);
  });

  it('writes an audit row carrying the reason and no patient data', async () => {
    const token = await loginAs(superAdminEmail);
    const reason = 'Checking why a reminder was not sent';

    await request(app)
      .post('/api/v1/support-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ organisationId: orgA.organisationId, reason });

    const entries = await asPlatform(ownerClient(), (tx) =>
      tx.auditLog.findMany({
        where: { action: 'support_session.opened', organisationId: orgA.organisationId },
        orderBy: { createdAt: 'desc' },
        take: 1,
      }),
    );

    expect(entries).toHaveLength(1);
    expect(entries[0]?.actorUserId).toBe(superAdminId);
    expect(JSON.stringify(entries[0]?.metadata)).toContain(reason);
    // IDs and the reason only (root CLAUDE.md rule 5).
    expect(JSON.stringify(entries[0]?.metadata)).not.toContain('Patient ');
  });

  it('REFUSES a clinic role', async () => {
    const token = await loginAs(clinicOwnerEmail);

    const response = await request(app)
      .post('/api/v1/support-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ organisationId: orgB.organisationId, reason: 'Trying to reach another clinic' });

    // A clinic role already sees its own patients unmasked, so a session would be
    // meaningless; allowing one would open a path to another organisation.
    expect(response.status).toBe(403);
  });

  it('requires a substantive reason', async () => {
    const token = await loginAs(superAdminEmail);

    const response = await request(app)
      .post('/api/v1/support-sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ organisationId: orgA.organisationId, reason: 'because' });

    expect(response.status).toBe(400);
    expect(problemBody(response).errors?.[0]?.field).toBe('body.reason');
  });

  it('rejects an unauthenticated request', async () => {
    const response = await request(app)
      .post('/api/v1/support-sessions')
      .send({ organisationId: orgA.organisationId, reason: 'No credentials at all here' });

    expect(response.status).toBe(401);
  });
});

describe('an active session is scoped to one organisation and one hour', () => {
  it('is active for the named organisation only', async () => {
    await openSupportSession({
      actorUserId: superAdminId,
      actorRole: 'SUPER_ADMIN',
      organisationId: orgA.organisationId,
      reason: 'Scoped to organisation A only',
    });

    expect(await hasActiveSupportSession(superAdminId, orgA.organisationId)).toBe(true);
    // The grant unmasks ONE clinic, not every clinic.
    expect(await hasActiveSupportSession(superAdminId, orgB.organisationId)).toBe(false);
  });

  it('is not active for a different platform user', async () => {
    const otherId = uuidV7();
    await asPlatform(ownerClient(), (tx) =>
      tx.user.create({
        data: {
          id: otherId,
          organisationId: null,
          email: `support.other.${Date.now()}@test.invalid`,
          passwordHash: 'hash',
          fullName: 'Other Admin',
          role: 'INTERNAL_ADMIN',
          status: 'ACTIVE',
        },
      }),
    );

    expect(await hasActiveSupportSession(otherId, orgA.organisationId)).toBe(false);
  });

  it('stops being active once expired', async () => {
    const session = await openSupportSession({
      actorUserId: superAdminId,
      actorRole: 'SUPER_ADMIN',
      organisationId: orgB.organisationId,
      reason: 'About to be expired by the test',
    });

    expect(await hasActiveSupportSession(superAdminId, orgB.organisationId)).toBe(true);

    await asPlatform(ownerClient(), (tx) =>
      tx.supportSession.update({
        where: { id: session.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      }),
    );

    expect(await hasActiveSupportSession(superAdminId, orgB.organisationId)).toBe(false);
  });

  it('stops being active once revoked', async () => {
    const session = await openSupportSession({
      actorUserId: superAdminId,
      actorRole: 'SUPER_ADMIN',
      organisationId: orgB.organisationId,
      reason: 'About to be revoked by the test',
    });

    await asPlatform(ownerClient(), (tx) =>
      tx.supportSession.update({ where: { id: session.id }, data: { revokedAt: new Date() } }),
    );

    // Checked per request rather than cached, so a revocation takes effect at once.
    expect(await hasActiveSupportSession(superAdminId, orgB.organisationId)).toBe(false);
  });
});
