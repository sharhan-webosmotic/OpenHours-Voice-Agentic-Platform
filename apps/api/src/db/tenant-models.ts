/**
 * Every Prisma model the tenant extension must scope.
 *
 * Hard-coded on purpose, so the behaviour is readable and reviewable rather than
 * inferred at runtime. `tenant-client.test.ts` asserts this list equals the set of
 * models the schema actually gives an organisation_id, so a model added later fails
 * loudly instead of quietly escaping the application lock.
 */
export const TENANT_MODELS: ReadonlySet<string> = new Set([
  'Appointment',
  'AuditLog',
  'Call',
  'CallTranscriptTurn',
  'ClinicAgentProfile',
  'ClinicBookingPolicy',
  'ClinicFaq',
  'ClinicHours',
  'ClinicProfile',
  'ClinicTelephony',
  'Device',
  'Doctor',
  'DoctorService',
  'DoctorTimeOff',
  'DoctorWorkingHours',
  'FollowUp',
  'ForwardingEvent',
  'ForwardingSchedule',
  'Notification',
  'OutboundCall',
  'PairingCode',
  'Patient',
  'PhoneNumber',
  'Prescription',
  'PrescriptionItem',
  'Service',
  'SupportSession',
  'User',
  'VoiceAgent',
  'WebhookEvent',
]);

/**
 * Every field the schema types `Json`, on any model.
 *
 * The extension refuses nested relation writes (`connect`, `create` and the rest inside
 * `data`), and it tells a relation field from a value by these names: a JSON column may hold
 * an object with any keys at all, including `create`, because a provider's webhook payload is
 * stored as it arrived. Hard-coded for the same reason as TENANT_MODELS, and
 * `tenant-extension.test.ts` asserts it equals the schema's Json fields and that no relation
 * field anywhere shares one of these names.
 */
export const JSON_FIELDS: ReadonlySet<string> = new Set([
  'config',
  'metadata',
  'payload',
  'settings',
]);

/**
 * Organisation is scoped by its PRIMARY KEY, not by an organisation_id column, so it
 * needs a different injection rule from every other model.
 */
export const ORGANISATION_MODEL = 'Organisation';
