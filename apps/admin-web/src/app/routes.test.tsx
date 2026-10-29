import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ROLES, type Role } from '@openhours/shared';
import { FORBIDDEN_TYPE } from '@openhours/api-client';
import { problem, renderWith, stubClient, user } from '../test-support/harness';
import { ADMIN_NAV, landingPath, permits } from './navigation';
import { AppRoutes } from './routes';

/**
 * Who reaches which page in the admin console, driven from `permits`, which is the same
 * predicate the sidebar and `useCan` use. Driving the route test from `isPermitted` instead
 * is what hid the inconsistency this file now guards: a clinic owner saw no "Clinics" link
 * and still reached the page by typing the path, and the test passed because it asked the
 * weaker question.
 *
 * The clinic-role cases are the interesting ones here. In the dashboard no current role is
 * shut out entirely; in this console all four are, so the no-access path is exercised by
 * the product's real shape rather than by a contrived fixture.
 */

const signedIn = (role: Role) => stubClient({ user: user(role), bootSucceeds: true });

describe('the landing route', () => {
  it.each(ROLES)('puts %s on a page their role can read, or explains', async (role) => {
    renderWith(<AppRoutes />, signedIn(role), ['/']);

    const expected = landingPath(ADMIN_NAV, role);
    const item = ADMIN_NAV.find((candidate) => candidate.path === expected);

    if (item === undefined) {
      expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument();
      // Named plainly, and pointing at the other application rather than leaving them stuck.
      expect(screen.getByText(/clinic dashboard instead/)).toBeInTheDocument();
      return;
    }

    expect(await screen.findByRole('heading', { name: item.label })).toBeInTheDocument();
  });
});

describe('every page, for every role', () => {
  const cases = ROLES.flatMap((role) => ADMIN_NAV.map((item) => ({ role, item })));

  it.each(cases)('$role at $item.path', async ({ role, item }) => {
    renderWith(<AppRoutes />, signedIn(role), [item.path]);

    if (permits(role, item.resource, item.action)) {
      expect(await screen.findByRole('heading', { name: item.label })).toBeInTheDocument();
      expect(screen.queryByRole('heading', { name: 'No access' })).not.toBeInTheDocument();
      return;
    }

    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: item.label })).not.toBeInTheDocument();
  });
});

describe('the shell', () => {
  it('marks itself as the admin console so the two are not confused', async () => {
    renderWith(<AppRoutes />, signedIn('SUPER_ADMIN'), ['/']);

    // The accent differs too, but a colour is not something a user can be told. The word is.
    expect(await screen.findByText('Admin')).toBeInTheDocument();
  });

  it('shows an INTERNAL_ADMIN no link to internal users', async () => {
    renderWith(<AppRoutes />, signedIn('INTERNAL_ADMIN'), ['/']);
    await screen.findByRole('navigation', { name: 'Main' });

    const links = screen.getAllByRole('link').map((link) => link.textContent);

    expect(links).not.toContain('Internal users');
    expect(links).toContain('Clinics');
    expect(links).toContain('Monitoring');
  });
});

describe('a clinic account at the console sign-in', () => {
  it('is told to use the dashboard rather than signed in', async () => {
    const stub = stubClient({
      loginError: problem(
        403,
        FORBIDDEN_TYPE,
        'This account is for the OpenHours clinic dashboard. Please sign in there instead.',
      ),
    });
    renderWith(<AppRoutes />, stub, ['/sign-in']);

    const typist = userEvent.setup();
    await typist.type(await screen.findByLabelText('Email address'), 'owner@clinic.example');
    await typist.type(screen.getByLabelText('Password'), 'password');
    await typist.click(screen.getByRole('button', { name: 'Sign in' }));

    /**
     * Refused by the API before a token is issued, which is the point of the audience
     * field: checking in the front end alone would leave a valid refresh cookie set for a
     * session this application then rejects. ADR-0001 records that this is user experience
     * and defence in depth, not the boundary; the matrix is the boundary.
     */
    expect(await screen.findByRole('alert')).toHaveTextContent('clinic dashboard');
  });
});

describe('the sign-in screen', () => {
  it('names this application, so a user knows which one they are at', async () => {
    renderWith(<AppRoutes />, stubClient(), ['/sign-in']);

    expect(await screen.findByText('OpenHours admin console')).toBeInTheDocument();
  });
});
