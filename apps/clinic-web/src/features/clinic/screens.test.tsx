import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWith, stubClient, user } from '../../test-support/harness';
import {
  agenda,
  baseRoutes,
  clinic,
  ORGANISATION_ID,
  SERVICE_ID,
} from '../../test-support/fixtures';
import { ServicesPage } from '../services/ServicesPage';
import { StaffPage } from '../staff/StaffPage';
import { SettingsPage } from '../settings/SettingsPage';
import { OverviewPage } from '../overview/OverviewPage';
import { CallsPage, RemindersPage, ReportsPage } from '../placeholders/pages';

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
  it('shows this week counts and today appointments from the agenda', async () => {
    renderWith(
      <OverviewPage />,
      signedIn({
        ...baseRoutes,
        'GET /api/v1/appointments/agenda': { body: agenda('week') },
      }),
    );

    expect(await screen.findByText('Test Patient One')).toBeInTheDocument();
    expect(screen.getAllByText('9:00 am').length).toBeGreaterThan(0);
    // CONFIRMED is 2 in the fixture.
    expect(screen.getAllByText('2').length).toBeGreaterThan(0);
  });

  it('says why the call panels are empty instead of showing a number', async () => {
    renderWith(<OverviewPage />, signedIn());

    const panel = (await screen.findByText('AI receptionist activity')).parentElement;

    /**
     * The five panels the prototype fills with invented figures: calls answered, AI bookings,
     * the outcome split, the activity chart and the revenue estimate. A plausible number here
     * is a claim about what the agent did, and nothing in the platform can support it yet.
     *
     * Asserted against the panel's own text rather than with `getByText`, because the sentence
     * is written across several lines of JSX and therefore several text nodes: the default
     * matcher compares each node, and no single node holds the whole phrase.
     */
    expect(panel?.textContent).toContain('no call data in the platform yet');
    expect(panel?.textContent).toContain('arrive with the voice integration');
  });

  it('offers a booking when the day is empty', async () => {
    renderWith(
      <OverviewPage />,
      signedIn({
        ...baseRoutes,
        'GET /api/v1/appointments/agenda': { body: { ...agenda(), appointments: [] } },
      }),
    );

    expect(await screen.findByText('Nothing booked today')).toBeInTheDocument();
  });
});

describe('the screens with no endpoint', () => {
  it.each([
    ['Call History', CallsPage, /no call endpoints yet/],
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
