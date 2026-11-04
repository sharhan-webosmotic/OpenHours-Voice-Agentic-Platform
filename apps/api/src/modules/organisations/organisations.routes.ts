import { Router, type Request, type RequestHandler, type Response } from 'express';
import type {
  AgentProfileInput,
  BookingPolicyInput,
  ClinicFaqsInput,
  ClinicHoursInput,
  ClinicProfileInput,
  CreateClinicOwnerInput,
  CreateOrganisationInput,
  DoctorInput,
  OrganisationStatus,
  SarvamMappingInput,
  ServiceInput,
  TelephonyInput,
  UpdateOrganisationInput,
} from '@clinicai/shared';
import { registerRoute } from '../../common/route-registry.js';
import { validate, validatedData } from '../../common/validate.js';
import {
  requireAuth,
  requirePasswordChangeComplete,
  requireUser,
} from '../../common/auth.middleware.js';
import { currentPrincipal } from '../../common/permissions.js';
import {
  presentClinicDetail,
  presentOrganisationSummary,
  presentPromptPreview,
} from './organisations.presenter.js';
import * as schemas from './organisations.schemas.js';
import * as service from './organisations.service.js';
import { createClinicOwner } from '../clinic-users/clinic-users.service.js';

/**
 * Clinic configuration endpoints, for the admin console.
 *
 * NO `tenantMiddleware` ON ANY ROUTE HERE, deliberately, and for the same reason
 * `GET /api/v1/audit-logs` does without it: that middleware requires an organisation in the
 * request context, and SUPER_ADMIN and INTERNAL_ADMIN have none, so gating these routes on
 * it would refuse exactly the roles the matrix grants them to. The scope is resolved per
 * principal inside the service, through `withPrincipalScope`: a clinic role reads and writes
 * inside its own tenant transaction, a platform role through `asSystem`, which audits the
 * use of cross-tenant scope on every call.
 *
 * NONE OF THESE ROUTES IS `phiSensitive`. Clinic configuration is not patient data: it is
 * opening hours, services, policies and a provider mapping. They are still audited, because
 * rule 5 covers sensitive writes and a clinic's operating configuration qualifies, and the
 * service writes those rows. `tests/clinic-configuration-is-audited.test.ts` drives every
 * write and proves the row appears, which is the same guard
 * `phi-routes-are-audited.test.ts` applies to the PHI routes.
 *
 * SECTION WRITES ARE `PUT`, not `PATCH`, and the body carries every field of the section
 * including the ones being cleared. A partial section update would make "field absent" and
 * "field set to null" the same request, and clearing a clinic's greeting is a thing somebody
 * will legitimately want to do.
 */

/** The guards every route here shares: a real user who has replaced a temporary password. */
const AUTHENTICATED: readonly RequestHandler[] = [
  requireAuth,
  requireUser,
  requirePasswordChangeComplete,
];

const BASE = '/api/v1/organisations';

registerRoute({
  method: 'get',
  path: BASE,
  summary: 'List clinics, newest first, with search and cursor pagination',
  query: schemas.listQuerySchema,
  response: schemas.organisationListResponseSchema,
  permission: 'organisations:read',
  phiSensitive: false,
});

registerRoute({
  method: 'post',
  path: BASE,
  summary: 'Create a clinic and its empty configuration sections',
  body: schemas.createOrganisationSchema,
  response: schemas.createdOrganisationResponseSchema,
  permission: 'organisations:write',
  phiSensitive: false,
  auditAction: 'organisation.created',
});

registerRoute({
  method: 'get',
  path: `${BASE}/:organisationId`,
  summary: 'One clinic, every configuration section, and what is still missing before go-live',
  params: schemas.organisationParamsSchema,
  response: schemas.clinicDetailResponseSchema,
  permission: 'organisations:read',
  phiSensitive: false,
  auditAction: 'organisation.viewed',
});

registerRoute({
  method: 'get',
  path: `${BASE}/:organisationId/prompt-preview`,
  summary: "The clinic's master prompt as it would be rendered now, read-only",
  params: schemas.organisationParamsSchema,
  response: schemas.promptPreviewResponseSchema,
  permission: 'organisations:read',
  phiSensitive: false,
  auditAction: 'organisation.prompt_previewed',
});

registerRoute({
  method: 'post',
  path: `${BASE}/:organisationId/owners`,
  summary: 'Create a clinic owner login, returning its temporary password once',
  params: schemas.organisationParamsSchema,
  body: schemas.createClinicOwnerSchema,
  response: schemas.createdClinicOwnerResponseSchema,
  permission: 'clinic_users:write',
  phiSensitive: false,
  auditAction: 'clinic_user.created',
});

registerRoute({
  method: 'patch',
  path: `${BASE}/:organisationId`,
  summary: "Update a clinic's name, time zone or status",
  params: schemas.organisationParamsSchema,
  body: schemas.updateOrganisationSchema,
  permission: 'organisations:write',
  phiSensitive: false,
  auditAction: 'organisation.updated',
});

registerRoute({
  method: 'put',
  path: `${BASE}/:organisationId/profile`,
  summary: 'Replace identity, contact details, address and map link',
  params: schemas.organisationParamsSchema,
  body: schemas.clinicProfileSchema,
  permission: 'clinic_settings:write',
  phiSensitive: false,
  auditAction: 'clinic_settings.profile.updated',
});

registerRoute({
  method: 'put',
  path: `${BASE}/:organisationId/hours`,
  summary: 'Replace the whole week of opening hours, including the closed days',
  params: schemas.organisationParamsSchema,
  body: schemas.clinicHoursSchema,
  permission: 'clinic_settings:write',
  phiSensitive: false,
  auditAction: 'clinic_settings.hours.replaced',
});

registerRoute({
  method: 'put',
  path: `${BASE}/:organisationId/booking-policy`,
  summary: 'Replace the booking policy',
  params: schemas.organisationParamsSchema,
  body: schemas.bookingPolicySchema,
  permission: 'clinic_settings:write',
  phiSensitive: false,
  auditAction: 'clinic_settings.booking_policy.updated',
});

registerRoute({
  method: 'put',
  path: `${BASE}/:organisationId/agent-profile`,
  summary: "Replace the agent's greeting, languages, tone, escalation and never-promise list",
  params: schemas.organisationParamsSchema,
  body: schemas.agentProfileSchema,
  permission: 'clinic_settings:write',
  phiSensitive: false,
  auditAction: 'clinic_settings.agent_profile.updated',
});

registerRoute({
  method: 'put',
  path: `${BASE}/:organisationId/telephony`,
  summary: 'Replace the recording and consent arrangement',
  params: schemas.organisationParamsSchema,
  body: schemas.telephonySchema,
  permission: 'clinic_settings:write',
  phiSensitive: false,
  auditAction: 'clinic_settings.telephony.updated',
});

registerRoute({
  method: 'put',
  path: `${BASE}/:organisationId/faqs`,
  summary: 'Replace the frequently asked answers, in the order given',
  params: schemas.organisationParamsSchema,
  body: schemas.clinicFaqsSchema,
  permission: 'clinic_settings:write',
  phiSensitive: false,
  auditAction: 'clinic_settings.faqs.replaced',
});

registerRoute({
  method: 'put',
  path: `${BASE}/:organisationId/sarvam-mapping`,
  summary: 'Save the hand-entered Sarvam mapping, minting each per-clinic secret once',
  params: schemas.organisationParamsSchema,
  body: schemas.sarvamMappingBodySchema,
  response: schemas.savedSarvamMappingResponseSchema,
  permission: 'phone_voice_mapping:write',
  phiSensitive: false,
  auditAction: 'phone_voice_mapping.updated',
});

registerRoute({
  method: 'post',
  path: `${BASE}/:organisationId/services`,
  summary: 'Add a bookable service',
  params: schemas.organisationParamsSchema,
  body: schemas.serviceSchema,
  response: schemas.createdServiceResponseSchema,
  permission: 'doctors_services_hours:write',
  phiSensitive: false,
  auditAction: 'service.created',
});

registerRoute({
  method: 'patch',
  path: `${BASE}/:organisationId/services/:serviceId`,
  summary: 'Change a service, including switching it off',
  params: schemas.serviceParamsSchema,
  body: schemas.updateServiceSchema,
  permission: 'doctors_services_hours:write',
  phiSensitive: false,
  auditAction: 'service.updated',
});

registerRoute({
  method: 'post',
  path: `${BASE}/:organisationId/doctors`,
  summary: 'Add a doctor patients can be booked with',
  params: schemas.organisationParamsSchema,
  body: schemas.doctorSchema,
  response: schemas.createdDoctorResponseSchema,
  permission: 'doctors_services_hours:write',
  phiSensitive: false,
  auditAction: 'doctor.created',
});

registerRoute({
  method: 'get',
  path: `${BASE}/:organisationId/doctors/:doctorId/hours`,
  summary: "A doctor's working week, all seven weekdays",
  params: schemas.doctorParamsSchema,
  response: schemas.doctorHoursResponseSchema,
  permission: 'doctors_services_hours:read',
  phiSensitive: false,
});

registerRoute({
  method: 'put',
  path: `${BASE}/:organisationId/doctors/:doctorId/hours`,
  summary: "Replace a doctor's whole working week, including the days off",
  params: schemas.doctorParamsSchema,
  body: schemas.clinicHoursSchema,
  permission: 'doctors_services_hours:write',
  phiSensitive: false,
  auditAction: 'doctor.hours.replaced',
});

registerRoute({
  method: 'patch',
  path: `${BASE}/:organisationId/doctors/:doctorId`,
  summary: 'Change a doctor, including switching them off',
  params: schemas.doctorParamsSchema,
  body: schemas.updateDoctorSchema,
  permission: 'doctors_services_hours:write',
  phiSensitive: false,
  auditAction: 'doctor.updated',
});

type OrganisationParams = { readonly organisationId: string };

/** Reads the validated organisation id. Never from anything else on the request. */
const organisationId = (req: Request): string =>
  validatedData<OrganisationParams, unknown, unknown>(req).params.organisationId;

export const organisationsRouter = (): Router => {
  const router = Router();

  router.get(
    '/',
    ...AUTHENTICATED,
    validate({ query: schemas.listQuerySchema }),
    async (req: Request, res: Response) => {
      const { query } = validatedData<
        unknown,
        {
          q?: string;
          status?: OrganisationStatus;
          cursor?: string;
          limit: number;
        },
        unknown
      >(req);

      const page = await service.listOrganisations(currentPrincipal(), {
        ...(query.q === undefined ? {} : { search: query.q }),
        ...(query.status === undefined ? {} : { status: query.status }),
        ...(query.cursor === undefined ? {} : { cursor: query.cursor }),
        limit: query.limit,
      });

      res.status(200).json({
        items: page.items.map(presentOrganisationSummary),
        nextCursor: page.nextCursor,
      });
    },
  );

  router.post(
    '/',
    ...AUTHENTICATED,
    validate({ body: schemas.createOrganisationSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, CreateOrganisationInput>(req);
      const created = await service.createOrganisation(currentPrincipal(), body);

      res.status(201).json(created);
    },
  );

  router.get(
    '/:organisationId',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema }),
    async (req: Request, res: Response) => {
      const detail = await service.getClinic(currentPrincipal(), organisationId(req));

      res.status(200).json(presentClinicDetail(detail));
    },
  );

  router.get(
    '/:organisationId/prompt-preview',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema }),
    async (req: Request, res: Response) => {
      const preview = await service.previewPrompt(currentPrincipal(), organisationId(req));

      // The clinic's whole configuration in one block of text: never kept by a cache.
      res.set('Cache-Control', 'no-store');
      res.status(200).json(presentPromptPreview(preview));
    },
  );

  router.post(
    '/:organisationId/owners',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.createClinicOwnerSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<OrganisationParams, unknown, CreateClinicOwnerInput>(req);
      const created = await createClinicOwner(currentPrincipal(), organisationId(req), body);

      // Carries a live temporary password: no browser, proxy or cache may keep a copy.
      res.set('Cache-Control', 'no-store');
      res.status(201).json(created);
    },
  );

  router.patch(
    '/:organisationId',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.updateOrganisationSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<OrganisationParams, unknown, UpdateOrganisationInput>(req);
      await service.updateOrganisation(currentPrincipal(), organisationId(req), body);

      res.status(204).end();
    },
  );

  router.put(
    '/:organisationId/profile',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.clinicProfileSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<OrganisationParams, unknown, ClinicProfileInput>(req);
      await service.updateClinicProfile(currentPrincipal(), organisationId(req), body);

      res.status(204).end();
    },
  );

  router.put(
    '/:organisationId/hours',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.clinicHoursSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<OrganisationParams, unknown, ClinicHoursInput>(req);
      await service.replaceClinicHours(currentPrincipal(), organisationId(req), body);

      res.status(204).end();
    },
  );

  router.put(
    '/:organisationId/booking-policy',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.bookingPolicySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<OrganisationParams, unknown, BookingPolicyInput>(req);
      await service.updateBookingPolicy(currentPrincipal(), organisationId(req), body);

      res.status(204).end();
    },
  );

  router.put(
    '/:organisationId/agent-profile',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.agentProfileSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<OrganisationParams, unknown, AgentProfileInput>(req);
      await service.updateAgentProfile(currentPrincipal(), organisationId(req), body);

      res.status(204).end();
    },
  );

  router.put(
    '/:organisationId/telephony',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.telephonySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<OrganisationParams, unknown, TelephonyInput>(req);
      await service.updateTelephony(currentPrincipal(), organisationId(req), body);

      res.status(204).end();
    },
  );

  router.put(
    '/:organisationId/faqs',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.clinicFaqsSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<OrganisationParams, unknown, ClinicFaqsInput>(req);
      await service.replaceFaqs(currentPrincipal(), organisationId(req), body);

      res.status(204).end();
    },
  );

  router.put(
    '/:organisationId/sarvam-mapping',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.sarvamMappingBodySchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<
        OrganisationParams,
        unknown,
        {
          mapping: SarvamMappingInput;
          regenerateToolSecret: boolean;
          regenerateWebhookSecret: boolean;
        }
      >(req);

      const saved = await service.saveSarvamMapping(
        currentPrincipal(),
        organisationId(req),
        body.mapping,
        {
          regenerateToolSecret: body.regenerateToolSecret,
          regenerateWebhookSecret: body.regenerateWebhookSecret,
        },
      );

      // 200 rather than 204 because a save that mints a secret returns it, once.
      res.status(200).json(saved);
    },
  );

  router.post(
    '/:organisationId/services',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.serviceSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<OrganisationParams, unknown, ServiceInput>(req);
      const created = await service.createService(currentPrincipal(), organisationId(req), body);

      res.status(201).json(created);
    },
  );

  router.patch(
    '/:organisationId/services/:serviceId',
    ...AUTHENTICATED,
    validate({ params: schemas.serviceParamsSchema, body: schemas.updateServiceSchema }),
    async (req: Request, res: Response) => {
      const { params, body } = validatedData<
        { organisationId: string; serviceId: string },
        unknown,
        Partial<ServiceInput>
      >(req);

      await service.updateService(
        currentPrincipal(),
        params.organisationId,
        params.serviceId,
        body,
      );

      res.status(204).end();
    },
  );

  router.post(
    '/:organisationId/doctors',
    ...AUTHENTICATED,
    validate({ params: schemas.organisationParamsSchema, body: schemas.doctorSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<OrganisationParams, unknown, DoctorInput>(req);
      const created = await service.createDoctor(currentPrincipal(), organisationId(req), body);

      res.status(201).json(created);
    },
  );

  router.patch(
    '/:organisationId/doctors/:doctorId',
    ...AUTHENTICATED,
    validate({ params: schemas.doctorParamsSchema, body: schemas.updateDoctorSchema }),
    async (req: Request, res: Response) => {
      const { params, body } = validatedData<
        { organisationId: string; doctorId: string },
        unknown,
        Partial<DoctorInput>
      >(req);

      await service.updateDoctor(currentPrincipal(), params.organisationId, params.doctorId, body);

      res.status(204).end();
    },
  );

  router.get(
    '/:organisationId/doctors/:doctorId/hours',
    ...AUTHENTICATED,
    validate({ params: schemas.doctorParamsSchema }),
    async (req: Request, res: Response) => {
      const { params } = validatedData<{ organisationId: string; doctorId: string }>(req);

      res
        .status(200)
        .json(
          await service.getDoctorHours(currentPrincipal(), params.organisationId, params.doctorId),
        );
    },
  );

  router.put(
    '/:organisationId/doctors/:doctorId/hours',
    ...AUTHENTICATED,
    validate({ params: schemas.doctorParamsSchema, body: schemas.clinicHoursSchema }),
    async (req: Request, res: Response) => {
      const { params, body } = validatedData<
        { organisationId: string; doctorId: string },
        unknown,
        ClinicHoursInput
      >(req);

      await service.replaceDoctorHours(
        currentPrincipal(),
        params.organisationId,
        params.doctorId,
        body,
      );

      res.status(204).end();
    },
  );

  return router;
};
