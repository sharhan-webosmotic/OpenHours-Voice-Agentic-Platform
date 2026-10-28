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
  'ClinicHours',
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
 * Organisation is scoped by its PRIMARY KEY, not by an organisation_id column, so it
 * needs a different injection rule from every other model.
 */
export const ORGANISATION_MODEL = 'Organisation';
