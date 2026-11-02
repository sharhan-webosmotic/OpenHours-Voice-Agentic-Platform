import { z } from 'zod';
import { APPOINTMENT_SOURCES, APPOINTMENT_STATUSES } from '@clinicai/shared';

/**
 * Request and response shapes for the appointment endpoints.
 *
 * The bodies come from `@clinicai/shared`, because the dashboard's booking form validates
 * against the same rules. What is here is the API's own surface: parameters, list filters
 * and response documents.
 */

export const appointmentParamsSchema = z.object({
  appointmentId: z.uuid(),
});

export type AppointmentParams = z.infer<typeof appointmentParamsSchema>;

export const MAX_PAGE_SIZE = 100;

/**
 * List filters.
 *
 * `from` and `to` are INSTANTS, not clinic days, because the client already knows the
 * clinic's zone (every response carries it) and because a day range means two different
 * windows depending on whose calendar answers. The agenda endpoint is the one that takes a
 * day, and it converts using the clinic's own zone.
 */
export const appointmentScopeQuerySchema = z.object({
  organisationId: z.uuid().optional(),
});

export type AppointmentScopeQuery = z.infer<typeof appointmentScopeQuerySchema>;

export const listAppointmentsQuerySchema = z.object({
  organisationId: z.uuid().optional(),
  /**
   * Free text over the patient's name or number, bounded at 100 characters.
   *
   * Added after the dashboard was built: the prototype's appointment screen has a search box
   * and the endpoint had nothing to wire it to, so the screen shipped without one. A dead
   * search box on the screen reception uses all day is worse than a small endpoint change.
   */
  q: z.string().trim().min(1).max(100).optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  status: z
    .union([z.enum(APPOINTMENT_STATUSES), z.array(z.enum(APPOINTMENT_STATUSES))])
    .transform((value) => (Array.isArray(value) ? value : [value]))
    .optional(),
  doctorId: z.uuid().optional(),
  patientId: z.uuid().optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});

export type ListAppointmentsQuery = z.infer<typeof listAppointmentsQuerySchema>;

const patientRefSchema = z.object({
  id: z.uuid(),
  // Nullable because a platform role reads these masked.
  fullName: z.string().nullable(),
  phone: z.string().nullable(),
});

export const appointmentSchema = z.object({
  id: z.uuid(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(APPOINTMENT_STATUSES),
  source: z.enum(APPOINTMENT_SOURCES),
  patient: patientRefSchema,
  doctor: z.object({ id: z.uuid(), fullName: z.string() }),
  service: z
    .object({ id: z.uuid(), name: z.string(), durationMinutes: z.number().int() })
    .nullable(),
  cancelledAt: z.string().nullable(),
  cancellationReason: z.string().nullable(),
  rescheduledFromId: z.uuid().nullable(),
  createdAt: z.string(),
});

export const appointmentListResponseSchema = z.object({
  items: z.array(appointmentSchema),
  nextCursor: z.string().nullable(),
});

/**
 * The detail response is the list shape, with nothing added.
 *
 * It exists as its own name because the two WILL diverge: the notes field the prototype
 * shows needs a column that does not exist yet, and the detail screen is where it lands.
 */
export const appointmentDetailResponseSchema = appointmentSchema;

export const bookingResponseSchema = z.object({
  appointmentId: z.uuid(),
  startAt: z.string(),
  endAt: z.string(),
  replayed: z.boolean(),
});

export const agendaResponseSchema = z.object({
  range: z.enum(['day', 'week', 'month']),
  from: z.string(),
  to: z.string(),
  timeZone: z.string(),
  counts: z.object({
    SCHEDULED: z.number().int(),
    CONFIRMED: z.number().int(),
    COMPLETED: z.number().int(),
    CANCELLED: z.number().int(),
    NO_SHOW: z.number().int(),
  }),
  appointments: z.array(appointmentSchema),
});

export const availabilityResponseSchema = z.object({
  date: z.string(),
  timeZone: z.string(),
  doctorId: z.uuid(),
  serviceId: z.uuid(),
  durationMinutes: z.number().int(),
  slots: z.array(z.object({ startAt: z.string(), endAt: z.string(), label: z.string() })),
  /** Why the list is empty, so a screen never has to guess which empty it is showing. */
  reason: z.string().nullable(),
});
