import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { isPermitted, ROLES, type Role } from '@openhours/shared';
import { renderWith, stubClient, user } from '../test-support/harness';
import { CLINIC_NAV, landingPath } from './navigation';
import { AppRoutes } from './routes';

/**
 * Who reaches which page, driven from the permission matrix.
 *
 * THIS IS THE "GRANTED REACHES IT, DENIED DOES NOT" REQUIREMENT, at the interface level.
 * The sign-in feature adds no route that declares a matrix permission, so the API's
 * registry-walking guard has nothing new to check; this and `navigation.test.ts` are what
 * satisfy it instead. Every case is derived from `isPermitted` rather than listed, so a
 * permission change moves the test with the product instead of leaving a stale expectation
 * somebody will "fix" by copying whatever the code now does.
 *
 * NONE OF IT IS A SECURITY TEST. The API refuses the data regardless; what is under test is
 * whether the product explains itself or shows a broken screen.
 */

const signedIn = (role: Role) => stubClient({ user: user(role), bootSucceeds: true });

describe('the landing route', () => {
  it.each(ROLES)('puts %s on a page their role can actually read', async (role) => {
    renderWith(<AppRoutes />, signedIn(role), ['/']);

    const expected = landingPath(CLINIC_NAV, role);
    const item = CLINIC_NAV.find((candidate) => candidate.path === expected);

    if (item === undefined) {
      expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument();
      return;
    }

    expect(await screen.findByRole('heading', { name: item.label })).toBeInTheDocument();
  });

  it('does not land STAFF on the overview, which analytics denies them', async () => {
    renderWith(<AppRoutes />, signedIn('STAFF'), ['/']);

    // The concrete consequence of computing the landing route. A constant /overview here
    // would show every staff member the no-access page at every sign-in.
    expect(await screen.findByRole('heading', { name: 'Appointments' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Overview' })).not.toBeInTheDocument();
  });
});

describe('every page, for every role', () => {
  const cases = ROLES.flatMap((role) => CLINIC_NAV.map((item) => ({ role, item })));

  it.each(cases)('$role at $item.path', async ({ role, item }) => {
    renderWith(<AppRoutes />, signedIn(role), [item.path]);

    if (isPermitted(role, item.resource, item.action)) {
      expect(await screen.findByRole('heading', { name: item.label })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'No access' })).not.toBeInTheDocument();
      return;
    }

    // Typing the path of a hidden page is not stopped: it is explained. A silent bounce
    // reads as a bug and hides the situation from the one person who can resolve it.
    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: item.label })).not.toBeInTheDocument();
  });
});

describe('the sidebar', () => {
  it('shows a DOCTOR no link to the settings they may not read', async () => {
    renderWith(<AppRoutes />, signedIn('DOCTOR'), ['/']);
    await screen.findByRole('navigation', { name: 'Main' });

    const links = screen.getAllByRole('link').map((link) => link.textContent);

    expect(links).not.toContain('Clinic Settings');
    expect(links).not.toContain('Reminders');
    expect(links).toContain('Appointments');
  });

  it('names the role, so a user can see which account they are in', async () => {
    renderWith(<AppRoutes />, signedIn('CLINIC_MANAGER'), ['/']);

    expect(await screen.findByText('Clinic manager')).toBeInTheDocument();
  });
});

describe('a session that is still being restored', () => {
  it('shows neither the dashboard nor the sign-in form', () => {
    // The boot refresh has not answered yet. On a cold load there is no access token,
    // because it only ever lived in memory, but the cookie may still be good: showing
    // sign-in here would flash it at everyone who reloads the page and then navigate away.
    renderWith(<AppRoutes />, signedIn('CLINIC_OWNER'), ['/overview']);

    expect(screen.getByRole('status', { name: 'Restoring your session' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Sign in' })).not.toBeInTheDocument();
  });
});

describe('a user holding a temporary password', () => {
  it('is redirected off every page in the shell', async () => {
    const stub = stubClient({ user: user('CLINIC_OWNER', true), bootSucceeds: true });
    renderWith(<AppRoutes />, stub, ['/patients']);

    expect(
      await screen.findByRole('heading', { name: 'Choose a new password' }),
    ).toBeInTheDocument();
  });
});

describe('an unknown path', () => {
  it('goes to the landing route rather than a blank screen', async () => {
    renderWith(<AppRoutes />, signedIn('CLINIC_OWNER'), ['/not-a-page']);

    expect(await screen.findByRole('heading', { name: 'Overview' })).toBeInTheDocument();
  });
});

describe('signing out', () => {
  it('returns to the form without claiming the session expired', async () => {
    const stub = signedIn('CLINIC_OWNER');
    renderWith(<AppRoutes />, stub, ['/']);

    const button = await screen.findByRole('button', { name: 'Sign out' });
    button.click();

    expect(await screen.findByRole('button', { name: 'Sign in' })).toBeInTheDocument();
    expect(stub.calls.logout).toBe(1);
    // Deliberate, so no expiry note. That note is only for a session that ended on its own.
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });
});
