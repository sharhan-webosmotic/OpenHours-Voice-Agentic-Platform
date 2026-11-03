import { describe, expect, it } from 'vitest';
import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWith, stubClient, user } from '../test-support/harness';
import { baseRoutes } from '../test-support/fixtures';
import { AppRoutes } from './routes';

/**
 * The shell, against the reference the clinic signed off: a six-item sidebar, a header with
 * a search box, today's date, a New Appointment button and the signed-in person.
 *
 * What is asserted is what would quietly decay: the menu growing back to nine, a page
 * vanishing because it left the menu, and a search box that looks live without being so.
 */

const signedIn = () =>
  stubClient({ user: user('CLINIC_OWNER'), bootSucceeds: true, routes: baseRoutes });

describe('the sidebar', () => {
  it('has exactly the six items the reference has, in its order', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/patients']);

    const menu = await screen.findByRole('navigation', { name: 'Main' });
    const labels = within(menu)
      .getAllByRole('link')
      .map((link) => link.textContent);

    expect(labels).toEqual([
      'Overview',
      'Appointments',
      'Patients',
      'Services',
      'Call History',
      'Clinic Settings',
    ]);
  });

  it('still reaches Doctors & Staff by its address, because doctors are managed there', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/staff']);

    /**
     * Out of the menu, not out of the product. Deleting the route to match the reference
     * would delete the only screen a doctor is managed on.
     */
    expect(await screen.findByRole('heading', { name: 'Doctors & Staff' })).toBeInTheDocument();
  });
});

describe('the header', () => {
  it('has a search box that looks as drawn and says it is not available', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/patients']);

    const search = await screen.findByLabelText('Search patients, appointments or calls');

    expect(search).toBeDisabled();
    expect(search).toHaveAttribute('placeholder', 'Search patients, appointments or calls…');
    // The sentence a screen reader hears, since the ⌘K chip is decoration.
    expect(search).toHaveAccessibleDescription('Not available yet.');
  });

  it('is not the patient search, which is on the page and works', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/patients']);

    expect(await screen.findByLabelText('Search patients')).toBeEnabled();
  });

  it('opens the booking form from New Appointment', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/patients']);

    const link = await screen.findByRole('link', { name: 'New Appointment' });

    // The appointments screen opens its form from `?book=1`, which is how a profile's
    // "Create appointment" already reaches it.
    expect(link).toHaveAttribute('href', '/appointments?book=1');
  });

  it('keeps sign-out in the account menu behind the name', async () => {
    renderWith(<AppRoutes />, signedIn(), ['/patients']);

    expect(screen.queryByRole('button', { name: 'Sign out' })).not.toBeInTheDocument();

    await userEvent.click(await screen.findByRole('button', { name: 'Account menu' }));

    expect(await screen.findByRole('button', { name: 'Sign out' })).toBeInTheDocument();
  });
});
