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
  /**
   * The AI voice receptionist, which is a principal and NOT A PERSON.
   *
   * It is in this list so that what the agent may do is one readable row of the same
   * matrix as everybody else, enforced by the same service-layer check, rather than a
   * second capability table in a second place with its own bugs. Reading the
   * `VOICE_AGENT` column tells the whole story, including that it may not touch
   * recordings, prescriptions, follow-ups, analytics or the audit trail.
   *
   * IT IS NOT A ROLE A USER CAN HOLD, and four separate controls say so:
   *   - the Prisma `Role` enum stays at six values, so no user row can store it
   *   - `verifyAccessToken` refuses the claim, so no session can present it
   *   - `USER_ROLES` is what every schema and every dropdown is built from
   *   - it belongs to no login audience, so no sign-in can land on it
   * Each of those has a test. The agent authenticates with a per-clinic secret on the
   * voice tool endpoints (D-004) and never with a token.
   */
  'VOICE_AGENT',
] as const;

export type Role = (typeof ROLES)[number];

/**
 * The roles a USER row may hold: every role except the voice agent.
 *
 * This is the list to build a dropdown, a zod enum or an invitation from. `ROLES` is the
 * list to iterate when checking the matrix. Mixing them up is how `VOICE_AGENT` would end
 * up offered as a job title in the admin console.
 *
 * `UserRole` IS A TYPE AND NOT ONLY A LIST, so a map of roles to labels or to form fields
 * that accidentally includes the agent does not compile. A test can only catch the lists
 * somebody remembered to test.
 */
export type UserRole = Exclude<Role, 'VOICE_AGENT'>;

export const USER_ROLES: readonly UserRole[] = ROLES.filter(
  (role): role is UserRole => role !== 'VOICE_AGENT',
);

export const isUserRole = (value: unknown): value is UserRole =>
  typeof value === 'string' && (USER_ROLES as readonly string[]).includes(value);

/**
 * Whether a value is one of the six roles.
 *
 * Exists so nothing has to cast a string into `Role` on trust. The API's request context
 * holds `role` as a string, because it is read from a token claim, and an unchecked
 * `as Role` there is what let an unrecognised role reach the matrix.
 */
export const isRole = (value: unknown): value is Role =>
  typeof value === 'string' && (ROLES as readonly string[]).includes(value);

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
    VOICE_AGENT: none,
  },
  organisations: {
    SUPER_ADMIN: rwd(),
    INTERNAL_ADMIN: rw(),
    // Own organisation only, which tenant isolation enforces rather than the matrix.
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: none,
    DOCTOR: none,
    STAFF: none,
    VOICE_AGENT: none,
  },
  phone_voice_mapping: {
    SUPER_ADMIN: rw(),
    INTERNAL_ADMIN: rw(),
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: none,
    DOCTOR: none,
    STAFF: none,
    VOICE_AGENT: none,
  },
  clinic_settings: {
    SUPER_ADMIN: rw(),
    INTERNAL_ADMIN: rw(),
    CLINIC_OWNER: rw(),
    CLINIC_MANAGER: r(),
    DOCTOR: none,
    STAFF: none,
    // Reads the clinic's own name, address, hours and answers, to speak them. Never writes.
    VOICE_AGENT: r(),
  },
  clinic_users: {
    SUPER_ADMIN: rw(),
    INTERNAL_ADMIN: rw(),
    CLINIC_OWNER: rwd(),
    CLINIC_MANAGER: r(),
    DOCTOR: none,
    STAFF: none,
    VOICE_AGENT: none,
  },
  doctors_services_hours: {
    SUPER_ADMIN: rw(),
    INTERNAL_ADMIN: r(),
    CLINIC_OWNER: rwd(),
    CLINIC_MANAGER: rw(),
    DOCTOR: r(),
    STAFF: r(),
    // Needed to offer a doctor and a service by name, and to run the slot engine.
    VOICE_AGENT: r(),
  },
  patients: {
    // Platform roles see non-identifying fields only, until a support session is open.
    SUPER_ADMIN: r('masked'),
    INTERNAL_ADMIN: r('masked'),
    CLINIC_OWNER: rw(),
    CLINIC_MANAGER: rw(),
    DOCTOR: r('own'),
    STAFF: rw(),
    /**
     * Write, because a first-time caller has no record and the alternative is an agent
     * that cannot book for anybody new. The capability is bounded by the ABSENCE OF AN
     * ENDPOINT rather than by the matrix: the tool surface exposes a lookup and a create,
     * and no way to edit or delete an existing patient. `write` here cannot express
     * "create but not update", so the endpoint list is the control and this is the ceiling.
     */
    VOICE_AGENT: rw(),
  },
  appointments: {
    SUPER_ADMIN: r('masked'),
    INTERNAL_ADMIN: r('masked'),
    CLINIC_OWNER: rwd(),
    CLINIC_MANAGER: rwd(),
    DOCTOR: rw('own'),
    STAFF: rwd(),
    // Books, reschedules and cancels, which is the whole job (root CLAUDE.md rule 9).
    // No delete: a cancellation is a status, and nothing the agent does removes a row.
    VOICE_AGENT: rw(),
  },
  call_history: {
    SUPER_ADMIN: r('metadata'),
    INTERNAL_ADMIN: r('metadata'),
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: r(),
    DOCTOR: r('own'),
    STAFF: r(),
    VOICE_AGENT: none,
  },
  recordings: {
    // Never for platform roles: a recording is the rawest PHI the platform holds.
    SUPER_ADMIN: none,
    INTERNAL_ADMIN: none,
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: r(),
    DOCTOR: none,
    STAFF: r('clinic_opt_in'),
    // The agent is IN the recording. Nothing it does needs to read one back.
    VOICE_AGENT: none,
  },
  prescriptions: {
    SUPER_ADMIN: none,
    INTERNAL_ADMIN: none,
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: none,
    DOCTOR: rw('own'),
    STAFF: none,
    // Rule 9: the agent never diagnoses, prescribes or decides anything clinical.
    VOICE_AGENT: none,
  },
  follow_ups: {
    SUPER_ADMIN: none,
    INTERNAL_ADMIN: none,
    CLINIC_OWNER: rwd(),
    CLINIC_MANAGER: rwd(),
    DOCTOR: rw(),
    STAFF: rw('assigned'),
    VOICE_AGENT: none,
  },
  reminder_settings: {
    SUPER_ADMIN: r(),
    INTERNAL_ADMIN: r(),
    CLINIC_OWNER: rw(),
    CLINIC_MANAGER: rw(),
    DOCTOR: none,
    STAFF: r(),
    VOICE_AGENT: none,
  },
  forwarding_schedules: {
    SUPER_ADMIN: r(),
    INTERNAL_ADMIN: r(),
    CLINIC_OWNER: rw(),
    CLINIC_MANAGER: rw(),
    DOCTOR: none,
    STAFF: none,
    VOICE_AGENT: none,
  },
  analytics: {
    SUPER_ADMIN: r('usage'),
    INTERNAL_ADMIN: r('usage'),
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: r(),
    DOCTOR: r('own'),
    STAFF: none,
    VOICE_AGENT: none,
  },
  audit_log: {
    SUPER_ADMIN: r(),
    INTERNAL_ADMIN: r('audit_scope'),
    CLINIC_OWNER: r(),
    CLINIC_MANAGER: none,
    DOCTOR: none,
    STAFF: none,
    VOICE_AGENT: none,
  },
  integration_errors: {
    SUPER_ADMIN: r(),
    INTERNAL_ADMIN: r(),
    CLINIC_OWNER: none,
    CLINIC_MANAGER: none,
    DOCTOR: none,
    STAFF: none,
    VOICE_AGENT: none,
  },
};

/** Roles that belong to no organisation and may act across tenants. */
export const PLATFORM_ROLES: readonly Role[] = ['SUPER_ADMIN', 'INTERNAL_ADMIN'];

export const isPlatformRole = (role: Role): boolean => PLATFORM_ROLES.includes(role);

/**
 * Which front end a sign-in came from.
 *
 * `clinic` is the dashboard at app.*, `admin` is the internal console at admin.*.
 */
export const LOGIN_AUDIENCES = ['clinic', 'admin'] as const;

export type LoginAudience = (typeof LOGIN_AUDIENCES)[number];

/**
 * Whether `role` belongs in the application that asked.
 *
 * NOT A SECURITY BOUNDARY, and ADR-0001 says so in those words. What protects the admin
 * surface is the permission matrix enforced in the service layer, plus
 * `requireOrganisation` on clinic routes. This exists so a person who opens the wrong
 * application is told which one to use, instead of signing in successfully and then
 * meeting a wall of empty screens and 403s, and so that no refresh cookie is left set for
 * a session the application is about to reject.
 *
 * It is safe for the client to supply the audience because it can only ever cause a
 * REFUSAL: it selects no organisation and no role, so a client that lies about it refuses
 * itself and gains nothing. No route may ever treat it as a reason to skip a permission
 * check.
 */
export const roleBelongsInAudience = (role: Role, audience: LoginAudience): boolean => {
  /**
   * The voice agent belongs in NEITHER application, and this is written as its own branch
   * rather than left to `!isPlatformRole`, which would have answered `true` for the clinic
   * dashboard and made the agent look like an ordinary clinic sign-in.
   */
  if (role === 'VOICE_AGENT') {
    return false;
  }

  return audience === 'admin' ? isPlatformRole(role) : !isPlatformRole(role);
};

/**
 * The scope at which `role` may perform `action` on `resource`, or false if it may not.
 *
 * Returning the scope rather than a boolean is deliberate: a caller that only checks
 * truthiness would treat "own appointments" as "all appointments", which is the exact
 * mistake this type makes impossible to ignore.
 */
export const permissionScope = (role: Role, resource: Resource, action: Action): Scope | false => {
  /**
   * Default deny for a role the matrix does not list, rather than indexing `undefined`.
   *
   * The types say this cannot happen, and the types were not enough: `role` originates in
   * a JWT claim, and an unrecognised value used to throw
   * `TypeError: Cannot read properties of undefined` instead of denying. So the
   * "anything not listed is denied" property held for resources and actions but not for
   * roles, and a Role added to the database enum without a matrix row would have become a
   * 500 on every request by that role rather than a clean 403. Review finding I13.
   *
   * The token verifier now refuses such a claim outright, so this is the second line
   * rather than the first. It also covers the other callers of the matrix, including the
   * web apps' menu filtering, which do not go through that verifier.
   */
  if (!isRole(role)) {
    return false;
  }

  return PERMISSIONS[resource][role][action];
};

/** Whether the action is permitted at all, ignoring how far it reaches. */
export const isPermitted = (role: Role, resource: Resource, action: Action): boolean =>
  permissionScope(role, resource, action) !== false;
