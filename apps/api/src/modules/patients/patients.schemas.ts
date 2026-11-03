import { z } from 'zod';
import { APPOINTMENT_SOURCES, APPOINTMENT_STATUSES, PATIENT_SORTS } from '@clinicai/shared';

/**
 * Request and response shapes for the patient endpoints.
 *
 * The REQUEST bodies come from `@clinicai/shared` (`patientSchema`, `updatePatientSchema`),
 * because the dashboard's forms validate against the same rules. What lives here is the
 * surface that is only the API's business: path parameters, list filters, and the response
 * documents.
 *
 * RESPONSE SCHEMAS ARE DECLARED EVEN THOUGH NOTHING PARSES THEM AT RUNTIME. They are the
 * material M1-03 generates the OpenAPI document from, and writing them is what keeps the
 * generated client honest when it arrives. A route registered without one leaves a hole in
 * that document that nobody notices until the client is generated.
 */

export const patientParamsSchema = z.object({
  patientId: z.uuid(),
});

export type PatientParams = z.infer<typeof patientParamsSchema>;

/** Hard maximum page size (apps/api/CLAUDE.md). */
export const MAX_PAGE_SIZE = 100;

/**
 * The clinic a platform role is asking about.
 *
 * Optional, and ignored for a clinic role, whose organisation comes from the token. See
 * `common/organisation-scope.ts` for what happens when the two disagree.
 */
export const patientScopeQuerySchema = z.object({
  organisationId: z.uuid().optional(),
});

export type PatientScopeQuery = z.infer<typeof patientScopeQuerySchema>;

export const listPatientsQuerySchema = z.object({
  organisationId: z.uuid().optional(),
  /**
   * Free-text search across name and phone number.
   *
   * Bounded at 100 characters: a search term longer than that is a paste accident, and an
   * unbounded one is a pattern the database has to scan for.
   */
  q: z.string().trim().min(1).max(100).optional(),
  cursor: z.uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
  sort: z.enum(PATIENT_SORTS).default('recent'),
});

export type ListPatientsQuery = z.infer<typeof listPatientsQuerySchema>;

/**
 * A patient as the list shows them.
 *
 * `fullName`, `phone` and `dateOfBirth` are nullable in the RESPONSE although two of them
 * are required in the record, because a platform role reads them masked (the matrix gives
 * `read: 'masked'` for `patients`). A client that typed them as non-null would crash on the
 * masked form rather than render it.
 */
export const patientSummarySchema = z.object({
  id: z.uuid(),
  fullName: z.string().nullable(),
  phone: z.string().nullable(),
  dateOfBirth: z.string().nullable(),
  lastAppointmentAt: z.string().nullable(),
  nextAppointmentAt: z.string().nullable(),
  /** The same visit as `nextAppointmentAt`, with what it is and its state. */
  nextAppointment: z
    .object({
      startAt: z.string(),
      status: z.enum(APPOINTMENT_STATUSES),
      source: z.enum(APPOINTMENT_SOURCES),
      serviceName: z.string().nullable(),
    })
    .nullable(),
  createdAt: z.string(),
});

export const patientListResponseSchema = z.object({
  items: z.array(patientSummarySchema),
  nextCursor: z.string().nullable(),
});

const appointmentHistoryItemSchema = z.object({
  id: z.uuid(),
  startAt: z.string(),
  endAt: z.string(),
  status: z.enum(APPOINTMENT_STATUSES),
  source: z.enum(APPOINTMENT_SOURCES),
  doctorName: z.string(),
  serviceName: z.string().nullable(),
});

export const patientDetailResponseSchema = patientSummarySchema.extend({
  notes: z.string().nullable(),
  /** Newest first, bounded. A patient's whole history is not a page a screen can hold. */
  appointments: z.array(appointmentHistoryItemSchema),
  updatedAt: z.string(),
});

/** Counts only: no field of any patient, so it is not PHI and is not audited. */
export const patientSummaryResponseSchema = z.object({
  registered: z.number().int().nonnegative(),
  upcomingVisits: z.number().int().nonnegative(),
});

export const createdPatientResponseSchema = z.object({
  patientId: z.uuid(),
});
