import { Router, type Request, type RequestHandler, type Response } from 'express';
import { registerRoute } from '../../common/route-registry.js';
import { validate, validatedData } from '../../common/validate.js';
import {
  requireAuth,
  requirePasswordChangeComplete,
  requireUser,
} from '../../common/auth.middleware.js';
import { currentPrincipal } from '../../common/permissions.js';
import * as schemas from './calls.schemas.js';
import * as service from './calls.service.js';

/**
 * The call history, for the dashboard.
 *
 * PHI-SENSITIVE, ALL THREE. A call names a caller by their number and may carry the whole
 * conversation, so reading one is reading patient data and every read is audited. The
 * recording endpoint is the most sensitive read in the product and is audited per URL minted.
 */

const AUTHENTICATED: readonly RequestHandler[] = [
  requireAuth,
  requireUser,
  requirePasswordChangeComplete,
];

const BASE = '/api/v1/calls';

registerRoute({
  method: 'get',
  path: BASE,
  summary: 'List calls, newest first, with day, direction, status and caller-number filters',
  query: schemas.listCallsQuerySchema,
  response: schemas.callListResponseSchema,
  permission: 'call_history:read',
  phiSensitive: true,
  auditAction: 'call.read',
});

registerRoute({
  method: 'get',
  path: `${BASE}/:callId`,
  summary: 'One call with its transcript',
  params: schemas.callParamsSchema,
  query: schemas.callScopeQuerySchema,
  response: schemas.callDetailResponseSchema,
  permission: 'call_history:read',
  phiSensitive: true,
  auditAction: 'call.read',
});

registerRoute({
  method: 'get',
  path: `${BASE}/:callId/recording-url`,
  summary: 'A short-lived presigned URL for one call’s recording',
  params: schemas.callParamsSchema,
  query: schemas.callScopeQuerySchema,
  response: schemas.recordingUrlResponseSchema,
  /**
   * `recordings`, NOT `call_history`: a different resource with a different row in the
   * matrix. Platform roles are denied outright, doctors too, and staff only while the clinic
   * has switched it on.
   */
  permission: 'recordings:read',
  phiSensitive: true,
  auditAction: 'call.recording_accessed',
});

export const callsRouter = (): Router => {
  const router = Router();

  router.get(
    '/',
    ...AUTHENTICATED,
    validate({ query: schemas.listCallsQuerySchema }),
    async (req: Request, res: Response) => {
      const { query } = validatedData<unknown, schemas.ListCallsQuery>(req);
      const result = await service.list(currentPrincipal(), query.organisationId, query);

      res.status(200).json(result);
    },
  );

  router.get(
    '/:callId',
    ...AUTHENTICATED,
    validate({ params: schemas.callParamsSchema, query: schemas.callScopeQuerySchema }),
    async (req: Request, res: Response) => {
      const { params, query } = validatedData<
        schemas.CallParams,
        { readonly organisationId?: string }
      >(req);

      const result = await service.get(currentPrincipal(), query.organisationId, params.callId);

      res.status(200).json(result);
    },
  );

  router.get(
    '/:callId/recording-url',
    ...AUTHENTICATED,
    validate({ params: schemas.callParamsSchema, query: schemas.callScopeQuerySchema }),
    async (req: Request, res: Response) => {
      const { params, query } = validatedData<
        schemas.CallParams,
        { readonly organisationId?: string }
      >(req);

      const result = await service.recordingUrl(
        currentPrincipal(),
        query.organisationId,
        params.callId,
      );

      res.status(200).json(result);
    },
  );

  return router;
};
