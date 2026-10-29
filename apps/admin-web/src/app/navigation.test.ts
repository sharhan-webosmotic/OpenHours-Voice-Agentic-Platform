import { describe, expect, it } from 'vitest';
import { PERMISSIONS, PLATFORM_ROLES, ROLES, isPermitted, isPlatformRole } from '@openhours/shared';
import { ADMIN_NAV, landingPath, permits, visibleNavigation } from './navigation';

/**
 * The admin menu against the permission matrix, for all six roles.
 *
 * Expectations are DERIVED from `PERMISSIONS`, never transcribed. A test that hardcoded
 * "an internal admin sees three items" would need editing whenever a permission changed,
 * and the natural way to make it pass again is to copy whatever the code now does, which is
 * how a test stops testing anything.
 */

describe('every item is governed by a real matrix cell', () => {
  it.each(ADMIN_NAV)('$label reads $resource:$action', (item) => {
    // A typo in a resource name would make an item invisible to everyone, which looks like
    // a permission decision rather than a mistake.
    expect(PERMISSIONS[item.resource]).toBeDefined();
  });
});

describe('visibleNavigation agrees with the matrix, for platform roles', () => {
  it.each(PLATFORM_ROLES)('%s sees exactly the items it is permitted', (role) => {
    const visible = visibleNavigation(ADMIN_NAV, role);

    for (const item of ADMIN_NAV) {
      const permitted = isPermitted(role, item.resource, item.action);
      expect(
        visible.includes(item),
        `${role} ${permitted ? 'should' : 'should not'} see ${item.label}`,
      ).toBe(permitted);
    }
  });

  it.each(ROLES.filter((role) => !isPlatformRole(role)))('%s sees nothing at all', (role) => {
    /**
     * The case that found the bug. `organisations:read` and `phone_voice_mapping:read` are
     * granted to CLINIC_OWNER, so filtering on the matrix cell alone put "Clinics" and
     * "Settings" in a clinic owner's sidebar. Those cells mean "my own organisation", which
     * tenant isolation enforces, not "the platform's list of clinics". This console is
     * platform-only, so the role is checked as well as the cell.
     */
    expect(visibleNavigation(ADMIN_NAV, role)).toHaveLength(0);
  });
});

describe('the denials that shape this console', () => {
  it('hides Internal users from an INTERNAL_ADMIN, because platform_users is SUPER_ADMIN only', () => {
    const internal = visibleNavigation(ADMIN_NAV, 'INTERNAL_ADMIN').map((item) => item.label);
    const superAdmin = visibleNavigation(ADMIN_NAV, 'SUPER_ADMIN').map((item) => item.label);

    // Three of four. The difference is the matrix being honoured, not an omission here.
    expect(internal).not.toContain('Internal users');
    expect(superAdmin).toContain('Internal users');
  });

  it('shows a clinic owner nothing, despite holding two of the four cells', () => {
    // CLINIC_OWNER really does hold organisations:read and phone_voice_mapping:read. The
    // console is still empty for them, because those grants are about their own clinic.
    expect(isPermitted('CLINIC_OWNER', 'organisations', 'read')).toBe(true);
    // And the console's own predicate says no, which is what the route guard asks too.
    expect(permits('CLINIC_OWNER', 'organisations', 'read')).toBe(false);
    expect(visibleNavigation(ADMIN_NAV, 'CLINIC_OWNER')).toHaveLength(0);
  });
});

describe('landingPath', () => {
  it.each(ROLES)('sends %s to a page it may read, or nowhere', (role) => {
    const path = landingPath(ADMIN_NAV, role);

    if (path === undefined) {
      expect(visibleNavigation(ADMIN_NAV, role)).toHaveLength(0);
      return;
    }

    const item = ADMIN_NAV.find((candidate) => candidate.path === path);
    expect(item).toBeDefined();
    expect(isPermitted(role, item!.resource, item!.action)).toBe(true);
  });

  it('returns nothing for every clinic role, which is a case that really happens', () => {
    // Unlike the dashboard, where no current role is shut out, this branch is reached by
    // four of the six roles. It is why the no-access page exists rather than a redirect.
    expect(landingPath(ADMIN_NAV, 'CLINIC_MANAGER')).toBeUndefined();
    expect(landingPath(ADMIN_NAV, 'CLINIC_OWNER')).toBeUndefined();
    expect(landingPath(ADMIN_NAV, 'STAFF')).toBeUndefined();
    expect(landingPath(ADMIN_NAV, 'SUPER_ADMIN')).toBe('/clinics');
    expect(landingPath(ADMIN_NAV, 'INTERNAL_ADMIN')).toBe('/clinics');
  });
});
