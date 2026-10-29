import { describe, expect, it } from 'vitest';
import { PERMISSIONS, ROLES, isPermitted, type Role } from '@openhours/shared';
import { ADMIN_NAV, CLINIC_NAV, landingPath, visibleNavigation } from './navigation';

/**
 * The menu against the permission matrix, for all six roles.
 *
 * WHY THIS SUITE CARRIES WEIGHT. The sign-in feature exposes no matrix permission of its
 * own: no route it adds declares one, so the registry-walking guard in the API
 * (`declared-permissions-are-enforced.test.ts`) has nothing new to assert. The requirement
 * that a granted role reaches a thing and a denied role does not is satisfied here instead,
 * by driving the real `PERMISSIONS` table rather than a fixture of it. It is stated in
 * docs/features/sign-in.md so a later reader does not think the requirement was skipped.
 *
 * Every expectation is DERIVED from the matrix, never transcribed from it. A test that
 * hardcoded "STAFF sees six items" would have to be edited whenever a permission changed,
 * and the natural way to make it pass again is to copy whatever the code now does, which
 * is how a test stops testing anything.
 */

const label = (role: Role) => role;

describe('every item is governed by a real matrix cell', () => {
  it.each([...CLINIC_NAV, ...ADMIN_NAV])('$label reads $resource:$action', (item) => {
    // A typo in a resource name would otherwise make an item invisible to everyone, which
    // looks like a permission decision rather than a mistake.
    expect(PERMISSIONS[item.resource]).toBeDefined();
  });
});

describe('visibleNavigation agrees with the matrix for every role', () => {
  it.each(ROLES)('%s sees exactly the clinic items it is permitted', (role) => {
    const visible = visibleNavigation(CLINIC_NAV, role);

    for (const item of CLINIC_NAV) {
      const permitted = isPermitted(role, item.resource, item.action);
      expect(
        visible.includes(item),
        `${label(role)} ${permitted ? 'should' : 'should not'} see ${item.label}`,
      ).toBe(permitted);
    }
  });

  it.each(ROLES)('%s sees exactly the admin items it is permitted', (role) => {
    const visible = visibleNavigation(ADMIN_NAV, role);

    for (const item of ADMIN_NAV) {
      expect(visible.includes(item)).toBe(isPermitted(role, item.resource, item.action));
    }
  });

  it('keeps the declared order rather than the matrix order', () => {
    const visible = visibleNavigation(CLINIC_NAV, 'CLINIC_OWNER');
    // Compared by path rather than by identity: `visibleNavigation` returns the widened
    // `NavItem`, and `indexOf` on the `as const` array wants the literal member type.
    const positions = visible.map((item) =>
      CLINIC_NAV.findIndex((candidate) => candidate.path === item.path),
    );

    // The sidebar order is a design decision from the prototype. Filtering must not
    // reorder it.
    expect(positions).toEqual([...positions].sort((a, b) => a - b));
  });
});

describe('the specific denials that shape the product', () => {
  it('hides Overview and Reports from STAFF, because analytics is denied', () => {
    const visible = visibleNavigation(CLINIC_NAV, 'STAFF').map((item) => item.label);

    /**
     * The case that forced the landing route to be computed. `analytics` is `none` for
     * STAFF, and both Overview and Reports read it, so a staff member has neither. A
     * hardcoded redirect to /overview would have put every staff member on the no-access
     * page at every sign-in.
     */
    expect(visible).not.toContain('Overview');
    expect(visible).not.toContain('Reports');
    expect(visible).toContain('Appointments');
  });

  it('hides Clinic Settings from a DOCTOR but not from a CLINIC_MANAGER', () => {
    expect(visibleNavigation(CLINIC_NAV, 'DOCTOR').map((item) => item.label)).not.toContain(
      'Clinic Settings',
    );
    expect(visibleNavigation(CLINIC_NAV, 'CLINIC_MANAGER').map((item) => item.label)).toContain(
      'Clinic Settings',
    );
  });

  it('hides Internal users from an INTERNAL_ADMIN, because platform_users is SUPER_ADMIN only', () => {
    const admin = visibleNavigation(ADMIN_NAV, 'INTERNAL_ADMIN').map((item) => item.label);
    const superAdmin = visibleNavigation(ADMIN_NAV, 'SUPER_ADMIN').map((item) => item.label);

    // Three of four, and the difference is the matrix being honoured rather than an
    // omission in the admin console.
    expect(admin).not.toContain('Internal users');
    expect(superAdmin).toContain('Internal users');
  });
});

describe('landingPath', () => {
  it.each(ROLES)('sends %s to a page it may actually read, or nowhere', (role) => {
    const path = landingPath(CLINIC_NAV, role);

    if (path === undefined) {
      // Nowhere is a legitimate answer: it means the role reaches nothing here, and the
      // router shows the explanation instead of an empty shell.
      expect(visibleNavigation(CLINIC_NAV, role)).toHaveLength(0);
      return;
    }

    const item = CLINIC_NAV.find((candidate) => candidate.path === path);
    expect(item).toBeDefined();
    expect(isPermitted(role, item!.resource, item!.action)).toBe(true);
  });

  it('does not send STAFF to the overview they cannot read', () => {
    expect(landingPath(CLINIC_NAV, 'STAFF')).not.toBe('/overview');
    expect(landingPath(CLINIC_NAV, 'CLINIC_OWNER')).toBe('/overview');
  });

  /**
   * I expected a platform role to reach nothing in the clinic dashboard. It is not so, and
   * the matrix is right: SUPER_ADMIN and INTERNAL_ADMIN hold deliberate reads on clinic
   * resources, `masked` on patients and appointments and `usage` on analytics, because
   * that is how platform support sees that a clinic is working without seeing who its
   * patients are. So the menu does not keep them out of the clinic dashboard.
   *
   * What keeps them out is the audience refusal at login, which is why that exists. The
   * `undefined` branch of `landingPath` is therefore unreachable for the six roles as the
   * matrix stands today, and it is kept because a future role with no clinic grants would
   * otherwise land on a redirect loop rather than an explanation.
   */
  it('does reach the clinic dashboard for a platform role, by design', () => {
    expect(landingPath(CLINIC_NAV, 'SUPER_ADMIN')).toBe('/overview');
    expect(landingPath(CLINIC_NAV, 'INTERNAL_ADMIN')).toBe('/overview');
  });

  it('returns nothing when a role reaches none of the items', () => {
    // Driven with a nav of one item nobody but SUPER_ADMIN may read, because no current
    // role is shut out of the real clinic nav. This covers the branch the comment above
    // says is unreachable for now.
    const platformOnly = CLINIC_NAV.filter((item) => item.resource === 'clinic_settings');

    expect(landingPath(platformOnly, 'DOCTOR')).toBeUndefined();
    expect(landingPath(platformOnly, 'CLINIC_OWNER')).toBe('/settings');
  });
});
