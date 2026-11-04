import { Router, type Request, type RequestHandler, type Response } from 'express';
import { z } from 'zod';
import {
  agendaQuerySchema,
  availabilityQuerySchema,
  cancelAppointmentSchema,
  changeAppointmentStatusSchema,
  createAppointmentSchema,
  rescheduleAppointmentSchema,
  type AgendaQuery,
  type AvailabilityQuery,
  type CancelAppointmentInput,
  type ChangeAppointmentStatusInput,
  type CreateAppointmentInput,
  type RescheduleAppointmentInput,
} from '@clinicai/shared';
import { registerRoute } from '../../common/route-registry.js';
import { validate, validatedData } from '../../common/validate.js';
import {
  requireAuth,
  requirePasswordChangeComplete,
  requireUser,
} from '../../common/auth.middleware.js';
import { currentPrincipal } from '../../common/permissions.js';
import { ValidationError } from '../../common/errors.js';
import * as schemas from './appointments.schemas.js';
import * as service from './appointments.service.js';

/**
 * Appointment endpoints, for the clinic dashboard.
 *
 * PHI-SENSITIVE, ALL OF THEM EXCEPT AVAILABILITY. An appointment names a patient, so reading
 * one is reading patient data and is audited. A slot list is the clinic's own opening hours
 * with the taken times removed and names nobody, so auditing it would add a row per keystroke
 * on a date picker and bury the reads that matter.
 *
 * THE ACTIONS ARE SUB-RESOURCES, NOT STATUS FIELDS IN A PATCH
 * (`POST /appointments/:id/cancel`), which is the convention in `backend-api-standards`. It
 * also happens to be the honest shape: cancelling takes a reason, rescheduling takes a new
 * time and makes a new row, and a status change is a transition that can be refused. Three
 * different operations behind one `PATCH status` field would hide all of that.
 */

const AUTHENTICATED: readonly RequestHandler[] = [
  requireAuth,
  requireUser,
  requirePasswordChangeComplete,
];

const BASE = '/api/v1/appointments';

/**
 * The `Idempotency-Key` header, if the client sent one (root CLAUDE.md rule 8).
 *
 * BOUNDED AND CHARACTER-CHECKED, because it is client-supplied text that becomes a unique
 * index key. A 400 here is better than a database error on a 2 KB key, and the restriction to
 * printable ASCII keeps it loggable, which a raw header is not.
 */
const idempotencyKey = (req: Request): string | undefined => {
  const header = req.get('Idempotency-Key');

  if (header === undefined || header.trim() === '') {
    return undefined;
  }

  const key = header.trim();

  if (key.length > 200 || !/^[\x20-\x7E]+$/.test(key)) {
    throw new ValidationError(
      'malformed Idempotency-Key header',
      'The Idempotency-Key is invalid.',
      [{ field: 'header.Idempotency-Key', message: 'must be up to 200 printable characters' }],
    );
  }

  return key;
};

registerRoute({
  method: 'get',
  path: BASE,
  summary: 'List appointments in a window, with status, doctor and patient filters',
  query: schemas.listAppointmentsQuerySchema,
  response: schemas.appointmentListResponseSchema,
  permission: 'appointments:read',
  phiSensitive: true,
  auditAction: 'appointment.read',
});

registerRoute({
  method: 'post',
  path: BASE,
  summary: 'Book an appointment, idempotent on Idempotency-Key',
  body: createAppointmentSchema,
  response: schemas.bookingResponseSchema,
  permission: 'appointments:write',
  phiSensitive: true,
  auditAction: 'appointment.created',
});

registerRoute({
  method: 'get',
  path: `${BASE}/agenda`,
  summary: 'Appointments and status counts for a day, week or month',
  query: agendaQuerySchema.extend({ organisationId: z.uuid().optional() }),
  response: schemas.agendaResponseSchema,
  permission: 'appointments:read',
  phiSensitive: true,
  auditAction: 'appointment.read',
});

registerRoute({
  method: 'get',
  path: `${BASE}/availability`,
  summary: 'Bookable slots for a doctor, service and date',
  query: availabilityQuerySchema.extend({ organisationId: z.uuid().optional() }),
  response: schemas.availabilityResponseSchema,
  permission: 'appointments:read',
  // A slot list names no patient. See the module comment.
  phiSensitive: false,
});

registerRoute({
  method: 'get',
  path: `${BASE}/:appointmentId`,
  summary: 'One appointment',
  params: schemas.appointmentParamsSchema,
  query: schemas.appointmentScopeQuerySchema,
  response: schemas.appointmentDetailResponseSchema,
  permission: 'appointments:read',
  phiSensitive: true,
  auditAction: 'appointment.read',
});

registerRoute({
  method: 'post',
  path: `${BASE}/:appointmentId/reschedule`,
  summary: 'Move an appointment to another time, keeping the history',
  params: schemas.appointmentParamsSchema,
  body: rescheduleAppointmentSchema,
  response: schemas.bookingResponseSchema,
  permission: 'appointments:write',
  phiSensitive: true,
  auditAction: 'appointment.rescheduled',
});

registerRoute({
  method: 'post',
  path: `${BASE}/:appointmentId/cancel`,
  summary: 'Cancel an appointment',
  params: schemas.appointmentParamsSchema,
  body: cancelAppointmentSchema,
  permission: 'appointments:write',
  phiSensitive: true,
  auditAction: 'appointment.cancelled',
});

registerRoute({
  method: 'post',
  path: `${BASE}/:appointmentId/status`,
  summary: 'Move an appointment to another status, if the transition is allowed',
  params: schemas.appointmentParamsSchema,
  body: changeAppointmentStatusSchema,
  permission: 'appointments:write',
  phiSensitive: true,
  auditAction: 'appointment.status_changed',
});

export const appointmentsRouter = (): Router => {
  const router = Router();

  /**
   * `/agenda` and `/availability` are declared BEFORE `/:appointmentId`.
   *
   * Express matches in order, so a parameter route declared first would swallow both and
   * answer a request for the agenda with "that is not a uuid".
   */
  router.get(
    '/agenda',
    ...AUTHENTICATED,
    validate({ query: agendaQuerySchema.extend({ organisationId: z.uuid().optional() }) }),
    async (req: Request, res: Response) => {
      const { query } = validatedData<unknown, AgendaQuery & { organisationId?: string }>(req);
      const principal = currentPrincipal();
      const result = await service.agenda(principal, query.organisationId, query);

      res.status(200).json(result);
    },
  );

  router.get(
    '/availability',
    ...AUTHENTICATED,
    validate({ query: availabilityQuerySchema.extend({ organisationId: z.uuid().optional() }) }),
    async (req: Request, res: Response) => {
      const { query } = validatedData<unknown, AvailabilityQuery & { organisationId?: string }>(
        req,
      );
      const principal = currentPrincipal();
      const result = await service.availability(principal, query.organisationId, query);

      res.status(200).json(result);
    },
  );

  router.get(
    '/',
    ...AUTHENTICATED,
    validate({ query: schemas.listAppointmentsQuerySchema }),
    async (req: Request, res: Response) => {
      const { query } = validatedData<unknown, schemas.ListAppointmentsQuery>(req);
      const principal = currentPrincipal();
      const page = await service.list(principal, query.organisationId, query);

      res.status(200).json(page);
    },
  );

  router.post(
    '/',
    ...AUTHENTICATED,
    validate({ body: createAppointmentSchema }),
    async (req: Request, res: Response) => {
      const { body } = validatedData<unknown, unknown, CreateAppointmentInput>(req);
      const key = idempotencyKey(req);
      const principal = currentPrincipal();

      const result = await service.book(
        principal,
        // A write is clinic-only, so the service resolves the caller's own clinic from the
        // token. Passing `undefined` is what says "mine", never a client-supplied id.
        undefined,
        body,
        {
          // A booking made in the dashboard is DASHBOARD. A walk-in is recorded as DASHBOARD
          // too for now, which is the enum gap recorded in docs/features/clinic-dashboard.md.
          source: 'DASHBOARD',
          ...(key === undefined ? {} : { idempotencyKey: key }),
        },
      );

      // A replay returns 200 with the original booking rather than a second 201, so a
      // client can tell "already done" from "done just now".
      res.status(result.replayed ? 200 : 201).json(result);
    },
  );

  router.get(
    '/:appointmentId',
    ...AUTHENTICATED,
    validate({
      params: schemas.appointmentParamsSchema,
      query: schemas.appointmentScopeQuerySchema,
    }),
    async (req: Request, res: Response) => {
      const { params, query } = validatedData<
        schemas.AppointmentParams,
        schemas.AppointmentScopeQuery
      >(req);
      const principal = currentPrincipal();
      const appointment = await service.get(principal, query.organisationId, params.appointmentId);

      res.status(200).json(appointment);
    },
  );

  router.post(
    '/:appointmentId/reschedule',
    ...AUTHENTICATED,
    validate({ params: schemas.appointmentParamsSchema, body: rescheduleAppointmentSchema }),
    async (req: Request, res: Response) => {
      const { params, body } = validatedData<
        schemas.AppointmentParams,
        unknown,
        RescheduleAppointmentInput
      >(req);

      const principal = currentPrincipal();
      const result = await service.reschedule(principal, undefined, params.appointmentId, body);

      res.status(201).json(result);
    },
  );

  router.post(
    '/:appointmentId/cancel',
    ...AUTHENTICATED,
    validate({ params: schemas.appointmentParamsSchema, body: cancelAppointmentSchema }),
    async (req: Request, res: Response) => {
      const { params, body } = validatedData<
        schemas.AppointmentParams,
        unknown,
        CancelAppointmentInput
      >(req);

      const principal = currentPrincipal();
      await service.cancel(principal, undefined, params.appointmentId, body);

      res.status(204).end();
    },
  );

  router.post(
    '/:appointmentId/status',
    ...AUTHENTICATED,
    validate({ params: schemas.appointmentParamsSchema, body: changeAppointmentStatusSchema }),
    async (req: Request, res: Response) => {
      const { params, body } = validatedData<
        schemas.AppointmentParams,
        unknown,
        ChangeAppointmentStatusInput
      >(req);

      const principal = currentPrincipal();
      await service.changeStatus(principal, undefined, params.appointmentId, body.status);

      res.status(204).end();
    },
  );

  return router;
};
