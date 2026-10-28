import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ForbiddenError, UnauthorizedError } from '../../common/errors.js';
import type { TenantDb } from '../../db/tenant-client.js';

/**
 * The refusal branches in device pairing, which were the uncovered lines in this file.
 *
 * Three of them matter and none had a test: a role that may not issue a pairing code, the
 * race in which two phones redeem one code, and a revoked device presenting its old
 * token. The first two are the controls that stop a staff member pairing a phone and stop
 * one code becoming two devices; the third is the only thing revocation does.
 *
 * `asSystem` is mocked and the database is a stub, because the race branch cannot be hit
 * deterministically against a real database (it depends on which of two transactions
 * commits first) and because these are decisions in the service rather than queries.
 * The happy paths and the real single-use enforcement are covered end to end in
 * tests/auth.test.ts against PostgreSQL.
 */

const mocks = vi.hoisted(() => ({ asSystem: vi.fn() }));

vi.mock('../../db/tenant-client.js', () => ({ asSystem: mocks.asSystem }));

const { authenticateDevice, issuePairingCode, pairDevice } = await import('./devices.service.js');

/** The slice of the client these three functions touch, and nothing else. */
type StubDb = {
  pairingCode: {
    findUnique: ReturnType<typeof vi.fn>;
    updateMany: ReturnType<typeof vi.fn>;
  };
  device: {
    create: ReturnType<typeof vi.fn>;
    findUnique: ReturnType<typeof vi.fn>;
    update: ReturnType<typeof vi.fn>;
  };
};

const stubDb = (): StubDb => ({
  pairingCode: { findUnique: vi.fn(), updateMany: vi.fn() },
  device: { create: vi.fn(), findUnique: vi.fn(), update: vi.fn() },
});

/** Routes asSystem straight to the callback with the stub in place of a transaction. */
const runOn = (db: StubDb): void => {
  mocks.asSystem.mockImplementation(
    async (_reason: string, fn: (client: TenantDb) => Promise<unknown>) =>
      fn(db as unknown as TenantDb),
  );
};

beforeEach(() => {
  mocks.asSystem.mockReset();
});

describe('issuePairingCode', () => {
  it('refuses a role that may not pair a device', async () => {
    const db = stubDb();

    await expect(
      issuePairingCode(db as unknown as TenantDb, {
        organisationId: 'org-1',
        actorRole: 'STAFF',
        actorUserId: 'usr-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);

    // Refused before anything was written: a rejected caller must not leave a code behind.
    expect(db.pairingCode.findUnique).not.toHaveBeenCalled();
  });

  it.each(['DOCTOR', 'SUPER_ADMIN', 'INTERNAL_ADMIN'])('refuses %s', async (role) => {
    const db = stubDb();

    // A platform role is refused too: pairing a phone is a clinic action, and a platform
    // admin has no organisation to pair it to.
    await expect(
      issuePairingCode(db as unknown as TenantDb, {
        organisationId: 'org-1',
        actorRole: role,
        actorUserId: 'usr-1',
      }),
    ).rejects.toBeInstanceOf(ForbiddenError);
  });
});

describe('pairDevice', () => {
  const liveCode = {
    id: 'code-1',
    organisationId: 'org-1',
    expiresAt: new Date(Date.now() + 60_000),
    consumedAt: null,
  };

  it('refuses when another request consumed the code first', async () => {
    const db = stubDb();
    db.pairingCode.findUnique.mockResolvedValue(liveCode);
    // The read saw an unconsumed code and the conditional write found none: the other
    // phone won. This is the branch that makes one code mean exactly one device.
    db.pairingCode.updateMany.mockResolvedValue({ count: 0 });
    runOn(db);

    await expect(pairDevice('ABC123', 'Reception phone')).rejects.toBeInstanceOf(UnauthorizedError);

    // No device, because the code was not ours to consume.
    expect(db.device.create).not.toHaveBeenCalled();
  });

  it('gives the race the same error as an unknown code', async () => {
    const db = stubDb();
    db.pairingCode.findUnique.mockResolvedValue(liveCode);
    db.pairingCode.updateMany.mockResolvedValue({ count: 0 });
    runOn(db);
    const raced = await pairDevice('ABC123', 'Phone').catch((error: unknown) => error);

    const other = stubDb();
    other.pairingCode.findUnique.mockResolvedValue(null);
    runOn(other);
    const unknownCode = await pairDevice('ZZZZZZ', 'Phone').catch((error: unknown) => error);

    // The endpoint must not become an oracle: a loser in the race and a guess at a code
    // that never existed have to be indistinguishable.
    expect((raced as UnauthorizedError).message).toBe((unknownCode as UnauthorizedError).message);
    expect((raced as UnauthorizedError).title).toBe((unknownCode as UnauthorizedError).title);
  });

  it('issues a device when it wins the code', async () => {
    const db = stubDb();
    db.pairingCode.findUnique.mockResolvedValue(liveCode);
    db.pairingCode.updateMany.mockResolvedValue({ count: 1 });
    db.device.create.mockResolvedValue(undefined);
    runOn(db);

    const paired = await pairDevice('ABC123', 'Reception phone');

    expect(paired.organisationId).toBe('org-1');
    expect(paired.deviceToken.length).toBeGreaterThan(0);
    // The code is consumed in the same transaction that creates the device.
    expect(db.pairingCode.updateMany).toHaveBeenCalledTimes(1);
    expect(db.device.create).toHaveBeenCalledTimes(1);
  });
});

describe('authenticateDevice', () => {
  it('refuses an unknown device token', async () => {
    const db = stubDb();
    db.device.findUnique.mockResolvedValue(null);
    runOn(db);

    await expect(authenticateDevice('nope')).rejects.toBeInstanceOf(UnauthorizedError);
    expect(db.device.update).not.toHaveBeenCalled();
  });

  it('refuses a REVOKED device, which is the only thing revocation does', async () => {
    const db = stubDb();
    db.device.findUnique.mockResolvedValue({
      id: 'dev-1',
      organisationId: 'org-1',
      revokedAt: new Date(),
    });
    runOn(db);

    await expect(authenticateDevice('an-old-token')).rejects.toBeInstanceOf(UnauthorizedError);
    // A revoked device must not even have its lastSeenAt touched.
    expect(db.device.update).not.toHaveBeenCalled();
  });

  it('admits a live device and records that it was seen', async () => {
    const db = stubDb();
    db.device.findUnique.mockResolvedValue({
      id: 'dev-1',
      organisationId: 'org-1',
      revokedAt: null,
    });
    db.device.update.mockResolvedValue(undefined);
    runOn(db);

    await expect(authenticateDevice('a-live-token')).resolves.toEqual({
      deviceId: 'dev-1',
      organisationId: 'org-1',
    });
    expect(db.device.update).toHaveBeenCalledTimes(1);
  });
});
