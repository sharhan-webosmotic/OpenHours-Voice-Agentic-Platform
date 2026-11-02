import type { Prisma } from '../../generated/prisma/client.js';
import type { TenantDb } from '../../db/tenant-client.js';
import type { Role } from '@clinicai/shared';

/**
 * The only place in the audit module that touches Prisma (apps/api/CLAUDE.md). The
 * service decides what is safe to record; this writes and reads it.
 */

export type AuditRow = {
  readonly id: string;
  readonly organisationId: string | null;
  readonly actorUserId: string | null;
  readonly actorRole: string | null;
  readonly action: string;
  readonly entityType: string;
  readonly entityId: string | null;
  readonly metadata: unknown;
  readonly createdAt: Date;
};

export type InsertAudit = {
  readonly id: string;
  readonly organisationId?: string;
  readonly actorUserId?: string;
  readonly actorRole?: string;
  readonly action: string;
  readonly entityType: string;
  readonly entityId?: string;
  readonly metadata: Readonly<Record<string, unknown>>;
  readonly ipAddress?: string;
  readonly userAgent?: string;
  readonly requestId?: string;
};

export const insert = async (db: TenantDb, row: InsertAudit): Promise<void> => {
  await db.auditLog.create({
    data: {
      id: row.id,
      ...(row.organisationId === undefined ? {} : { organisationId: row.organisationId }),
      ...(row.actorUserId === undefined ? {} : { actorUserId: row.actorUserId }),
      ...(row.actorRole === undefined ? {} : { actorRole: row.actorRole as Role }),
      action: row.action,
      entityType: row.entityType,
      ...(row.entityId === undefined ? {} : { entityId: row.entityId }),
      metadata: row.metadata as Prisma.InputJsonValue,
      ...(row.ipAddress === undefined ? {} : { ipAddress: row.ipAddress }),
      ...(row.userAgent === undefined ? {} : { userAgent: row.userAgent }),
      ...(row.requestId === undefined ? {} : { requestId: row.requestId }),
    },
  });
};

export type FindManyArgs = {
  readonly actorUserId?: string;
  readonly action?: string;
  readonly entityType?: string;
  readonly from?: Date;
  readonly to?: Date;
  readonly cursor?: string;
  readonly take: number;
  /**
   * Restricts the result to these organisations OR to this actor's own entries.
   *
   * Used for an INTERNAL_ADMIN, whose reach is a set of organisations rather than one
   * tenant. Both halves are required together: the agreed table gives that role the
   * organisations it is involved with PLUS its own actions, and those are different
   * rows, so an AND would return almost nothing.
   */
  readonly scopedTo?: {
    readonly organisationIds: readonly string[];
    readonly orActorUserId: string;
  };
};

export const findMany = async (db: TenantDb, args: FindManyArgs): Promise<readonly AuditRow[]> =>
  db.auditLog.findMany({
    where: {
      ...(args.scopedTo === undefined
        ? {}
        : {
            OR: [
              { organisationId: { in: [...args.scopedTo.organisationIds] } },
              { actorUserId: args.scopedTo.orActorUserId },
            ],
          }),
      ...(args.actorUserId === undefined ? {} : { actorUserId: args.actorUserId }),
      ...(args.action === undefined ? {} : { action: args.action }),
      ...(args.entityType === undefined ? {} : { entityType: args.entityType }),
      ...(args.from === undefined && args.to === undefined
        ? {}
        : {
            createdAt: {
              ...(args.from === undefined ? {} : { gte: args.from }),
              ...(args.to === undefined ? {} : { lte: args.to }),
            },
          }),
    },
    // id is UUID v7, so it orders by creation time and makes the sort stable when two
    // rows share a timestamp. An unstable sort would skip or repeat rows across pages.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: args.take,
    ...(args.cursor === undefined ? {} : { cursor: { id: args.cursor }, skip: 1 }),
    select: {
      id: true,
      organisationId: true,
      actorUserId: true,
      actorRole: true,
      action: true,
      entityType: true,
      entityId: true,
      metadata: true,
      createdAt: true,
    },
  });
