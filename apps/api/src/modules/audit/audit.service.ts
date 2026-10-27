import { uuidV7 } from '../../common/uuid.js';
import { getContext } from '../../common/request-context.js';
import type { TenantDb } from '../../db/tenant-client.js';
import * as repository from './audit.repository.js';

/**
 * The audit trail.
 *
 * Written INSIDE the caller's transaction, so an audited action and its record either
 * both happen or neither does. A record written outside the transaction would survive a
 * rolled-back action and claim something occurred that did not.
 *
 * Audit rows never hold patient field VALUES (root CLAUDE.md rule 5): ids, and the NAMES
 * of fields that changed. "Updated phone" is auditable; the number is not, because the
 * trail is read by people who may have no right to the data it describes.
 */

/** Metadata may carry ids, counts, field names and flags. Never a patient value. */
export type AuditMetadata = Readonly<Record<string, string | number | boolean | null | string[]>>;

export type AuditInput = {
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string;
  readonly metadata?: AuditMetadata;
  /**
   * Target organisation, for a cross-tenant platform action.
   *
   * Normally the organisation comes from context. A platform role has none of its own,
   * so an action AGAINST one clinic (opening a support session) must name it, or the
   * entry would be filed with no organisation and the clinic could never see it.
   */
  readonly organisationId?: string;
};

/**
 * Field names known to carry patient data. Passing one as a metadata KEY is a
 * programming error, because the value beside it would be the thing itself.
 */
const FORBIDDEN_METADATA_KEYS = new Set([
  'fullname',
  'name',
  'firstname',
  'lastname',
  'patientname',
  'phone',
  'phonenumber',
  'email',
  'dob',
  'dateofbirth',
  'address',
  'notes',
  'transcript',
  'prescription',
  'diagnosis',
  'password',
  'token',
]);

export class AuditMetadataError extends Error {
  constructor(key: string) {
    super(
      `Audit metadata key "${key}" would carry a patient value or secret. ` +
        'Record the field NAME in changedFields instead.',
    );
    this.name = 'AuditMetadataError';
  }
}

const assertSafeMetadata = (metadata: AuditMetadata): void => {
  for (const key of Object.keys(metadata)) {
    if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) {
      // Thrown rather than stripped: silently dropping it would leave the caller
      // believing something was recorded.
      throw new AuditMetadataError(key);
    }
  }
};

/**
 * Records an audited action.
 *
 * Actor, role, organisation, IP, user agent and request id all come from the request
 * context, never from arguments, so a caller cannot attribute an action to someone else.
 */
export const record = async (db: TenantDb, input: AuditInput): Promise<void> => {
  const context = getContext();
  const metadata = input.metadata ?? {};

  assertSafeMetadata(metadata);

  const organisationId = input.organisationId ?? context?.organisationId;

  await repository.insert(db, {
    id: uuidV7(),
    ...(organisationId === undefined ? {} : { organisationId }),
    ...(context?.userId === undefined ? {} : { actorUserId: context.userId }),
    ...(context?.role === undefined ? {} : { actorRole: context.role }),
    action: input.action,
    entityType: input.entityType,
    ...(input.entityId === undefined ? {} : { entityId: input.entityId }),
    metadata,
    ...(context?.ipAddress === undefined ? {} : { ipAddress: context.ipAddress }),
    ...(context?.userAgent === undefined ? {} : { userAgent: context.userAgent }),
    ...(context?.requestId === undefined ? {} : { requestId: context.requestId }),
  });
};

/** Records a read of PHI. Reads are audited because looking is the sensitive act. */
export const recordRead = async (
  db: TenantDb,
  entityType: string,
  entityId?: string,
  extra?: AuditMetadata,
): Promise<void> =>
  record(db, {
    action: `${entityType}.read`,
    entityType,
    ...(entityId === undefined ? {} : { entityId }),
    ...(extra === undefined ? {} : { metadata: extra }),
  });

export type AuditListFilters = {
  readonly actorUserId?: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly from?: Date;
  readonly to?: Date;
  /** Opaque cursor: the id of the last row from the previous page. */
  readonly cursor?: string;
  readonly limit?: number;
};

export type AuditPage = {
  readonly items: readonly {
    readonly id: string;
    readonly organisationId: string | null;
    readonly actorUserId: string | null;
    readonly actorRole: string | null;
    readonly action: string;
    readonly entityType: string;
    readonly entityId: string | null;
    readonly metadata: unknown;
    readonly createdAt: Date;
  }[];
  readonly nextCursor: string | null;
};

/** Hard maximum, so a caller cannot ask for the whole table (apps/api/CLAUDE.md). */
export const MAX_PAGE_SIZE = 100;

export const list = async (db: TenantDb, filters: AuditListFilters): Promise<AuditPage> => {
  const limit = Math.min(filters.limit ?? 50, MAX_PAGE_SIZE);

  // One extra row tells us whether another page exists without a second count query.
  const rows = await repository.findMany(db, {
    ...(filters.actorUserId === undefined ? {} : { actorUserId: filters.actorUserId }),
    ...(filters.action === undefined ? {} : { action: filters.action }),
    ...(filters.entityType === undefined ? {} : { entityType: filters.entityType }),
    ...(filters.from === undefined ? {} : { from: filters.from }),
    ...(filters.to === undefined ? {} : { to: filters.to }),
    ...(filters.cursor === undefined ? {} : { cursor: filters.cursor }),
    take: limit + 1,
  });

  const items = rows.slice(0, limit);

  return {
    items,
    nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
  };
};
