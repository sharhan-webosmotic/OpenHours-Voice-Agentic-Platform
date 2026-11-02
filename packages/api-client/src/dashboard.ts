import type { AppointmentSource, AppointmentStatus } from '@clinicai/shared';

/**
 * The clinic dashboard's read surface: paths and response types, hand-written.
 *
 * NO FETCHING HAPPENS HERE, unlike `clinics.ts`. The dashboard's data layer is RTK Query
 * over a baseQuery that calls `apiClient.request` (D-015), so an endpoint hands the
 * transport a `{ path, method, body }` descriptor and this module is where the path and the
 * response type live. Putting them here rather than in the feature keeps one description of
 * the contract, which is the same reason `clinics.ts` exists.
 *
 * HAND-WRITTEN, AND OWED BACK. M1-03 generates this from an OpenAPI document and has now
 * slipped twice; `docs/BACKLOG.md` records what that costs. The types below are transcribed
 * from the API's own zod response schemas, the `.schemas.ts` file in each module under
 * `apps/api/src/modules`, and nothing enforces that they still agree: that enforcement is
 * exactly what M1-03 owes.
 *
 * NULLABLE PATIENT FIELDS ARE NOT AN ACCIDENT. `fullName` and `phone` are `string | null`
 * because the permission matrix gives platform roles a MASKED read, which returns the row
 * with those fields nulled. A client that typed them as `string` would crash on the masked
 * form rather than render it.
 */

export const DASHBOARD_PATHS = {
  patients: '/api/v1/patients',
  patient: (patientId: string) => `/api/v1/patients/${patientId}`,
  appointments: '/api/v1/appointments',
  appointment: (appointmentId: string) => `/api/v1/appointments/${appointmentId}`,
  agenda: '/api/v1/appointments/agenda',
  availability: '/api/v1/appointments/availability',
  reschedule: (appointmentId: string) => `/api/v1/appointments/${appointmentId}/reschedule`,
  cancel: (appointmentId: string) => `/api/v1/appointments/${appointmentId}/cancel`,
  status: (appointmentId: string) => `/api/v1/appointments/${appointmentId}/status`,
} as const;

// ─── Patients ───────────────────────────────────────────────────────────────────

export type PatientSummary = {
  readonly id: string;
  readonly fullName: string | null;
  readonly phone: string | null;
  readonly dateOfBirth: string | null;
  readonly lastAppointmentAt: string | null;
  readonly nextAppointmentAt: string | null;
  readonly createdAt: string;
};

export type PatientListPage = {
  readonly items: readonly PatientSummary[];
  readonly nextCursor: string | null;
};

export type PatientAppointment = {
  readonly id: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly status: AppointmentStatus;
  readonly source: AppointmentSource;
  readonly doctorName: string;
  readonly serviceName: string | null;
};

export type PatientDetail = PatientSummary & {
  readonly notes: string | null;
  readonly updatedAt: string;
  readonly appointments: readonly PatientAppointment[];
};

export type PatientListQuery = {
  readonly q?: string | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
  readonly sort?: 'recent' | 'name' | undefined;
};

// ─── Appointments ───────────────────────────────────────────────────────────────

export type AppointmentView = {
  readonly id: string;
  readonly startAt: string;
  readonly endAt: string;
  readonly status: AppointmentStatus;
  readonly source: AppointmentSource;
  readonly patient: {
    readonly id: string;
    readonly fullName: string | null;
    readonly phone: string | null;
  };
  readonly doctor: { readonly id: string; readonly fullName: string };
  readonly service: {
    readonly id: string;
    readonly name: string;
    readonly durationMinutes: number;
  } | null;
  readonly cancelledAt: string | null;
  readonly cancellationReason: string | null;
  readonly rescheduledFromId: string | null;
  readonly createdAt: string;
};

export type AppointmentListPage = {
  readonly items: readonly AppointmentView[];
  readonly nextCursor: string | null;
};

export type AppointmentListQuery = {
  /** Free text over the patient's name or number. */
  readonly q?: string | undefined;
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly status?: readonly AppointmentStatus[] | undefined;
  readonly doctorId?: string | undefined;
  readonly patientId?: string | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
};

export type AgendaCounts = Readonly<Record<AppointmentStatus, number>>;

export type AgendaResult = {
  readonly range: 'day' | 'week' | 'month';
  readonly from: string;
  readonly to: string;
  /** The clinic's IANA zone. Every date on every screen is rendered in it. */
  readonly timeZone: string;
  readonly counts: AgendaCounts;
  readonly appointments: readonly AppointmentView[];
};

export type AgendaQuery = {
  readonly range: 'day' | 'week' | 'month';
  readonly on: string;
  readonly doctorId?: string | undefined;
};

export type AvailabilitySlot = {
  readonly startAt: string;
  readonly endAt: string;
  /** `09:30`, already in the clinic's zone, so a screen never re-derives it. */
  readonly label: string;
};

/**
 * `reason` is why the list is empty, and it is the reason the screen can be honest.
 *
 * `CLINIC_CLOSED` and `FULLY_BOOKED` are both "no slots" and mean entirely different things
 * to the person reading the screen. Without it, every empty day would say the same thing.
 */
export type AvailabilityReason =
  | 'HOURS_NOT_COLLECTED'
  | 'DAY_IN_THE_PAST'
  | 'BEYOND_MAXIMUM_ADVANCE'
  | 'CLINIC_CLOSED'
  | 'DOCTOR_NOT_WORKING'
  | 'FULLY_BOOKED';

export type AvailabilityResult = {
  readonly date: string;
  readonly timeZone: string;
  readonly doctorId: string;
  readonly serviceId: string;
  readonly durationMinutes: number;
  readonly slots: readonly AvailabilitySlot[];
  readonly reason: AvailabilityReason | null;
};

export type AvailabilityQuery = {
  readonly doctorId: string;
  readonly serviceId: string;
  readonly date: string;
};

export type BookingResult = {
  readonly appointmentId: string;
  readonly startAt: string;
  readonly endAt: string;
  /** True when an `Idempotency-Key` replay returned the original booking. */
  readonly replayed: boolean;
};

/**
 * Builds a query string from a filter object, dropping anything absent.
 *
 * Here rather than in each feature because every list endpoint needs it and because the
 * alternative, template literals at each call site, is how `?limit=undefined` reaches a
 * server. An array value repeats the key, which is the shape the API's `status` filter
 * parses.
 */
export const toQueryString = (filters: Record<string, unknown>): string => {
  const params = new URLSearchParams();

  /**
   * Only primitives are serialised, and anything else is DROPPED rather than coerced.
   *
   * `String({})` is `[object Object]`, which as a query value is a filter the server cannot
   * parse and a bug nobody sees until they wonder why a list ignored them. A filter type is
   * strings, numbers and booleans, so anything else here is a programming error and the
   * honest thing is to leave it out.
   */
  const serialise = (value: unknown): string | undefined =>
    typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean'
      ? String(value)
      : undefined;

  for (const [key, value] of Object.entries(filters)) {
    if (value === undefined || value === null || value === '') {
      continue;
    }

    if (Array.isArray(value)) {
      for (const item of value) {
        const serialised = serialise(item);
        if (serialised !== undefined) {
          params.append(key, serialised);
        }
      }
      continue;
    }

    const serialised = serialise(value);
    if (serialised !== undefined) {
      params.set(key, serialised);
    }
  }

  const query = params.toString();
  return query === '' ? '' : `?${query}`;
};
