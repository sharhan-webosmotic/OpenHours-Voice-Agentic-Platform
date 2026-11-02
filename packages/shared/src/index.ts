/**
 * Shared contracts used by the API and both web apps: zod schemas, enums and the
 * permission matrix. Named exports only.
 *
 * The permission matrix lives in `permissions.ts` and is imported by the API and by both
 * consoles, which is the one copy root CLAUDE.md rule 3 allows. The clinic configuration
 * contract lives in `clinic.ts` for the same reason: the API's routes, the admin console's
 * forms and the prompt renderer must agree on what a valid opening hour is.
 */

/** Semantic version of the shared contract package, for diagnostics endpoints. */
export const SHARED_CONTRACT_VERSION = '0.1.0';

export { CSRF_HEADER_NAME } from './session.js';

export {
  ACTIONS,
  LOGIN_AUDIENCES,
  PERMISSIONS,
  PLATFORM_ROLES,
  RESOURCES,
  ROLES,
  SCOPES,
  isPermitted,
  isPlatformRole,
  isRole,
  permissionScope,
  roleBelongsInAudience,
  type Action,
  type Grant,
  type LoginAudience,
  type Matrix,
  type Resource,
  type Role,
  type Scope,
} from './permissions.js';

export {
  DEFAULT_COUNTRY_CODE,
  isE164,
  normalisePhone,
  toE164,
  type PhoneNormalisation,
  type PhoneProblem,
} from './phone.js';

export { SUGGESTED_TIME_ZONES, isIanaTimeZone } from './timezone.js';

export {
  PATIENT_SORTS,
  patientSchema,
  updatePatientSchema,
  type PatientInput,
  type PatientSort,
  type UpdatePatientInput,
} from './patient.js';

export {
  AGENDA_RANGES,
  APPOINTMENT_SOURCES,
  APPOINTMENT_STATUSES,
  APPOINTMENT_TRANSITIONS,
  SLOT_HOLDING_STATUSES,
  agendaQuerySchema,
  availabilityQuerySchema,
  canTransition,
  cancelAppointmentSchema,
  changeAppointmentStatusSchema,
  createAppointmentSchema,
  holdsSlot,
  rescheduleAppointmentSchema,
  type AgendaQuery,
  type AgendaRange,
  type AppointmentSource,
  type AppointmentStatus,
  type AvailabilityQuery,
  type CancelAppointmentInput,
  type ChangeAppointmentStatusInput,
  type CreateAppointmentInput,
  type RescheduleAppointmentInput,
} from './appointment.js';

export {
  addDays,
  clinicDayOf,
  daysBetween,
  endOfClinicDay,
  formatMinuteOfDay,
  isClinicDay,
  startOfClinicDay,
  weekdayOf,
  zonedParts,
  zonedTimeToUtc,
  type ClinicDay,
  type ZonedParts,
} from './clinic-time.js';

export {
  AGENT_TONES,
  MINUTES_IN_DAY,
  ORGANISATION_STATUSES,
  RECORDING_CONSENT_MODES,
  SUGGESTED_AGENT_LANGUAGES,
  WEEKDAYS,
  agentProfileSchema,
  bookingPolicySchema,
  clinicFaqsSchema,
  clinicHoursSchema,
  clinicProfileSchema,
  createOrganisationSchema,
  dayHoursSchema,
  doctorSchema,
  e164Schema,
  faqSchema,
  hoursSegmentSchema,
  languageTagSchema,
  phoneSchema,
  sarvamMappingSchema,
  serviceSchema,
  telephonySchema,
  timezoneSchema,
  updateDoctorSchema,
  updateOrganisationSchema,
  updateServiceSchema,
  type AgentProfileInput,
  type AgentTone,
  type BookingPolicyInput,
  type ClinicFaqsInput,
  type ClinicHoursInput,
  type ClinicProfileInput,
  type CreateOrganisationInput,
  type DayHours,
  type DoctorInput,
  type FaqInput,
  type HoursSegment,
  type OrganisationStatus,
  type RecordingConsentMode,
  type SarvamMappingInput,
  type ServiceInput,
  type TelephonyInput,
  type UpdateOrganisationInput,
  type Weekday,
} from './clinic.js';

export {
  READINESS_REQUIREMENTS,
  READINESS_SECTIONS,
  clinicReadiness,
  type ClinicReadiness,
  type ReadinessInput,
  type ReadinessRequirement,
  type ReadinessSection,
} from './clinic-readiness.js';
