import type { NextFunction, Request, Response } from 'express';
import { tenantDb } from '../../db/tenant.middleware.js';
import * as audit from './audit.service.js';

/**
 * Wraps a read endpoint so the read itself is audited.
 *
 * Mounted on routes over patients, prescriptions and recordings. For PHI, looking IS
 * the sensitive act, so a trail that recorded only writes would miss the thing most
 * worth knowing: who viewed a record and when.
 *
 * The row is written before the handler runs, inside the request transaction. If the
 * handler then fails, the transaction rolls back and the audit row goes with it, which
 * is correct: no data was disclosed.
 */
export const auditRead =
  (entityType: string) =>
  (req: Request, _res: Response, next: NextFunction): void => {
    const entityId = typeof req.params.id === 'string' ? req.params.id : undefined;

    audit
      .recordRead(tenantDb(req), entityType, entityId)
      .then(() => {
        next();
      })
      .catch(next);
  };
