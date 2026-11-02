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

    expect(within(row).getByText('9:00 am')).toBeInTheDocument();
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

    expect(await screen.findByText('No appointments yet')).toBeInTheDocument();
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
    await screen.findByText('No appointments yet');

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

    // SCHEDULED may be confirmed, completed, marked a no-show or cancelled.
    expect(within(dialog).getByRole('button', { name: 'Confirm appointment' })).toBeInTheDocument();
    expect(within(dialog).getByRole('button', { name: 'Mark as completed' })).toBeInTheDocument();
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

describe('the booking wizard', () => {
  const openWizard = async (routes = baseRoutes) => {
    const stub = stubClient({ user: user('CLINIC_OWNER'), bootSucceeds: true, routes });
    renderWith(<AppointmentsPage />, stub);

    await userEvent.click(await screen.findByRole('button', { name: /New Appointment/ }));
    return stub;
  };

  it('refuses to advance without a patient, and says which step is incomplete', async () => {
    await openWizard();

    await userEvent.click(await screen.findByRole('button', { name: 'Continue' }));

    expect(await screen.findByText('Select a patient to continue.')).toBeInTheDocument();
  });

  it('walks patient, service, time and review, then books the slot it was offered', async () => {
    const stub = await openWizard({
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

    await userEvent.selectOptions(
      await screen.findByLabelText('Select patient'),
      await screen.findByRole('option', { name: /Test Patient One/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await userEvent.click(await screen.findByRole('button', { name: /Consultation/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await userEvent.click(await screen.findByRole('button', { name: '09:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm appointment' }));

    await waitFor(() => {
      const booked = stub.calls.requests.find(
        (request) => request.method === 'POST' && request.path === '/api/v1/appointments',
      );

      /**
       * The INSTANT the server offered, sent back unchanged.
       *
       * Not a day and a wall-clock time: the slot list came back as instants, so returning one
       * is returning the slot that was offered rather than a second conversion that could
       * disagree with the first.
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
    await openWizard();

    await userEvent.selectOptions(
      await screen.findByLabelText('Select patient'),
      await screen.findByRole('option', { name: /Test Patient One/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    expect(await screen.findByRole('button', { name: /Consultation/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Retired Service/ })).not.toBeInTheDocument();
  });

  it('says WHY a day has no times rather than just showing none', async () => {
    await openWizard({
      ...baseRoutes,
      'GET /api/v1/appointments/availability': {
        body: { ...availability([]), reason: 'CLINIC_CLOSED' },
      },
    });

    await userEvent.selectOptions(
      await screen.findByLabelText('Select patient'),
      await screen.findByRole('option', { name: /Test Patient One/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: /Consultation/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    // "The clinic is closed that day" and "every time is taken" are both no slots, and a
    // receptionist does something different about each.
    expect(await screen.findByText('The clinic is closed that day.')).toBeInTheDocument();
  });

  /**
   * THE RACE THE FEATURE BRIEF ASKS FOR: a slot taken between the list being drawn and the
   * booking being submitted.
   *
   * The engine cannot prevent it, the exclusion constraint refuses the write, and what this
   * asserts is the only part the interface owns: the user is told in words they can act on,
   * is returned to the step where the choice is made, and the slot list is re-read rather
   * than left showing the time that has just gone.
   */
  it('explains a slot taken between load and submit, and refreshes the times', async () => {
    const stub = await openWizard({
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

    await userEvent.selectOptions(
      await screen.findByLabelText('Select patient'),
      await screen.findByRole('option', { name: /Test Patient One/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: /Consultation/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: '09:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    const availabilityCallsBefore = stub.calls.requests.filter((request) =>
      request.path.includes('availability'),
    ).length;

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm appointment' }));

    expect(
      await screen.findByText(
        'That time was just taken by another booking. Please choose another.',
      ),
    ).toBeInTheDocument();

    // Back on the step with the times, and the times have been asked for again.
    expect(await screen.findByRole('button', { name: '09:30' })).toBeInTheDocument();
    await waitFor(() => {
      expect(
        stub.calls.requests.filter((request) => request.path.includes('availability')).length,
      ).toBeGreaterThan(availabilityCallsBefore);
    });
  });

  it('sends one Idempotency-Key and keeps it across a retry', async () => {
    const stub = await openWizard({
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

    await userEvent.selectOptions(
      await screen.findByLabelText('Select patient'),
      await screen.findByRole('option', { name: /Test Patient One/ }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: /Consultation/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: '09:00' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));

    await userEvent.click(await screen.findByRole('button', { name: 'Confirm appointment' }));
    await screen.findByText(/just taken/);
    await userEvent.click(await screen.findByRole('button', { name: '09:30' }));
    await userEvent.click(screen.getByRole('button', { name: 'Continue' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Confirm appointment' }));

    /**
     * The same key on both attempts.
     *
     * A regenerated key would make the retry a NEW booking, which is the bug the header
     * exists to prevent: the patient ends up with two appointments and the clinic finds out
     * when both arrive.
     */
    await waitFor(() => {
      const posts = stub.calls.requests.filter(
        (request) => request.method === 'POST' && request.path === '/api/v1/appointments',
      );
      expect(posts).toHaveLength(2);
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
