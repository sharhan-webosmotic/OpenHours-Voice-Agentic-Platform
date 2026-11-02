import { Router, type Request, type RequestHandler, type Response } from 'express';
import {
  patientSchema,
  updatePatientSchema,
  type PatientInput,
  type UpdatePatientInput,
} from '@clinicai/shared';
import { registerRoute } from '../../common/route-registry.js';
import { validate, validatedData } from '../../common/validate.js';
import {
  requireAuth,
  requirePasswordChangeComplete,
  requireUser,
} from '../../common/auth.middleware.js';
import { currentPrincipal } from '../../common/permissions.js';
import * as schemas from './patients.schemas.js';
import * as service from './patients.service.js';

/**
 * Patient endpoints, for the clinic dashboard.
 *
 * EVERY ROUTE HERE IS `phiSensitive` AND DECLARES AN AUDIT ACTION, including the two reads.
 * In a clinic, looking at a record is the sensitive act, so a read with no audit row is the
 * gap that matters most. `tests/phi-routes-are-audited.test.ts` drives each of these for
 * real and fails if the row does not appear, which is why the declaration below is a
 * statement about behaviour rather than a label.
 *
 * NO `tenantMiddleware`, FOR THE SAME REASON THE CLINIC CONFIGURATION ROUTES DO WITHOUT IT.
 * That middleware requires an organisation in the request context, and SUPER_ADMIN and
 * INTERNAL_ADMIN have none, so gating on it would refuse the two roles the matrix grants a
 * masked read to. The scope is resolved per principal inside the service, through
 * `withOrganisationScope`, which confines a platform read to the one clinic it named.
 *
 * WHICH CLINIC, AND WHERE THAT COMES FROM. A clinic role's organisation comes from the
 * verified token and nothing else (root CLAUDE.md rule 2). A platform role has none, so it
 * must name one with `?organisationId=`, and `organisationInScope` refuses a clinic role
 * that names a different clinic with a 404 rather than a 403 (rule 7).
 *
 * NO `DELETE`. The matrix gives nobody `delete` on `patients`, and the column is a soft
 * delete for a reason: appointment and prescription history has to survive a patient being
 * removed. A removal endpoint is a separate decision with a retention policy attached.
 */

const AUTHENTICATED: readonly RequestHandler[] = [
  requireAuth,
  requireUser,
  requirePasswordChangeComplete,
];

const BASE = '/api/v1/patients';

registerRoute({
  method: 'get',
  path: BASE,
  summary: 'List patients, with search, sort and cursor pagination',
  query: schemas.listPatientsQuerySchema,
  response: schemas.patientListResponseSchema,
  permission: 'patients:read',
  phiSensitive: true,
  auditAction: 'patient.read',
});

registerRoute({
  method: 'post',
  path: BASE,
  summary: 'Create a patient record',
  body: patientSchema,
  response: schemas.createdPatientResponseSchema,
  permission: 'patients:write',
  phiSensitive: true,
  auditAction: 'patient.created',
});

registerRoute({
  method: 'get',
  path: `${BASE}/:patientId`,
  summary: 'One patient, with their appointment history',
  params: schemas.patientParamsSchema,
  query: schemas.patientScopeQuerySchema,
  response: schemas.patientDetailResponseSchema,
  permission: 'patients:read',
  phiSensitive: true,
  auditAction: 'patient.read',
});

registerRoute({
  method: 'patch',
  path: `${BASE}/:patientId`,
  summary: 'Update a patient record',
  params: schemas.patientParamsSchema,
  body: updatePatientSchema,
  permission: 'patients:write',
  phiSensitive: true,
  auditAction: 'patient.updated',
});

export const patientsRouter = (): Router => {
  const router = Router();

  router.get(
    '/',
    ...AUTHENTICATED,
    validate({ query: schemas.listPatientsQuerySchema }),
    async (req: Request, res: Response) => {
      const { query } = validatedData<unknown, schemas.ListPatientsQuery>(req);
      const principal = currentPrincipal();
      const page = await service.list(principal, query.organisationId, query);

      res.status(200).json(page);
    },
  );

  router.post(
    '/',
    ...AUTHENTICATED,
    validate({ body: patientSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, PatientInput>(req);
      const principal = currentPrincipal();
      // A write is clinic-only (the matrix denies platform roles), so the organisation is
      // the caller's own and `organisationInScope` refuses anything else.
      const created = await service.create(principal, undefined, body);

      res.status(201).json(created);
    },
  );

  router.get(
    '/:patientId',
    ...AUTHENTICATED,
    validate({ params: schemas.patientParamsSchema, query: schemas.patientScopeQuerySchema }),
    async (req: Request, res: Response) => {
      const { params, query } = validatedData<schemas.PatientParams, schemas.PatientScopeQuery>(
        req,
      );
      const principal = currentPrincipal();
      const patient = await service.get(principal, query.organisationId, params.patientId);

      res.status(200).json(patient);
    },
  );

  router.patch(
    '/:patientId',
    ...AUTHENTICATED,
    validate({ params: schemas.patientParamsSchema, body: updatePatientSchema }),
    async (req: Request, res: Response) => {
      const { params, body } = validatedData<schemas.PatientParams, unknown, UpdatePatientInput>(
        req,
      );

      const principal = currentPrincipal();
      await service.update(principal, undefined, params.patientId, body);

      res.status(204).end();
    },
  );

  return router;
};
