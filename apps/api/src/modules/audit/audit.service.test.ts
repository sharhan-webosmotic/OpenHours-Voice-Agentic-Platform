import { describe, expect, it } from 'vitest';
import { AuditMetadataError } from './audit.service.js';
import * as audit from './audit.service.js';
import { runWithContext } from '../../common/request-context.js';
import type { TenantDb } from '../../db/tenant-client.js';

/**
 * Unit coverage for the part that needs no database: refusing to store patient values,
 * and taking the actor from context rather than from arguments.
 */

type Captured = { data: Record<string, unknown> };

const fakeDb = (captured: Captured[]): TenantDb =>
  ({
    auditLog: {
      create: (args: { data: Record<string, unknown> }) => {
        captured.push({ data: args.data });
        return Promise.resolve(args.data);
      },
    },
  }) as unknown as TenantDb;

const REQUEST_ID = '0189d7f1-9b3a-4c2e-8f1a-2b3c4d5e6f70';

describe('audit.record refuses to store patient values', () => {
  it.each([
    'fullName',
    'phone',
    'dateOfBirth',
    'notes',
    'transcript',
    'prescription',
    'email',
    'password',
    'token',
  ])('throws when metadata carries a %s key', async (key) => {
    const captured: Captured[] = [];

    await expect(
      audit.record(fakeDb(captured), {
        action: 'patient.updated',
        entityType: 'patient',
        metadata: { [key]: 'some value' },
      }),
    ).rejects.toThrow(AuditMetadataError);

    // Thrown rather than stripped: dropping it silently would leave the caller
    // believing the detail was recorded.
    expect(captured).toHaveLength(0);
  });

  it('accepts ids, counts, flags and FIELD NAMES', async () => {
    const captured: Captured[] = [];

    await audit.record(fakeDb(captured), {
      action: 'patient.updated',
      entityType: 'patient',
      entityId: '0189d7f1-9b3a-4c2e-8f1a-2b3c4d5e6f71',
      // "phone changed" is auditable; the number is not.
      metadata: { changedFields: ['phone', 'notes'], count: 2, masked: true },
    });

    expect(captured).toHaveLength(1);
    expect(captured[0]?.data.metadata).toEqual({
      changedFields: ['phone', 'notes'],
      count: 2,
      masked: true,
    });
  });
});

describe('audit.record takes the actor from context', () => {
  it('records actor, role, organisation, request id, ip and user agent', async () => {
    const captured: Captured[] = [];

    await runWithContext(
      {
        requestId: REQUEST_ID,
        userId: 'usr-1',
        role: 'CLINIC_OWNER',
        organisationId: 'org-1',
        ipAddress: '203.0.113.7',
        userAgent: 'Mozilla/5.0',
      },
      () => audit.record(fakeDb(captured), { action: 'patient.read', entityType: 'patient' }),
    );

    expect(captured[0]?.data).toMatchObject({
      actorUserId: 'usr-1',
      actorRole: 'CLINIC_OWNER',
      organisationId: 'org-1',
      requestId: REQUEST_ID,
      ipAddress: '203.0.113.7',
      userAgent: 'Mozilla/5.0',
      action: 'patient.read',
    });
  });

  it('cannot be told who the actor was', async () => {
    const captured: Captured[] = [];

    await runWithContext({ requestId: REQUEST_ID, userId: 'real-user' }, () =>
      audit.record(fakeDb(captured), {
        action: 'patient.read',
        entityType: 'patient',
        // A caller cannot attribute the action to someone else: the actor comes from
        // the verified context, and this is just metadata.
        metadata: { actorUserId: 'someone-else' },
      }),
    );

    expect(captured[0]?.data.actorUserId).toBe('real-user');
  });

  it('writes a system entry when there is no actor', async () => {
    const captured: Captured[] = [];

    await audit.record(fakeDb(captured), { action: 'job.ran', entityType: 'system' });

    // A job or webhook has no user. The row still exists, with no actor.
    expect(captured[0]?.data.actorUserId).toBeUndefined();
    expect(captured[0]?.data.action).toBe('job.ran');
  });
});
