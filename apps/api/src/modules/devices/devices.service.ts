import { config } from '../../config.js';
import { logger } from '../../common/logger.js';
import { ForbiddenError, UnauthorizedError } from '../../common/errors.js';
import { uuidV7 } from '../../common/uuid.js';
import { generateOpaqueToken, generatePairingCode, hashToken } from '../../common/tokens.js';
import { asSystem, type TenantDb } from '../../db/tenant-client.js';

/**
 * Device pairing for the Android forwarding app.
 *
 * A device token is NOT a user session. It reaches the forwarding endpoints and nothing
 * else, and it carries no role, so a stolen phone cannot read patient data.
 */

/** Roles that may issue a pairing code. */
const PAIRING_ROLES = new Set(['CLINIC_OWNER', 'CLINIC_MANAGER']);

export type PairingCodeIssued = {
  /** Shown once, never stored in plaintext, never logged. */
  readonly code: string;
  readonly expiresAt: Date;
};

export const issuePairingCode = async (
  db: TenantDb,
  input: {
    readonly organisationId: string;
    readonly actorRole: string;
    readonly actorUserId: string;
  },
): Promise<PairingCodeIssued> => {
  if (!PAIRING_ROLES.has(input.actorRole)) {
    throw new ForbiddenError(
      'role may not issue pairing codes',
      'Only an owner or manager can pair a device.',
    );
  }

  const code = generatePairingCode();
  const expiresAt = new Date(Date.now() + config.PAIRING_CODE_TTL_MINUTES * 60_000);

  await db.pairingCode.create({
    data: {
      id: uuidV7(),
      organisationId: input.organisationId,
      codeHash: hashToken(code),
      createdByUserId: input.actorUserId,
      expiresAt,
    },
  });

  // The code itself is a credential, so only its expiry is logged.
  logger.info(
    { organisationId: input.organisationId, actorUserId: input.actorUserId, expiresAt },
    'pairing code issued',
  );

  return { code, expiresAt };
};

export type DeviceToken = {
  readonly deviceToken: string;
  readonly deviceId: string;
  readonly organisationId: string;
};

/**
 * Exchanges a pairing code for a device token.
 *
 * Runs through asSystem: the device has no session yet, and the organisation comes from
 * the code. Single use, enforced by marking the code consumed in the same transaction
 * that creates the device, so two phones cannot race one code.
 */
export const pairDevice = async (code: string, label: string): Promise<DeviceToken> =>
  asSystem('devices.pair', async (db) => {
    const stored = await db.pairingCode.findUnique({
      where: { codeHash: hashToken(code) },
      select: { id: true, organisationId: true, expiresAt: true, consumedAt: true },
    });

    // One error for every failure: unknown, expired and already-used codes must be
    // indistinguishable, or the response becomes a code oracle.
    const rejected = new UnauthorizedError('pairing failed', 'This pairing code is not valid.');

    if (stored === null || stored.consumedAt !== null || stored.expiresAt <= new Date()) {
      logger.warn({ reason: stored === null ? 'unknown' : 'used-or-expired' }, 'pairing failed');
      throw rejected;
    }

    const consumed = await db.pairingCode.updateMany({
      where: { id: stored.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });

    if (consumed.count !== 1) {
      // Another request consumed it between the read and the write.
      logger.warn({ reason: 'race' }, 'pairing failed');
      throw rejected;
    }

    const deviceToken = generateOpaqueToken();
    const deviceId = uuidV7();

    await db.device.create({
      data: {
        id: deviceId,
        organisationId: stored.organisationId,
        label,
        tokenHash: hashToken(deviceToken),
      },
    });

    logger.info({ organisationId: stored.organisationId, deviceId }, 'device paired');

    return { deviceToken, deviceId, organisationId: stored.organisationId };
  });

export type DevicePrincipal = {
  readonly deviceId: string;
  readonly organisationId: string;
};

/** Resolves a device token. Revoked devices are rejected. */
export const authenticateDevice = async (token: string): Promise<DevicePrincipal> =>
  asSystem('devices.authenticate', async (db) => {
    const device = await db.device.findUnique({
      where: { tokenHash: hashToken(token) },
      select: { id: true, organisationId: true, revokedAt: true },
    });

    if (device === null || device.revokedAt !== null) {
      throw new UnauthorizedError('invalid device token', 'Device authentication failed.');
    }

    await db.device.update({ where: { id: device.id }, data: { lastSeenAt: new Date() } });

    return { deviceId: device.id, organisationId: device.organisationId };
  });
