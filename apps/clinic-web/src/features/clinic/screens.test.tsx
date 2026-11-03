import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWith, stubClient, user } from '../../test-support/harness';
import { baseRoutes, clinic, ORGANISATION_ID, SERVICE_ID } from '../../test-support/fixtures';
import { ServicesPage } from '../services/ServicesPage';
import { StaffPage } from '../staff/StaffPage';
import { SettingsPage } from '../settings/SettingsPage';
import { OverviewPage } from '../overview/OverviewPage';
import { RemindersPage, ReportsPage } from '../placeholders/pages';

/**
 * The screens that read and write the clinic's own configuration, plus the three that have no
 * endpoint at all.
 *
 * The last group is the one worth having tests for. An honest empty state is a decision, and a
 * decision with no test is a decision somebody replaces with a chart.
 */

const signedIn = (routes = baseRoutes, role: 'CLINIC_OWNER' | 'STAFF' = 'CLINIC_OWNER') =>
  stubClient({ user: user(role), bootSucceeds: true, routes });

describe('services', () => {
  it('lists a service with its duration and price in rupees', async () => {
    renderWith(<ServicesPage />, signedIn());

    expect(await screen.findByText('Consultation')).toBeInTheDocument();
    expect(screen.getByText('30 min')).toBeInTheDocument();
    // 50000 paise is ₹500, divided at this edge and nowhere deeper.
    expect(screen.getByText('₹500')).toBeInTheDocument();
  });

  it('shows an inactive service as inactive rather than hiding it', async () => {
    renderWith(<ServicesPage />, signedIn());

    // Hiding it would leave a clinic unable to bring a service back.
    expect(await screen.findByText('Retired Service')).toBeInTheDocument();
    expect(screen.getByText('Inactive')).toBeInTheDocument();
  });

  it('converts rupees to paise when saving', async () => {
    const stub = signedIn({
      ...baseRoutes,
      [`POST /api/v1/organisations/${ORGANISATION_ID}/services`]: {
        status: 201,
        body: { serviceId: SERVICE_ID },
      },
    });

    renderWith(<ServicesPage />, stub);
    await userEvent.click(await screen.findByRole('button', { name: /Add Service/ }));

    await userEvent.type(screen.getByLabelText('Service name'), 'Dressing');
    await userEvent.clear(screen.getByLabelText('Price in rupees'));
    await userEvent.type(screen.getByLabelText('Price in rupees'), '250');
    await userEvent.click(screen.getByRole('button', { name: 'Save service' }));

    await waitFor(() => {
      const sent = stub.calls.requests.find((request) => request.method === 'POST');
      expect(sent?.body).toMatchObject({ name: 'Dressing', priceMinor: 25000 });
    });
  });

  it('sends an empty price as null, which is not the same as free', async () => {
    const stub = signedIn({
      ...baseRoutes,
      [`POST /api/v1/organisations/${ORGANISATION_ID}/services`]: {
        status: 201,
        body: { serviceId: SERVICE_ID },
      },
    });

    renderWith(<ServicesPage />, stub);
    await userEvent.click(await screen.findByRole('button', { name: /Add Service/ }));

    await userEvent.type(screen.getByLabelText('Service name'), 'Dressing');
    await userEvent.clear(screen.getByLabelText('Price in rupees'));
    await userEvent.click(screen.getByRole('button', { name: 'Save service' }));

    await waitFor(() => {
      const sent = stub.calls.requests.find((request) => request.method === 'POST');
      expect(sent?.body).toMatchObject({ priceMinor: null });
    });
  });

  it('deactivates rather than deletes', async () => {
    const stub = signedIn({
      ...baseRoutes,
      [`PATCH /api/v1/organisations/${ORGANISATION_ID}/services/${SERVICE_ID}`]: { status: 204 },
    });

    renderWith(<ServicesPage />, stub);
    await userEvent.click(await screen.findByRole('button', { name: 'Deactivate' }));

    await waitFor(() => {
      const sent = stub.calls.requests.find((request) => request.method === 'PATCH');
      // A service with appointments against it cannot be removed without taking the history
      // with it, so the API has no delete and this sends `active: false`.
      expect(sent?.body).toEqual({ active: false });
    });
  });

  it('says what to do when a clinic has no services', async () => {
    renderWith(
      <ServicesPage />,
      signedIn({
        ...baseRoutes,
        [`GET /api/v1/organisations/${ORGANISATION_ID}`]: { body: { ...clinic, services: [] } },
      }),
    );

    expect(await screen.findByText('No services yet')).toBeInTheDocument();
    // Nothing can be booked without one, which the body says rather than implying.
    expect(screen.getByText(/nothing can be booked until one exists/)).toBeInTheDocument();
  });
});

describe('doctors and staff', () => {
  it('shows the doctor and says the clinic is configured for one', async () => {
    renderWith(<StaffPage />, signedIn());

    expect(await screen.findByText('Dr Test Doctor')).toBeInTheDocument();
    expect(screen.getByText(/configured for one doctor/)).toBeInTheDocument();
  });

  it('seeds the hours editor from the clinic and saves all seven weekdays', async () => {
    const stub = signedIn({
      ...baseRoutes,
      [`PUT /api/v1/organisations/${ORGANISATION_ID}/hours`]: { status: 204 },
    });

    renderWith(<StaffPage />, stub);

    // Monday to Friday 09:00 to 17:00 in the fixture.
    expect(await screen.findByLabelText('Day starts')).toHaveValue('09:00');
    expect(screen.getByLabelText('Day ends')).toHaveValue('17:00');
    expect(screen.getByRole('button', { name: 'Mon' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Sat' })).toHaveAttribute('aria-pressed', 'false');

    await userEvent.click(screen.getByRole('button', { name: 'Save opening hours' }));

    await waitFor(() => {
      const sent = stub.calls.requests.find((request) => request.method === 'PUT');
      const days = (sent?.body as { days: readonly { weekday: string; segments: unknown[] }[] })
        .days;

      /**
       * ALL SEVEN, including the closed ones. That is the API's contract: a weekly off is a
       * weekday with no segments, and sending only the open days would leave the server unable
       * to tell a closure from an omission.
       */
      expect(days).toHaveLength(7);
      expect(days.find((day) => day.weekday === 'SATURDAY')?.segments).toEqual([]);
      expect(days.find((day) => day.weekday === 'MONDAY')?.segments).toEqual([
        { opensAtMinute: 540, closesAtMinute: 1020 },
      ]);
    });
  });

  it('writes a break as two segments', async () => {
    const stub = signedIn({
      ...baseRoutes,
      [`PUT /api/v1/organisations/${ORGANISATION_ID}/hours`]: { status: 204 },
    });

    renderWith(<StaffPage />, stub);
    await screen.findByLabelText('Break starts');

    await userEvent.type(screen.getByLabelText('Break starts'), '13:00');
    await userEvent.type(screen.getByLabelText('Break ends'), '14:00');
    await userEvent.click(screen.getByRole('button', { name: 'Save opening hours' }));

    await waitFor(() => {
      const sent = stub.calls.requests.find((request) => request.method === 'PUT');
      const days = (sent?.body as { days: readonly { weekday: string; segments: unknown[] }[] })
        .days;

      // D-013: a break IS the gap between two opening segments. Nothing stores a break.
      expect(days.find((day) => day.weekday === 'MONDAY')?.segments).toEqual([
        { opensAtMinute: 540, closesAtMinute: 780 },
        { opensAtMinute: 840, closesAtMinute: 1020 },
      ]);
    });
  });

  it('says the staff list is unavailable rather than showing an empty one', async () => {
    renderWith(<StaffPage />, signedIn());

    expect(await screen.findByText('The staff list is not available yet')).toBeInTheDocument();
  });

  it('disables the editor for a role that may not write', async () => {
    renderWith(<StaffPage />, signedIn(baseRoutes, 'STAFF'));

    // STAFF reads `doctors_services_hours` and does not write it.
    expect(await screen.findByLabelText('Day starts')).toBeDisabled();
    expect(screen.queryByRole('button', { name: 'Save opening hours' })).not.toBeInTheDocument();
  });
});

describe('clinic settings', () => {
  it('shows the clinic name as read-only, because a clinic owner may not change it', async () => {
    renderWith(<SettingsPage />, signedIn());

    const name = await screen.findByLabelText('Clinic name');

    // The matrix gives a clinic owner `read` on organisations and not `write`. An editable
    // field here would be a door the server refuses to open.
    expect(name).toHaveValue('Test Clinic One');
    expect(name).toBeDisabled();
  });

  it('saves one section at a time, naming what was saved', async () => {
    const stub = signedIn({
      ...baseRoutes,
      [`PUT /api/v1/organisations/${ORGANISATION_ID}/booking-policy`]: { status: 204 },
    });

    renderWith(<SettingsPage />, stub);

    await userEvent.clear(await screen.findByLabelText('Minimum notice, in minutes'));
    await userEvent.type(screen.getByLabelText('Minimum notice, in minutes'), '120');
    await userEvent.click(screen.getByRole('button', { name: 'Save booking preferences' }));

    expect(await screen.findByText('Booking preferences saved.')).toBeInTheDocument();

    const sent = stub.calls.requests.filter((request) => request.method === 'PUT');
    // ONE request, for the section whose button was pressed. A single page-wide save would
    // have sent four and then had to explain a partial failure.
    expect(sent).toHaveLength(1);
    expect(sent[0]?.path).toContain('/booking-policy');
    expect(sent[0]?.body).toMatchObject({ minimumNoticeMinutes: 120 });
  });

  it('shows the opening hours read-only and points at the one editor', async () => {
    renderWith(<SettingsPage />, signedIn());

    // Five of them, one per open weekday, which is the point of listing the week.
    expect(await screen.findAllByText('09:00 to 17:00')).toHaveLength(5);
    expect(
      screen.getByRole('link', { name: 'Edit opening hours on Doctors and Staff' }),
    ).toBeInTheDocument();
  });

  it('warns when nobody has confirmed the opening hours', async () => {
    renderWith(
      <SettingsPage />,
      signedIn({
        ...baseRoutes,
        [`GET /api/v1/organisations/${ORGANISATION_ID}`]: {
          body: {
            ...clinic,
            organisation: { ...clinic.organisation, openingHoursCollectedAt: null },
          },
        },
      }),
    );

    /**
     * D-013's distinction, on screen: hours that exist are not the same as hours somebody
     * confirmed, and until they are confirmed the agent states none and no slot is offered.
     */
    expect(await screen.findByText(/Nobody has confirmed/)).toBeInTheDocument();
  });

  it('says there is no on/off switch for the agent', async () => {
    renderWith(<SettingsPage />, signedIn());

    expect(await screen.findByText(/no switch that turns the agent on or off/)).toBeInTheDocument();
  });
});

describe('the overview', () => {
  /**
   * The cards against the overview fixture, whose figures are chosen so each card has
   * something different to say: a rise, a figure from nothing, and a fall.
   */
  it('shows the clinic’s own figures on the four cards', async () => {
    renderWith(<OverviewPage />, signedIn());

    // The cards draw before the figures arrive, with a dash where each number goes.
    await screen.findByText('+50%');
    const calls = screen.getByRole('heading', { name: 'Calls Answered' }).closest('section');
    const bookings = screen.getByRole('heading', { name: 'AI Bookings' }).closest('section');
    const attention = screen.getByRole('heading', { name: 'Needs Attention' }).closest('section');

    // 6 against 4 is +50%; 1 against 2 is −50%.
    expect(within(calls as HTMLElement).getByText('6')).toBeInTheDocument();
    expect(within(calls as HTMLElement).getByText('+50%')).toBeInTheDocument();
    expect(within(attention as HTMLElement).getByText('−50%')).toBeInTheDocument();

    /**
     * 3 against 0 has no percentage, and "New" is what it says rather than "+Infinity%" or
     * an invented figure. This is the one place a made-up number would be easiest to slip in.
     */
    expect(within(bookings as HTMLElement).getByText('New')).toBeInTheDocument();
  });

  it('estimates revenue in rupees and labels it an estimate', async () => {
    renderWith(<OverviewPage />, signedIn());

    // 150,000 paise is ₹1,500: the listed price of three bookings, not money taken.
    expect(await screen.findByText('₹1,500')).toBeInTheDocument();
    expect(screen.getByText('ESTIMATE')).toBeInTheDocument();
  });

  it('says the agent is online and never claims call forwarding', async () => {
    renderWith(<OverviewPage />, signedIn());

    expect(await screen.findByText('Online')).toBeInTheDocument();
    /**
     * The reference has a green "Call Forwarding active" chip. Forwarding is the Android app,
     * which does not exist yet, so asserting it is on would be the most confident claim on
     * the screen and the least true one.
     */
    expect(screen.queryByText(/Call Forwarding/)).not.toBeInTheDocument();
  });

  it('asks the server for the period chosen', async () => {
    const stub = signedIn();
    renderWith(<OverviewPage />, stub);
    await screen.findByText('₹1,500');

    await userEvent.selectOptions(screen.getByLabelText('Period'), 'Last 30 days');

    await waitFor(() => {
      expect(stub.calls.requests.some((request) => request.path.includes('range=30d'))).toBe(true);
    });
  });

  it('draws the outcome ring from recorded outcomes, unclassified calls as Other', async () => {
    renderWith(<OverviewPage />, signedIn());

    // Six calls: two booked, one enquiry, three nobody classified, which are Other.
    expect(await screen.findByText('2 · 33%')).toBeInTheDocument();
    expect(screen.getByText('3 · 50%')).toBeInTheDocument();
  });

  it('starts the calendar on Sunday, as the reference does', async () => {
    renderWith(<OverviewPage />, signedIn());

    const grid = await screen.findByRole('table', { name: /Appointments by day/ });
    const headings = within(grid)
      .getAllByRole('columnheader')
      .map((cell) => cell.textContent);

    expect(headings).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);
  });

  it('draws a month grid whose days carry the appointments on them', async () => {
    renderWith(<OverviewPage />, signedIn());

    const grid = await screen.findByRole('table', { name: /Appointments by day/ });

    // Six weeks of cells plus seven headings, which is what a month needs in the worst case.
    expect(within(grid).getAllByRole('cell')).toHaveLength(42);
    expect(within(grid).getByRole('columnheader', { name: 'Mon' })).toBeInTheDocument();

    /**
     * The count is in each cell's accessible NAME, not only in its dots. Three dots is the
     * visual cap, so a screen reader would otherwise be told less than the screen shows.
     *
     * Waited for, because the grid is drawn as soon as the clinic's time zone is known and the
     * month's appointments arrive after it. Asserting immediately would read the empty grid
     * that is correct for that instant.
     */
    await waitFor(() => {
      const withAppointments = within(grid)
        .getAllByRole('button')
        .filter((cell) => !/0 appointments/.test(cell.getAttribute('aria-label') ?? ''));

      expect(withAppointments.length).toBeGreaterThan(0);
    });
  });
  it('moves between months and asks the server for the one shown', async () => {
    const stub = signedIn();
    renderWith(<OverviewPage />, stub);

    await screen.findByRole('table', { name: /Appointments by day/ });
    const before = stub.calls.requests.filter((request) => request.path.includes('range=month'));

    await userEvent.click(screen.getByRole('button', { name: 'Next month' }));

    await waitFor(() => {
      const after = stub.calls.requests.filter((request) => request.path.includes('range=month'));
      expect(after.length).toBeGreaterThan(before.length);
    });
  });
  it('shows the day a receptionist clicks, by asking for that day', async () => {
    const stub = signedIn();
    renderWith(<OverviewPage />, stub);

    const grid = await screen.findByRole('table', { name: /Appointments by day/ });
    const cells = within(grid).getAllByRole('button');
    const target = cells[20];

    expect(target).toBeDefined();
    await userEvent.click(target!);

    // The day panel is its own query, because the month response is capped at the page size
    // and a busy clinic's day would otherwise look empty.
    await waitFor(() => {
      expect(stub.calls.requests.some((request) => request.path.includes('range=day'))).toBe(true);
    });
  });
});

describe('the screens with no endpoint', () => {
  /**
   * Call History is NO LONGER ONE OF THESE. It was an honest empty state while nothing wrote
   * a call row; it now reads the real endpoint, and its own suite covers it.
   */
  it.each([
    ['Reminders', RemindersPage, /no tables and no endpoints/],
    ['Reports', ReportsPage, /no analytics endpoint/],
  ])('%s says what is missing rather than showing invented data', (_name, Page, expected) => {
    renderWith(<Page />, signedIn());

    expect(screen.getByText('Not built yet')).toBeInTheDocument();
    expect(screen.getByText(expected)).toBeInTheDocument();
  });

  it('never renders a figure on the reports screen', () => {
    const { container } = renderWith(<ReportsPage />, signedIn());

    /**
     * No digits anywhere, which is a blunt assertion and the right one: the prototype's
     * Reports screen is entirely numbers, and the failure this guards against is somebody
     * filling them in from the capture because the screen looked empty.
     */
    expect(container.textContent).not.toMatch(/\d/);
  });
});
