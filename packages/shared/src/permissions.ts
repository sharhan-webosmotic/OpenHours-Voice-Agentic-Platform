/**
 * The authorization matrix: the single definition of who may do what.
 *
 * Transcribed from the Roles and permissions table in the plan document. The API
 * enforces it in the SERVICE layer; the web apps may read it to hide controls, but
 * hiding a control is never the control (root CLAUDE.md rule 3).
 *
 * Anything not listed is denied. There is no implicit inheritance between roles: a
 * permission a role should have is written down, so reading a row tells the whole story.
 */

export const ROLES = [
  'SUPER_ADMIN',
  'INTERNAL_ADMIN',
  'CLINIC_OWNER',
  'CLINIC_MANAGER',
  'DOCTOR',
  'STAFF',
] as const;

export type Role = (typeof ROLES)[number];

export const RESOURCES = [
  'platform_users',
  'organisations',
  'phone_voice_mapping',
  'clinic_settings',
  'clinic_users',
  'doctors_services_hours',
  'patients',
  'appointments',
  'call_history',
  'recordings',
  'prescriptions',
  'follow_ups',
  'reminder_settings',
  'forwarding_schedules',
  'analytics',
  'audit_log',
  'integration_errors',
] as const;

export type Resource = (typeof RESOURCES)[number];

export const ACTIONS = ['read', 'write', 'delete'] as const;

export type Action = (typeof ACTIONS)[number];

/**
 * How wide a granted action reaches. `false` is a denial.
 *
 * These are not decoration: each one changes what the service must do beyond the
 * allow/deny decision, so they are part of the permission rather than a note about it.
 *
 *  all      - every row in the organisation.
 *  own      - only rows linked to this actor (a doctor's own patients and appointments).
 *  assigned - only rows assigned to this user (a staff member's follow-ups).
 *  masked   - readable, but patient-identifying fields are nulled unless a support
 *             session is active for that organisation.
 *  metadata - readable, but only non-identifying columns (call timings, not numbers).
 *  usage    - aggregate counts only, never per-patient figures.
 *  audit_scope - audit entries for organisations this admin is assigned, plus support
 *             sessions they opened.
 *  clinic_opt_in - allowed only while the clinic has switched it on
 *             (recordings_visible_to_staff, default false).
 */
export const SCOPES = [
  'all',
  'own',
  'assigned',
  'masked',
  'metadata',
  'usage',
  'audit_scope',
  'clinic_opt_in',
] as const;

export type Scope = (typeof SCOPES)[number];

/** A permission: the scope of each action, or false where the action is denied. */
export type Grant = {
  readonly read: Scope | false;
  readonly write: Scope | false;
  readonly delete: Scope | false;
};

const none: Grant = { read: false, write: false, delete: false };
const r = (scope: Scope = 'all'): Grant => ({ read: scope, write: false, delete: false });
const rw = (scope: Scope = 'all'): Grant => ({ read: scope, write: scope, delete: false });
const rwd = (scope: Scope = 'all'): Grant => ({ read: scope, write: scope, delete: scope });

export type Matrix = Readonly<Record<Resource, Readonly<Record<Role, Grant>>>>;

export const PERMISSIONS: Matrix = {
  platform_users: {
    SUPER_ADMIN: rwd(),
    INTERNAL_ADMIN: none,
    CLINIC_OWNER: none,
    CLINIC_MANAGER: none,
    DOCTOR: none,
    STAFF: none,
  },
  organisations: {
    SUPER_ADMIN: rwd(),
    INTERNAL_ADMIN: rw(),
    // Own organisation only, which tenant isolation enforces rather than the matrix.
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: none,
    DOCTOR: none,
    STAFF: none,
  },
  phone_voice_mapping: {
    SUPER_ADMIN: rw(),
    INTERNAL_ADMIN: rw(),
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: none,
    DOCTOR: none,
    STAFF: none,
  },
  clinic_settings: {
    SUPER_ADMIN: rw(),
    INTERNAL_ADMIN: rw(),
    CLINIC_OWNER: rw(),
    CLINIC_MANAGER: r(),
    DOCTOR: none,
    STAFF: none,
  },
  clinic_users: {
    SUPER_ADMIN: rw(),
    INTERNAL_ADMIN: rw(),
    CLINIC_OWNER: rwd(),
    CLINIC_MANAGER: r(),
    DOCTOR: none,
    STAFF: none,
  },
  doctors_services_hours: {
    SUPER_ADMIN: rw(),
    INTERNAL_ADMIN: r(),
    CLINIC_OWNER: rwd(),
    CLINIC_MANAGER: rw(),
    DOCTOR: r(),
    STAFF: r(),
  },
  patients: {
    // Platform roles see non-identifying fields only, until a support session is open.
    SUPER_ADMIN: r('masked'),
    INTERNAL_ADMIN: r('masked'),
    CLINIC_OWNER: rw(),
    CLINIC_MANAGER: rw(),
    DOCTOR: r('own'),
    STAFF: rw(),
  },
  appointments: {
    SUPER_ADMIN: r('masked'),
    INTERNAL_ADMIN: r('masked'),
    CLINIC_OWNER: rwd(),
    CLINIC_MANAGER: rwd(),
    DOCTOR: rw('own'),
    STAFF: rwd(),
  },
  call_history: {
    SUPER_ADMIN: r('metadata'),
    INTERNAL_ADMIN: r('metadata'),
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: r(),
    DOCTOR: r('own'),
    STAFF: r(),
  },
  recordings: {
    // Never for platform roles: a recording is the rawest PHI the platform holds.
    SUPER_ADMIN: none,
    INTERNAL_ADMIN: none,
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: r(),
    DOCTOR: none,
    STAFF: r('clinic_opt_in'),
  },
  prescriptions: {
    SUPER_ADMIN: none,
    INTERNAL_ADMIN: none,
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: none,
    DOCTOR: rw('own'),
    STAFF: none,
  },
  follow_ups: {
    SUPER_ADMIN: none,
    INTERNAL_ADMIN: none,
    CLINIC_OWNER: rwd(),
    CLINIC_MANAGER: rwd(),
    DOCTOR: rw(),
    STAFF: rw('assigned'),
  },
  reminder_settings: {
    SUPER_ADMIN: r(),
    INTERNAL_ADMIN: r(),
    CLINIC_OWNER: rw(),
    CLINIC_MANAGER: rw(),
    DOCTOR: none,
    STAFF: r(),
  },
  forwarding_schedules: {
    SUPER_ADMIN: r(),
    INTERNAL_ADMIN: r(),
    CLINIC_OWNER: rw(),
    CLINIC_MANAGER: rw(),
    DOCTOR: none,
    STAFF: none,
  },
  analytics: {
    SUPER_ADMIN: r('usage'),
    INTERNAL_ADMIN: r('usage'),
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: r(),
    DOCTOR: r('own'),
    STAFF: none,
  },
  audit_log: {
    SUPER_ADMIN: r(),
    INTERNAL_ADMIN: r('audit_scope'),
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: none,
    DOCTOR: none,
    STAFF: none,
  },
  integration_errors: {
    SUPER_ADMIN: r(),
    INTERNAL_ADMIN: r(),
    CLINIC_OWNER: none,
    CLINIC_MANAGER: none,
    DOCTOR: none,
    STAFF: none,
  },
};

/** Roles that belong to no organisation and may act across tenants. */
export const PLATFORM_ROLES: readonly Role[] = ['SUPER_ADMIN', 'INTERNAL_ADMIN'];

export const isPlatformRole = (role: Role): boolean => PLATFORM_ROLES.includes(role);

/**
 * The scope at which `role` may perform `action` on `resource`, or false if it may not.
 *
 * Returning the scope rather than a boolean is deliberate: a caller that only checks
 * truthiness would treat "own appointments" as "all appointments", which is the exact
 * mistake this type makes impossible to ignore.
 */
export const permissionScope = (role: Role, resource: Resource, action: Action): Scope | false =>
  PERMISSIONS[resource][role][action];

/** Whether the action is permitted at all, ignoring how far it reaches. */
export const isPermitted = (role: Role, resource: Resource, action: Action): boolean =>
  permissionScope(role, resource, action) !== false;
