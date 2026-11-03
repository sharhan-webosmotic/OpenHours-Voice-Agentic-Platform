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
  patientSummary: '/api/v1/patients/summary',
  patient: (patientId: string) => `/api/v1/patients/${patientId}`,
  appointments: '/api/v1/appointments',
  appointment: (appointmentId: string) => `/api/v1/appointments/${appointmentId}`,
  agenda: '/api/v1/appointments/agenda',
  availability: '/api/v1/appointments/availability',
  reschedule: (appointmentId: string) => `/api/v1/appointments/${appointmentId}/reschedule`,
  cancel: (appointmentId: string) => `/api/v1/appointments/${appointmentId}/cancel`,
  status: (appointmentId: string) => `/api/v1/appointments/${appointmentId}/status`,
  calls: '/api/v1/calls',
  call: (callId: string) => `/api/v1/calls/${callId}`,
  callRecordingUrl: (callId: string) => `/api/v1/calls/${callId}/recording-url`,
  overview: '/api/v1/analytics/overview',
} as const;

// ─── Patients ───────────────────────────────────────────────────────────────────

export type PatientSummary = {
  readonly id: string;
  readonly fullName: string | null;
  readonly phone: string | null;
  readonly dateOfBirth: string | null;
  readonly lastAppointmentAt: string | null;
  readonly nextAppointmentAt: string | null;
  /** The visit `nextAppointmentAt` names, with what it is and its state. */
  readonly nextAppointment: {
    readonly startAt: string;
    readonly status: AppointmentStatus;
    readonly source: AppointmentSource;
    readonly serviceName: string | null;
  } | null;
  readonly createdAt: string;
};

/** The patient directory's header counts. Names nobody. */
export type PatientDirectorySummary = {
  readonly registered: number;
  readonly upcomingVisits: number;
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
  /** PHI: the receptionist's note. Null for a platform role's masked read. */
  readonly notes: string | null;
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

// ─── Calls ──────────────────────────────────────────────────────────────────────

export const CALL_STATUSES = [
  'RINGING',
  'IN_PROGRESS',
  'COMPLETED',
  'MISSED',
  'ABANDONED',
  'FAILED',
] as const;

export type CallStatus = (typeof CALL_STATUSES)[number];

export type CallView = {
  readonly id: string;
  /** The provider's interaction id. Shown to staff only as a reference for support. */
  readonly externalCallId: string;
  readonly direction: 'INBOUND' | 'OUTBOUND';
  readonly status: CallStatus;
  readonly outcome: string;
  /**
   * NULL FOR A PLATFORM ROLE, whose matrix scope on `call_history` is `metadata`. A call's
   * numbers are personal data in their own right, so support sees that a call happened
   * without seeing who it was with.
   */
  readonly fromE164: string | null;
  readonly toE164: string | null;
  readonly startedAt: string | null;
  readonly endedAt: string | null;
  readonly durationSeconds: number | null;
  readonly patient: { readonly id: string; readonly fullName: string | null } | null;
  readonly appointmentId: string | null;
  /**
   * WHETHER a recording exists, never where it is. The key is a path in our own bucket and
   * is deliberately not part of this contract: a client that cannot learn it cannot try it.
   */
  readonly hasRecording: boolean;
  readonly createdAt: string;
};

export type CallListPage = {
  readonly items: readonly CallView[];
  readonly nextCursor: string | null;
};

export type CallTranscriptTurn = {
  readonly role: 'AGENT' | 'CALLER' | 'OTHER';
  readonly text: string;
};

export type CallDetail = {
  readonly call: CallView;
  /** Empty for a platform role: a transcript is further from metadata than a number is. */
  readonly transcript: readonly CallTranscriptTurn[];
};

export type CallRecordingUrl = {
  readonly url: string;
  readonly expiresInSeconds: number;
};

export type CallListQuery = {
  /** Clinic-local days, resolved into instants by the API, which knows the time zone. */
  readonly from?: string | undefined;
  readonly to?: string | undefined;
  readonly direction?: 'INBOUND' | 'OUTBOUND' | undefined;
  readonly status?: readonly CallStatus[] | undefined;
  /** Matched against the CALLER's number. The clinic's own number matches nothing. */
  readonly q?: string | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
};

// ─── Overview ───────────────────────────────────────────────────────────────────

export const OVERVIEW_RANGES = ['today', '7d', '30d', 'month', 'last-month'] as const;

export type OverviewRange = (typeof OVERVIEW_RANGES)[number];

export type OverviewMetric = { readonly value: number; readonly previous: number };

/**
 * The overview's cards and charts: counts and sums, nothing that names a person.
 *
 * Every figure has the equal period before it, so a delta is two real numbers compared
 * rather than a decoration. Transcribed from `apps/api/src/modules/analytics`.
 */
export type OverviewResult = {
  readonly range: OverviewRange;
  readonly from: string;
  readonly to: string;
  readonly timeZone: string;
  readonly currency: string;
  readonly kpis: {
    readonly callsAnswered: OverviewMetric;
    readonly aiBookings: OverviewMetric;
    readonly bookingRequests: { readonly value: number; readonly today: number };
    readonly needsAttention: OverviewMetric;
  };
  readonly revenue: {
    readonly valueMinor: number;
    readonly previousMinor: number;
    readonly series: readonly number[];
  };
  readonly daily: readonly {
    readonly day: string;
    readonly callsAnswered: number;
    readonly aiBookings: number;
    readonly bookingRequests: number;
    readonly needsAttention: number;
  }[];
  readonly outcomes: Readonly<
    Record<'BOOKED' | 'RESCHEDULED' | 'CANCELLED' | 'INFORMATION' | 'TRANSFERRED' | 'NONE', number>
  >;
  readonly agent: {
    readonly status: 'ACTIVE' | 'SUSPENDED' | 'DEACTIVATED' | null;
    readonly lastCallAt: string | null;
  };
};
