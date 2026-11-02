export { createApiClient, CSRF_HEADER } from './client.js';
export type { ApiClient, ApiClientOptions, CurrentUser, Session } from './client.js';
export {
  ApiError,
  FORBIDDEN_TYPE,
  PASSWORD_CHANGE_REQUIRED_TYPE,
  TOO_MANY_REQUESTS_TYPE,
  UNAUTHORIZED_TYPE,
  VALIDATION_FAILED_TYPE,
  toProblem,
} from './problem.js';
export type { FieldError, ProblemDetails } from './problem.js';

/**
 * The clinic configuration surface.
 *
 * Exported as a FACTORY rather than folded into `createApiClient`'s return value, so that
 * the `ApiClient` type keeps the five auth members it has today. Adding members to that
 * type would break both applications' test harnesses, which build a complete stub of it,
 * and the clinic dashboard does not use these endpoints at all. The admin console
 * instantiates it once, over the same authenticated caller, in its own `lib/apiClient.ts`.
 */
export { createClinicsApi } from './clinics.js';
export type {
  AgentProfileView,
  AuthedFetch,
  ClinicDetailView,
  ClinicListFilters,
  ClinicsApi,
  DayHoursView,
  DoctorView,
  FaqView,
  OrganisationPage,
  OrganisationSummary,
  ReadinessRequirementView,
  ReadinessView,
  SarvamMappingView,
  SavedSarvamMapping,
  ServiceView,
  TelephonyView,
} from './clinics.js';

/**
 * The clinic dashboard's read surface: paths and response types, no fetching.
 *
 * Exported separately from `createClinicsApi` because the dashboard's transport is RTK
 * Query over `apiClient.request` (D-015), so it needs the contract rather than a client.
 */
export {
  CALL_STATUSES,
  DASHBOARD_PATHS,
  toQueryString,
  type AgendaCounts,
  type AgendaQuery,
  type AgendaResult,
  type AppointmentListPage,
  type AppointmentListQuery,
  type AppointmentView,
  type AvailabilityQuery,
  type AvailabilityReason,
  type AvailabilityResult,
  type AvailabilitySlot,
  type BookingResult,
  type CallDetail,
  type CallListPage,
  type CallListQuery,
  type CallRecordingUrl,
  type CallStatus,
  type CallTranscriptTurn,
  type CallView,
  type PatientAppointment,
  type PatientDetail,
  type PatientListPage,
  type PatientListQuery,
  type PatientSummary,
} from './dashboard.js';
