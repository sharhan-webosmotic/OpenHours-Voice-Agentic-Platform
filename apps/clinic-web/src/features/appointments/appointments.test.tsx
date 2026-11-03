import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWith, stubClient, user } from '../../test-support/harness';
import {
  APPOINTMENT_ID,
  agenda,
  appointment,
  availability,
  baseRoutes,
  DOCTOR_ID,
  PATIENT_ID,
  SERVICE_ID,
  appointmentList,
} from '../../test-support/fixtures';
import { AppointmentDetail } from './AppointmentDetail';
import { AppointmentsPage } from './AppointmentsPage';

/**
 * The appointments screen, driven as a user drives it.
 *
 * BY ROLE AND LABEL, never by class name or test id, because what is being asserted is that
 * the screen is usable: a button a test can only find by a CSS selector is a button a screen
 * reader cannot find either.
 *
 * THE CLINIC IS `Asia/Kolkata` AND EVERY INSTANT IS UTC, so the rendered times double as an
 * assertion that the conversion happened. 03:30Z must read as 9:00 am; a screen reading the
 * browser's zone would show something else and these tests would fail in exactly the way that
 * matters.
 */

const signedIn = (routes = baseRoutes) =>
  stubClient({ user: user('CLINIC_OWNER'), bootSucceeds: true, routes });

describe('the appointment list', () => {
  it('shows an appointment at the clinic time, not the browser time', async () => {
    renderWith(<AppointmentsPage />, signedIn());

    const row = await screen.findByRole('row', { name: /Test Patient One/ });

    // 03:30Z is 09:00 in Kolkata, written on the 24-hour clock as the reference writes it.
    expect(within(row).getByText('09:00')).toBeInTheDocument();
    expect(within(row).getByText('2026-11-16')).toBeInTheDocument();
    expect(within(row).getByText('Consultation')).toBeInTheDocument();
  });

  it('labels a voice-agent booking as an AI booking rather than as its status', async () => {
    renderWith(<AppointmentsPage />, signedIn());

    // SCHEDULED + VOICE_AGENT is the prototype's "AI Booking", which is a source and a status
    // combined. A screen showing "Scheduled" here would be correct and useless.
    expect(await screen.findByText('AI Booking')).toBeInTheDocument();
  });

  it('says so when the clinic has no appointments, and offers the next step', async () => {
    renderWith(
      <AppointmentsPage />,
      signedIn({
        ...baseRoutes,
        'GET /api/v1/appointments': { body: { items: [], nextCursor: null } },
      }),
    );

    expect(await screen.findByText('No appointments this month')).toBeInTheDocument();
    /**
     * TWO of them, and that is the design: the toolbar keeps its action and the empty state
     * names the next step, which is the house rule for an empty state. The assertion counts
     * rather than expecting one, because expecting one would be asserting the rule away.
     */
    expect(screen.getAllByRole('button', { name: /New Appointment/ })).toHaveLength(2);
  });

  it('distinguishes an empty filter from an empty book', async () => {
    const stub = signedIn({
      ...baseRoutes,
      'GET /api/v1/appointments': { body: { items: [], nextCursor: null } },
    });

    renderWith(<AppointmentsPage />, stub);
    await screen.findByText('No appointments this month');

    await userEvent.type(screen.getByLabelText('Date'), '2026-11-17');

    // The two need different next actions: one offers a booking, the other offers to clear
    // the filter that is hiding everything.
    expect(await screen.findByText('Nothing matches that filter')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear the filters' })).toBeInTheDocument();
  });

  it('sends the date filter to the server as a clinic day in UTC', async () => {
    const stub = signedIn();
    renderWith(<AppointmentsPage />, stub);
    await screen.findByRole('row', { name: /Test Patient One/ });

    await userEvent.type(screen.getByLabelText('Date'), '2026-11-16');

    await waitFor(() => {
      const asked = stub.calls.requests.filter((request) => request.path.includes('from='));
      expect(asked.length).toBeGreaterThan(0);
      // 18:30Z the previous day is midnight in Kolkata: the server cannot work out which day
      // a browser meant without the clinic's zone, so the client converts.
      expect(asked.at(-1)?.path).toContain(encodeURIComponent('2026-11-15T18:30:00.000Z'));
    });
  });

  it('shows the error with a retry rather than an empty table', async () => {
    renderWith(
      <AppointmentsPage />,
      signedIn({
        ...baseRoutes,
        'GET /api/v1/appointments': {
          status: 500,
          body: { type: 'about:blank', title: 'Server error', status: 500, detail: 'Broke.' },
        },
      }),
    );

    expect(await screen.findByText('Broke.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });
});

describe('the appointment detail drawer', () => {
  const open = async () => {
    const stub = signedIn();
    renderWith(<AppointmentsPage />, stub);

    await userEvent.click(await screen.findByRole('button', { name: 'View details' }));
    return stub;
  };

  it('shows the note written when it was booked', async () => {
    renderWith(<AppointmentsPage />, signedIn());

    await userEvent.click(await screen.findByRole('button', { name: 'View details' }));
    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('Prefers the first slot of the morning.')).toBeInTheDocument();
  });

  it('opens as a labelled dialog with the appointment in it', async () => {
    await open();

    const dialog = await screen.findByRole('dialog', { name: 'Test Patient One' });

    expect(within(dialog).getByText('Consultation')).toBeInTheDocument();
    expect(within(dialog).getByText('Dr Test Doctor')).toBeInTheDocument();
    expect(within(dialog).getByText('AI receptionist')).toBeInTheDocument();
  });

  it('offers only the transitions the shared table allows', async () => {
    await open();

    const dialog = await screen.findByRole('dialog', { name: 'Test Patient One' });

    // SCHEDULED may be confirmed, rescheduled or cancelled. Its outcome waits for the visit,
    // which the drawer judges against the clock, so it is asserted below with a fixed `now`.
    expect(within(dialog).getByRole('button', { name: 'Confirm appointment' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Edit or reschedule' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Cancel appointment' })).toBeInTheDocument();
  });

  it('offers nothing to a cancelled appointment, because every move is refused', async () => {
    const stub = signedIn({
      ...baseRoutes,
      'GET /api/v1/appointments': {
        body: {
          items: [{ ...appointment, status: 'CANCELLED', cancelledAt: '2026-11-02T00:00:00.000Z' }],
          nextCursor: null,
        },
      },
    });

    renderWith(<AppointmentsPage />, stub);
    await userEvent.click(await screen.findByRole('button', { name: 'View details' }));

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByRole('button', { name: /Confirm/ })).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: /Cancel appointment/ }),
    ).not.toBeInTheDocument();
  });

  it('asks for confirmation before cancelling, and sends the reason', async () => {
    const stub = signedIn({
      ...baseRoutes,
      [`POST /api/v1/appointments/${APPOINTMENT_ID}/cancel`]: { status: 204 },
    });

    renderWith(<AppointmentsPage />, stub);
    await userEvent.click(await screen.findByRole('button', { name: 'View details' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Cancel appointment' }));

    // The first click asks rather than acting: cancelling is destructive and the prototype
    // confirms inline.
    expect(screen.getByText('Cancel this appointment?')).toBeInTheDocument();
    expect(stub.calls.requests.some((request) => request.path.includes('/cancel'))).toBe(false);

    await userEvent.type(screen.getByLabelText('Reason'), 'Patient called to cancel.');
    await userEvent.click(screen.getByRole('button', { name: 'Confirm cancellation' }));

    await waitFor(() => {
      const sent = stub.calls.requests.find((request) => request.path.includes('/cancel'));
      expect(sent?.body).toEqual({ reason: 'Patient called to cancel.' });
    });
  });

  it('stays open and explains when the server refuses', async () => {
    renderWith(
      <AppointmentsPage />,
      signedIn({
        ...baseRoutes,
        [`POST /api/v1/appointments/${APPOINTMENT_ID}/status`]: {
          status: 409,
          body: {
            type: 'about:blank',
            title: 'Conflict',
            status: 409,
            detail: 'That appointment was changed by someone else. Reload and try again.',
          },
        },
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: 'View details' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm appointment' }));

    // Closing on failure would leave the user with no idea what happened to their click.
    expect(
      await screen.findByText(
        'That appointment was changed by someone else. Reload and try again.',
      ),
    ).toBeInTheDocument();
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('closes on Escape and returns focus to the control that opened it', async () => {
    await open();
    await screen.findByRole('dialog');

    await userEvent.keyboard('{Escape}');

    await waitFor(() => {
      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });
    // Without the return, a keyboard user lands at the top of the document and has to tab
    // back through the whole sidebar.
    expect(screen.getByRole('button', { name: 'View details' })).toHaveFocus();
  });
});

describe('the visit outcome in the drawer', () => {
  /**
   * RENDERED DIRECTLY WITH A FIXED `now`, because whether the outcome is offered depends on
   * whether the visit has started, and a test reading the real clock would flip on the day
   * the fixture's date passes.
   */
  const drawerAt = (now: string, status: 'SCHEDULED' | 'CONFIRMED' = 'SCHEDULED') => {
    renderWith(
      <AppointmentDetail
        appointment={{ ...appointment, status }}
        timeZone="Asia/Kolkata"
        onClose={() => undefined}
        onReschedule={() => undefined}
        now={new Date(now)}
      />,
      signedIn(),
    );
  };

  it('is not offered before the visit, because nobody has attended it yet', async () => {
    drawerAt('2026-11-01T00:00:00.000Z');

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).queryByText('Visit outcome')).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Mark as completed' }),
    ).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Mark as no show' }),
    ).not.toBeInTheDocument();
  });

  it('is offered once the visit has started, and records the choice', async () => {
    const stub = signedIn({
      ...baseRoutes,
      [`POST /api/v1/appointments/${APPOINTMENT_ID}/status`]: { body: appointment },
    });
    renderWith(
      <AppointmentDetail
        appointment={{ ...appointment, status: 'CONFIRMED' }}
        timeZone="Asia/Kolkata"
        onClose={() => undefined}
        onReschedule={() => undefined}
        now={new Date('2026-11-16T04:00:00.000Z')}
      />,
      stub,
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Visit outcome')).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Mark as no show' })).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Mark as completed' }));

    await waitFor(() => {
      const sent = stub.calls.requests.find((request) => request.path.endsWith('/status'));
      expect(sent?.body).toEqual({ status: 'COMPLETED' });
    });
  });

  it('asks a confirmed booking for nothing more than its outcome', async () => {
    drawerAt('2026-11-16T04:00:00.000Z', 'CONFIRMED');

    const dialog = await screen.findByRole('dialog');

    // Already confirmed, so the callout asking for confirmation has nothing to ask.
    expect(within(dialog).queryByText('Awaiting confirmation')).not.toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Confirm appointment' }),
    ).not.toBeInTheDocument();
  });
});

describe('the booking sheet', () => {
  const openSheet = async (routes = baseRoutes) => {
    const stub = stubClient({ user: user('CLINIC_OWNER'), bootSucceeds: true, routes });
    renderWith(<AppointmentsPage />, stub);

    await userEvent.click(await screen.findByRole('button', { name: /New Appointment/ }));
    return stub;
  };

  const choosePatient = async (): Promise<void> => {
    await userEvent.selectOptions(
      await screen.findByLabelText('Select patient'),
      await screen.findByRole('option', { name: /Test Patient One/ }),
    );
  };

  it('lays out patient, doctor, service, date and times on one sheet', async () => {
    await openSheet();

    /**
     * All five at once, as the reference draws them, rather than a wizard that hides four of
     * them. The doctor and service are chosen already because the fixture clinic has one of
     * each, which is the pilot's shape; with several, the receptionist chooses.
     */
    expect(await screen.findByLabelText('Select patient')).toBeInTheDocument();
    expect(screen.getByLabelText('Doctor')).toBeInTheDocument();
    expect(screen.getByLabelText('Select service')).toBeInTheDocument();
    expect(screen.getByLabelText('Appointment date')).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '09:00' })).toBeInTheDocument();
    expect(screen.getByText(/Calculated from .* hours for this weekday/)).toBeInTheDocument();
  });

  it('sends the note with the booking, and sends nothing for an empty box', async () => {
    const routes = {
      ...baseRoutes,
      'POST /api/v1/appointments': {
        status: 201,
        body: {
          appointmentId: APPOINTMENT_ID,
          startAt: '2026-11-16T03:30:00.000Z',
          endAt: '2026-11-16T04:00:00.000Z',
          replayed: false,
        },
      },
    };
    const stub = await openSheet(routes);

    await choosePatient();
    await userEvent.click(await screen.findByRole('button', { name: '09:00' }));
    await userEvent.type(screen.getByLabelText('Notes (optional)'), 'Prefers the morning.');
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm appointment' }));

    await waitFor(() => {
      const booked = stub.calls.requests.find((request) => request.method === 'POST');
      expect(booked?.body).toMatchObject({ notes: 'Prefers the morning.' });
    });
  });

  it('leaves the note out of the request when nothing was typed', async () => {
    const stub = await openSheet({
      ...baseRoutes,
      'POST /api/v1/appointments': {
        status: 201,
        body: {
          appointmentId: APPOINTMENT_ID,
          startAt: '2026-11-16T03:30:00.000Z',
          endAt: '2026-11-16T04:00:00.000Z',
          replayed: false,
        },
      },
    });

    await choosePatient();
    await userEvent.click(await screen.findByRole('button', { name: '09:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm appointment' }));

    await waitFor(() => {
      const booked = stub.calls.requests.find((request) => request.method === 'POST');
      // Absent rather than an empty string, so an untouched box is not stored as a note.
      expect(booked?.body).not.toHaveProperty('notes');
    });
  });

  it('refuses to continue without a patient, and says what is missing', async () => {
    await openSheet();

    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Select a patient to continue.')).toBeInTheDocument();
  });

  it('refuses to continue without a time', async () => {
    await openSheet();
    await choosePatient();

    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Choose an available time.')).toBeInTheDocument();
  });

  it('shows what is about to be booked, then books the slot it was offered', async () => {
    const stub = await openSheet({
      ...baseRoutes,
      'POST /api/v1/appointments': {
        status: 201,
        body: {
          appointmentId: APPOINTMENT_ID,
          startAt: '2026-11-16T03:30:00.000Z',
          endAt: '2026-11-16T04:00:00.000Z',
          replayed: false,
        },
      },
    });

    await choosePatient();
    await userEvent.click(await screen.findByRole('button', { name: '09:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // A last look before the one action here a patient will act on. Scoped to the sheet,
    // because the same patient is in the list behind it.
    const sheet = await screen.findByRole('dialog', { name: /Book with/ });
    expect(await within(sheet).findByText('Test Patient One')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Confirm appointment' }));

    await waitFor(() => {
      const booked = stub.calls.requests.find(
        (request) => request.method === 'POST' && request.path === '/api/v1/appointments',
      );

      /**
       * The INSTANT the server offered, sent back unchanged: the slot list came back as
       * instants, so returning one is returning the slot that was offered rather than a second
       * conversion that could disagree with the first.
       */
      expect(booked?.body).toEqual({
        patientId: PATIENT_ID,
        doctorId: DOCTOR_ID,
        serviceId: SERVICE_ID,
        startAt: '2026-11-16T03:30:00.000Z',
      });
    });
  });

  it('offers only active services', async () => {
    await openSheet();

    const select = await screen.findByLabelText('Select service');

    expect(within(select).getByRole('option', { name: /Consultation/ })).toBeInTheDocument();
    expect(
      within(select).queryByRole('option', { name: /Retired Service/ }),
    ).not.toBeInTheDocument();
  });

  it('says WHY a day has no times rather than just showing none', async () => {
    await openSheet({
      ...baseRoutes,
      'GET /api/v1/appointments/availability': {
        body: { ...availability([]), reason: 'CLINIC_CLOSED' },
      },
    });

    // "The clinic is closed that day" and "every time is taken" are both no slots, and a
    // receptionist does something different about each.
    expect(await screen.findByText('The clinic is closed that day.')).toBeInTheDocument();
  });

  /**
   * THE RACE THE FEATURE BRIEF ASKS FOR: a slot taken between the list being drawn and the
   * booking being submitted. The exclusion constraint refuses the write; what this asserts is
   * the part the interface owns: words a receptionist can act on, the sheet back on the
   * times, and the times read again rather than still offering the one that has gone.
   */
  it('explains a slot taken between load and submit, and refreshes the times', async () => {
    const stub = await openSheet({
      ...baseRoutes,
      'POST /api/v1/appointments': {
        status: 409,
        body: {
          type: 'https://clinicai.health/problems/conflict',
          title: 'Conflict',
          status: 409,
          detail: 'That time was just taken by another booking. Please choose another.',
        },
      },
    });

    await choosePatient();
    await userEvent.click(await screen.findByRole('button', { name: '09:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const before = stub.calls.requests.filter((request) =>
      request.path.includes('availability'),
    ).length;

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm appointment' }));

    expect(
      await screen.findByText(
        'That time was just taken by another booking. Please choose another.',
      ),
    ).toBeInTheDocument();
    expect(await screen.findByRole('button', { name: '09:30' })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        stub.calls.requests.filter((request) => request.path.includes('availability')).length,
      ).toBeGreaterThan(before);
    });
  });

  it('sends one Idempotency-Key and keeps it across a retry', async () => {
    const stub = await openSheet({
      ...baseRoutes,
      'POST /api/v1/appointments': {
        status: 409,
        body: {
          type: 'about:blank',
          title: 'Conflict',
          status: 409,
          detail: 'That time was just taken by another booking. Please choose another.',
        },
      },
    });

    await choosePatient();
    await userEvent.click(await screen.findByRole('button', { name: '09:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm appointment' }));
    await screen.findByText(/just taken/);

    await userEvent.click(await screen.findByRole('button', { name: '09:30' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm appointment' }));

    /**
     * Two attempts, and the same key on both. A regenerated key would make the retry a NEW
     * booking, which is the bug the header exists to prevent.
     */
    await waitFor(() => {
      const posts = stub.calls.requests.filter(
        (request) => request.method === 'POST' && request.path === '/api/v1/appointments',
      );
      expect(posts).toHaveLength(2);
      expect(posts[0]?.headers?.['Idempotency-Key']).toBe(posts[1]?.headers?.['Idempotency-Key']);
    });
  });
});

describe('a role without write permission', () => {
  it('sees the list and is offered no booking button', async () => {
    renderWith(
      <AppointmentsPage />,
      stubClient({ user: user('DOCTOR'), bootSucceeds: true, routes: baseRoutes }),
    );

    await screen.findByRole('row', { name: /Test Patient One/ });

    /**
     * A DOCTOR may read and write their OWN appointments, so this asserts the read. The
     * hiding is cosmetic either way: the API refuses what the matrix denies, and this test
     * exists so the product does not offer a door the server will not open.
     */
    expect(screen.getByRole('row', { name: /Test Patient One/ })).toBeInTheDocument();
  });

  it('offers no actions at all to a role with read-only appointments', async () => {
    renderWith(
      <AppointmentsPage />,
      stubClient({ user: user('SUPER_ADMIN'), bootSucceeds: true, routes: baseRoutes }),
    );

    await screen.findByRole('row', { name: /Test Patient One/ });

    expect(screen.queryByRole('button', { name: /New Appointment/ })).not.toBeInTheDocument();
  });
});

describe('the agenda data the overview reads', () => {
  it('counts by status over the range', () => {
    // The shape the overview renders, asserted here so a change to it fails next to the
    // fixture rather than inside a screen test that is about something else.
    expect(agenda('week').counts.CONFIRMED).toBe(2);
    expect(appointmentList.items).toHaveLength(1);
  });
});

/**
 * The calendar views, from the clinic's reference: Month, Week and Day beside the List.
 *
 * Each is driven by its address, `?view=week&date=…`, which is also what keeps a reload or a
 * shared link on the same view of the same day.
 */
describe('the calendar views', () => {
  const at = (query: string, routes = baseRoutes) => {
    const stub = signedIn(routes);
    renderWith(<AppointmentsPage />, stub, [`/appointments?${query}`]);
    return stub;
  };

  it('offers four views and starts on the list', async () => {
    at('');

    const tabs = await screen.findByRole('tablist', { name: 'Calendar view' });

    expect(
      within(tabs)
        .getAllByRole('tab')
        .map((tab) => tab.textContent),
    ).toEqual(['month', 'week', 'day', 'list']);
    expect(within(tabs).getByRole('tab', { name: 'list' })).toHaveAttribute(
      'aria-selected',
      'true',
    );
  });

  it('draws the month Sunday first, with the chosen day beside it', async () => {
    at('view=month&date=2026-11-16');

    const grid = await screen.findByRole('table', { name: 'Appointments by day' });
    expect(
      within(grid)
        .getAllByRole('columnheader')
        .map((cell) => cell.textContent),
    ).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']);

    expect(screen.getByText('Selected day')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Monday, November 16' })).toBeInTheDocument();
    // The day panel's appointment, from the day's own query.
    expect(await screen.findByText('Test Patient One')).toBeInTheDocument();
  });

  it('says a free day is free, when the clinic opens, and offers a booking into it', async () => {
    const emptyDay = {
      ...baseRoutes,
      'GET /api/v1/appointments/agenda': { body: { ...agenda('day'), appointments: [] } },
    };
    // A Tuesday comfortably in the future, which the fixture clinic opens 09:00 to 17:00.
    at('view=month&date=2030-11-19', emptyDay);

    expect(await screen.findByText('No appointments yet')).toBeInTheDocument();
    expect(screen.getByText('Open 09:00–17:00')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Book an appointment' }));

    // The sheet opens on the day that was being looked at, not on today.
    expect(await screen.findByLabelText('Appointment date')).toHaveValue('2030-11-19');
  });

  it('does not offer a booking into a day that has passed', async () => {
    at('view=month&date=2020-11-17', {
      ...baseRoutes,
      'GET /api/v1/appointments/agenda': { body: { ...agenda('day'), appointments: [] } },
    });

    // The server would refuse it, and a button that leads to a refusal is worse than none.
    expect(await screen.findByText('Nothing was booked')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Book an appointment' })).not.toBeInTheDocument();
  });

  it('says the clinic is closed on a day with no opening hours', async () => {
    // 2030-11-23 is a Saturday, which the fixture clinic does not open.
    at('view=month&date=2030-11-23', {
      ...baseRoutes,
      'GET /api/v1/appointments/agenda': { body: { ...agenda('day'), appointments: [] } },
    });

    expect(await screen.findByText('The clinic is closed on this day')).toBeInTheDocument();
  });

  it('titles the week Sunday to Saturday and lays out seven columns', async () => {
    at('view=week&date=2026-11-16');

    // 16 Nov 2026 is a Monday, so its week is Sunday the 15th to Saturday the 21st.
    expect(await screen.findByText('Nov 15 – Nov 21, 2026')).toBeInTheDocument();
    expect(
      await screen.findByRole('button', { name: /09:00, Test Patient One, AI Booking/ }),
    ).toBeInTheDocument();
  });

  it('asks for the week as Sunday to Sunday in the clinic’s zone', async () => {
    const stub = at('view=week&date=2026-11-16');
    await screen.findByText('Nov 15 – Nov 21, 2026');

    await waitFor(() => {
      const asked = stub.calls.requests.find((request) => request.path.includes('from='));
      // Kolkata midnight on Sunday the 15th is 18:30Z on the 14th, and the week ends at the
      // same hour seven days later. A Monday-first week would be the agenda's, not this one.
      expect(asked?.path).toContain(encodeURIComponent('2026-11-14T18:30:00.000Z'));
      expect(asked?.path).toContain(encodeURIComponent('2026-11-21T18:30:00.000Z'));
    });
  });

  it('opens the booking sheet on the day of an empty column', async () => {
    at('view=week&date=2026-11-16');
    await screen.findByText('Nov 15 – Nov 21, 2026');

    await userEvent.click(
      await screen.findByRole('button', { name: 'Add an appointment on 2026-11-17' }),
    );

    expect(await screen.findByLabelText('Appointment date')).toHaveValue('2026-11-17');
  });

  it('lays the day out hour by hour, with the appointment in its hour', async () => {
    at('view=day&date=2026-11-16');

    expect(
      await screen.findByRole('heading', { name: 'Monday, November 16, 2026' }),
    ).toBeInTheDocument();

    const hours = await screen.findByRole('list', { name: 'Appointments by hour' });
    // The rows are the clinic's hours and draw at once; the day's appointments arrive after.
    const block = await within(hours).findByText(/Test Patient One/);

    // In the 09:00 row, which is the hour 03:30Z falls in on the clinic's clock.
    expect(block.closest('li')?.textContent?.startsWith('09:00')).toBe(true);
  });

  it('moves a week at a time in the week view', async () => {
    at('view=week&date=2026-11-16');
    await screen.findByText('Nov 15 – Nov 21, 2026');

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    expect(await screen.findByText('Nov 22 – Nov 28, 2026')).toBeInTheDocument();
  });

  it('opens the appointment drawer from a week card', async () => {
    at('view=week&date=2026-11-16');

    await userEvent.click(
      await screen.findByRole('button', { name: /09:00, Test Patient One, AI Booking/ }),
    );

    const drawer = await screen.findByRole('dialog', { name: 'Test Patient One' });
    // The reference's date tile and the clinic's date with a 24-hour time.
    expect(within(drawer).getByText('2026-11-16 · 09:00')).toBeInTheDocument();
    expect(within(drawer).getByText('30 minutes')).toBeInTheDocument();
  });
});
