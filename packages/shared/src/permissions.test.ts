import { describe, expect, it } from 'vitest';
import {
  ACTIONS,
  PERMISSIONS,
  RESOURCES,
  ROLES,
  isPermitted,
  isPlatformRole,
  isRole,
  permissionScope,
  type Grant,
  type Resource,
  type Role,
  type Scope,
} from './permissions.js';

/**
 * One test per matrix cell, generated from the resource and role lists, so a new
 * resource or role cannot be added without being covered.
 *
 * EXPECTED below is an INDEPENDENT transcription of the Roles and permissions table from
 * the plan document. It is deliberately a second encoding rather than being derived from
 * PERMISSIONS: a test generated from the thing it checks would pass no matter what the
 * matrix said. Because the two are separate, changing one cell in PERMISSIONS fails
 * exactly one generated test, which forces the change to be deliberate.
 *
 * Notation: letters are the permitted actions (R read, W write, D delete), `-` is none,
 * and an optional `:scope` applies to every granted action in that cell.
 */
const EXPECTED: Readonly<Record<Resource, Readonly<Record<Role, string>>>> = {
  platform_users: {
    SUPER_ADMIN: 'RWD',
    INTERNAL_ADMIN: '-',
    CLINIC_OWNER: '-',
    CLINIC_MANAGER: '-',
    DOCTOR: '-',
    STAFF: '-',
  },
  organisations: {
    SUPER_ADMIN: 'RWD',
    INTERNAL_ADMIN: 'RW',
    CLINIC_OWNER: 'R',
    CLINIC_MANAGER: '-',
    DOCTOR: '-',
    STAFF: '-',
  },
  phone_voice_mapping: {
    SUPER_ADMIN: 'RW',
    INTERNAL_ADMIN: 'RW',
    CLINIC_OWNER: 'R',
    CLINIC_MANAGER: '-',
    DOCTOR: '-',
    STAFF: '-',
  },
  clinic_settings: {
    SUPER_ADMIN: 'RW',
    INTERNAL_ADMIN: 'RW',
    CLINIC_OWNER: 'RW',
    CLINIC_MANAGER: 'R',
    DOCTOR: '-',
    STAFF: '-',
  },
  clinic_users: {
    SUPER_ADMIN: 'RW',
    INTERNAL_ADMIN: 'RW',
    CLINIC_OWNER: 'RWD',
    CLINIC_MANAGER: 'R',
    DOCTOR: '-',
    STAFF: '-',
  },
  doctors_services_hours: {
    SUPER_ADMIN: 'RW',
    INTERNAL_ADMIN: 'R',
    CLINIC_OWNER: 'RWD',
    CLINIC_MANAGER: 'RW',
    DOCTOR: 'R',
    STAFF: 'R',
  },
  patients: {
    SUPER_ADMIN: 'R:masked',
    INTERNAL_ADMIN: 'R:masked',
    CLINIC_OWNER: 'RW',
    CLINIC_MANAGER: 'RW',
    DOCTOR: 'R:own',
    STAFF: 'RW',
  },
  appointments: {
    SUPER_ADMIN: 'R:masked',
    INTERNAL_ADMIN: 'R:masked',
    CLINIC_OWNER: 'RWD',
    CLINIC_MANAGER: 'RWD',
    DOCTOR: 'RW:own',
    STAFF: 'RWD',
  },
  call_history: {
    SUPER_ADMIN: 'R:metadata',
    INTERNAL_ADMIN: 'R:metadata',
    CLINIC_OWNER: 'R',
    CLINIC_MANAGER: 'R',
    DOCTOR: 'R:own',
    STAFF: 'R',
  },
  recordings: {
    SUPER_ADMIN: '-',
    INTERNAL_ADMIN: '-',
    CLINIC_OWNER: 'R',
    CLINIC_MANAGER: 'R',
    DOCTOR: '-',
    STAFF: 'R:clinic_opt_in',
  },
  prescriptions: {
    SUPER_ADMIN: '-',
    INTERNAL_ADMIN: '-',
    CLINIC_OWNER: 'R',
    CLINIC_MANAGER: '-',
    DOCTOR: 'RW:own',
    STAFF: '-',
  },
  follow_ups: {
    SUPER_ADMIN: '-',
    INTERNAL_ADMIN: '-',
    CLINIC_OWNER: 'RWD',
    CLINIC_MANAGER: 'RWD',
    DOCTOR: 'RW',
    STAFF: 'RW:assigned',
  },
  reminder_settings: {
    SUPER_ADMIN: 'R',
    INTERNAL_ADMIN: 'R',
    CLINIC_OWNER: 'RW',
    CLINIC_MANAGER: 'RW',
    DOCTOR: '-',
    STAFF: 'R',
  },
  forwarding_schedules: {
    SUPER_ADMIN: 'R',
    INTERNAL_ADMIN: 'R',
    CLINIC_OWNER: 'RW',
    CLINIC_MANAGER: 'RW',
    DOCTOR: '-',
    STAFF: '-',
  },
  analytics: {
    SUPER_ADMIN: 'R:usage',
    INTERNAL_ADMIN: 'R:usage',
    CLINIC_OWNER: 'R',
    CLINIC_MANAGER: 'R',
    DOCTOR: 'R:own',
    STAFF: '-',
  },
  audit_log: {
    SUPER_ADMIN: 'R',
    INTERNAL_ADMIN: 'R:audit_scope',
    CLINIC_OWNER: 'R',
    CLINIC_MANAGER: '-',
    DOCTOR: '-',
    STAFF: '-',
  },
  integration_errors: {
    SUPER_ADMIN: 'R',
    INTERNAL_ADMIN: 'R',
    CLINIC_OWNER: '-',
    CLINIC_MANAGER: '-',
    DOCTOR: '-',
    STAFF: '-',
  },
};

const parseCell = (cell: string): Grant => {
  if (cell === '-') {
    return { read: false, write: false, delete: false };
  }

  const [letters, scopeName] = cell.split(':');
  const scope = (scopeName ?? 'all') as Scope;

  return {
    read: letters?.includes('R') === true ? scope : false,
    write: letters?.includes('W') === true ? scope : false,
    delete: letters?.includes('D') === true ? scope : false,
  };
};

const cells = RESOURCES.flatMap((resource) =>
  ROLES.map((role) => ({ resource, role, expected: parseCell(EXPECTED[resource][role]) })),
);

describe('the matrix matches the agreed table', () => {
  it('covers every resource and role with no gaps', () => {
    expect(cells).toHaveLength(RESOURCES.length * ROLES.length);
    for (const resource of RESOURCES) {
      for (const role of ROLES) {
        expect(EXPECTED[resource][role]).toBeTypeOf('string');
      }
    }
  });

  it.each(cells)('$role on $resource', ({ resource, role, expected }) => {
    // Changing one cell in PERMISSIONS fails exactly this test.
    expect(PERMISSIONS[resource][role]).toEqual(expected);
  });
});

describe('the accessors read the matrix correctly', () => {
  /**
   * A focused set rather than one test per action per cell. Generating those too meant a
   * single changed cell failed two generated tests instead of one, which blurs exactly
   * the signal the per-cell test above exists to give. What still needs proving here is
   * that the accessor functions read the matrix, which a handful of cases covers: the
   * data itself is already pinned above.
   */
  it('returns the scope, not merely true, so "own" cannot be mistaken for "all"', () => {
    expect(permissionScope('DOCTOR', 'appointments', 'read')).toBe('own');
    expect(permissionScope('CLINIC_OWNER', 'appointments', 'read')).toBe('all');
    expect(permissionScope('SUPER_ADMIN', 'patients', 'read')).toBe('masked');
    expect(permissionScope('STAFF', 'recordings', 'read')).toBe('clinic_opt_in');
    expect(permissionScope('INTERNAL_ADMIN', 'audit_log', 'read')).toBe('audit_scope');
    expect(permissionScope('SUPER_ADMIN', 'analytics', 'read')).toBe('usage');
    expect(permissionScope('SUPER_ADMIN', 'call_history', 'read')).toBe('metadata');
    expect(permissionScope('STAFF', 'follow_ups', 'write')).toBe('assigned');
  });

  it('returns false for a denied action', () => {
    expect(permissionScope('DOCTOR', 'recordings', 'read')).toBe(false);
    expect(permissionScope('STAFF', 'prescriptions', 'read')).toBe(false);
    expect(permissionScope('CLINIC_MANAGER', 'platform_users', 'read')).toBe(false);
  });

  it('isPermitted is truthiness over the same scope', () => {
    expect(isPermitted('DOCTOR', 'appointments', 'read')).toBe(true);
    expect(isPermitted('DOCTOR', 'appointments', 'delete')).toBe(false);
    expect(isPermitted('SUPER_ADMIN', 'recordings', 'read')).toBe(false);
  });
});

describe('invariants that must hold whatever the table says', () => {
  it('never lets a platform role read a recording', () => {
    // The rawest PHI the platform holds. A support session unmasks patient fields; it
    // does not grant recordings.
    for (const role of ['SUPER_ADMIN', 'INTERNAL_ADMIN'] as const) {
      expect(permissionScope(role, 'recordings', 'read')).toBe(false);
      expect(permissionScope(role, 'recordings', 'write')).toBe(false);
    }
  });

  it('never lets a platform role read a prescription', () => {
    for (const role of ['SUPER_ADMIN', 'INTERNAL_ADMIN'] as const) {
      expect(permissionScope(role, 'prescriptions', 'read')).toBe(false);
    }
  });

  it('only ever gives a platform role MASKED access to patient data', () => {
    for (const role of ['SUPER_ADMIN', 'INTERNAL_ADMIN'] as const) {
      for (const resource of ['patients', 'appointments'] as const) {
        expect(permissionScope(role, resource, 'read')).toBe('masked');
        // Read-only: a platform role must never alter clinical data.
        expect(permissionScope(role, resource, 'write')).toBe(false);
        expect(permissionScope(role, resource, 'delete')).toBe(false);
      }
    }
  });

  it('grants no action without also granting read', () => {
    // Writing or deleting what you cannot read is never intended, and would make the
    // scope of the write impossible to reason about.
    for (const { resource, role } of cells) {
      const grant = PERMISSIONS[resource][role];
      if (grant.write !== false || grant.delete !== false) {
        expect(grant.read).not.toBe(false);
      }
    }
  });

  it('keeps every scope inside one cell consistent', () => {
    for (const { resource, role } of cells) {
      const grant = PERMISSIONS[resource][role];
      const scopes = [grant.read, grant.write, grant.delete].filter((s) => s !== false);
      // A cell that read "own" for reads but "all" for writes would be a trap.
      expect(new Set(scopes).size).toBeLessThanOrEqual(1);
    }
  });

  it('identifies exactly the two platform roles', () => {
    expect(ROLES.filter((role) => isPlatformRole(role))).toEqual(['SUPER_ADMIN', 'INTERNAL_ADMIN']);
  });

  /**
   * Default deny has to hold for roles as it does for resources and actions.
   *
   * An unknown role used to throw `TypeError: Cannot read properties of undefined`,
   * which means a Role added to the database enum without a matrix row would have been a
   * 500 on every request by that role rather than a clean 403. Review finding I13.
   */
  it('denies a role the matrix does not list, rather than throwing', () => {
    for (const resource of RESOURCES) {
      for (const action of ACTIONS) {
        expect(permissionScope('ADMIN' as Role, resource, action)).toBe(false);
      }
    }
  });

  it('recognises exactly the six roles and nothing else', () => {
    for (const role of ROLES) {
      expect(isRole(role)).toBe(true);
    }
    for (const value of ['ADMIN', 'clinic_owner', '', 'Role', 42, null, undefined, {}]) {
      expect(isRole(value)).toBe(false);
    }
  });
});
