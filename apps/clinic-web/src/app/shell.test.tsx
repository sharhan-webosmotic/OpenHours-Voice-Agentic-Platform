import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWith, stubClient, user } from '../test-support/harness';
import { baseRoutes } from '../test-support/fixtures';
import { AppRoutes } from './routes';

/**
 * The shell's chrome: the two controls the prototype has and the platform cannot yet serve.
 *
 * Both are rendered as captured and neither pretends to work. The tests exist because
 * "disabled with a note" is a decision, and the two ways it decays are a control quietly
 * removed, which leaves the product looking unlike the prototype, and a control quietly
 * wired to something narrower than it claims, which misleads a receptionist.
 */

const signedIn = () =>
  stubClient({ user: user('CLINIC_OWNER'), bootSucceeds: true, routes: baseRoutes });

describe('the global search box', () => {
  it('is rendered, labelled and disabled, with a visible "soon"', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/patients']);

    const search = await screen.findByLabelText('Search patients, appointments or calls');

    expect(search).toBeDisabled();
    expect(search).toHaveAttribute('aria-disabled', 'true');
    // The capture's placeholder, kept word for word, because the chrome is meant to match.
    expect(search).toHaveAttribute('placeholder', 'Search patients, appointments or calls…');
    expect(screen.getByText('Soon')).toBeInTheDocument();
  });

  it('is not the patient search, which is on the page and works', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/patients']);

    // Two search boxes: the global one, disabled, and the patient list's, which reaches the
    // server. Confusing them is the thing this asserts against.
    const working = await screen.findByLabelText('Search patients');

    expect(working).toBeEnabled();
  });
});

describe('the notifications popover', () => {
  it('opens as a labelled dialog and says there is nothing behind it yet', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/patients']);

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));

    const popover = await screen.findByRole('dialog', { name: 'Notifications' });

    expect(within(popover).getByText(/not available yet/)).toBeInTheDocument();
    expect(within(popover).getByText('Soon')).toBeInTheDocument();
  });

  it('carries no unread marker, because there is nothing to be unread', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/patients']);

    const bell = await screen.findByRole('button', { name: 'Notifications' });

    /**
     * The capture has a red dot on the bell. A red dot over nothing is the most misleading
     * element in the whole prototype, so it is the one piece of that chrome left out.
     */
    expect(bell.textContent).toBe('');
    expect(bell.querySelectorAll('span')).toHaveLength(0);
  });

  it('closes when the page behind it is clicked', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/patients']);

    await userEvent.click(await screen.findByRole('button', { name: 'Notifications' }));
    await screen.findByRole('dialog', { name: 'Notifications' });

    await userEvent.click(screen.getByRole('button', { name: 'Close notifications' }));

    expect(screen.queryByRole('dialog', { name: 'Notifications' })).not.toBeInTheDocument();
  });
});
