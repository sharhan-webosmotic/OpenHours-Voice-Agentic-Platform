import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWith, stubClient, user } from '../../test-support/harness';
import {
  baseRoutes,
  call,
  CALL_ID,
  callDetail,
  clinic,
  ORGANISATION_ID,
} from '../../test-support/fixtures';
import { CallsPage } from './CallsPage';

/**
 * Call History and its drawer.
 *
 * WHAT THESE TESTS ARE REALLY FOR. The prototype's version of this screen is the most
 * fictional one in the whole export: its own banner says the call records and summaries are
 * invented. So most of what is worth asserting here is about honesty rather than layout: that
 * no summary is claimed, that a missing recording says which of three things happened, that
 * the review controls are visibly inert rather than absent, and that a role which may not
 * hear a recording is told so instead of being handed a dead button.
 */

const signedIn = (
  routes = baseRoutes,
  role: 'CLINIC_OWNER' | 'DOCTOR' | 'SUPER_ADMIN' | 'STAFF' = 'CLINIC_OWNER',
) => stubClient({ user: user(role), bootSucceeds: true, routes });

const openDetails = async (): Promise<void> => {
  await userEvent.click(await screen.findByRole('button', { name: 'Open details' }));
};

describe('the call list', () => {
  it('shows a call with its caller, duration and local time', async () => {
    renderWith(<CallsPage />, signedIn());

    const row = await screen.findByRole('row', { name: /Test Patient One/ });

    // 06:30Z is 12:00 in Asia/Kolkata, so this is also an assertion that the conversion ran.
    expect(within(row).getByText('12:00 pm')).toBeInTheDocument();
    expect(within(row).getByText('1m 32s')).toBeInTheDocument();
    expect(within(row).getByText('Incoming')).toBeInTheDocument();
  });

  it('says a call is not classified rather than inventing an outcome', async () => {
    renderWith(<CallsPage />, signedIn());

    const row = await screen.findByRole('row', { name: /Test Patient One/ });

    /**
     * `calls.outcome` is `NONE` on every row today because nothing writes it. "Not
     * classified" is the honest rendering; the prototype's "Booked" would be a claim about
     * what the agent did on the call.
     */
    expect(within(row).getByText('Not classified')).toBeInTheDocument();
  });

  it('falls back to the number when the caller matched no patient', async () => {
    renderWith(
      <CallsPage />,
      signedIn({
        ...baseRoutes,
        'GET /api/v1/calls': { body: { items: [{ ...call, patient: null }], nextCursor: null } },
      }),
    );

    // A number is not a name, and showing nothing would make the row look broken.
    expect(await screen.findByText('+919876543210')).toBeInTheDocument();
  });

  it('sends the search to the server rather than filtering the page', async () => {
    const stub = signedIn();
    renderWith(<CallsPage />, stub);
    await screen.findByRole('row', { name: /Test Patient One/ });

    await userEvent.type(screen.getByLabelText('Search calls'), '98765');

    await waitFor(() => {
      expect(stub.calls.requests.some((request) => request.path.includes('q=98765'))).toBe(true);
    });
  });

  it('asks for one clinic day when a date is chosen', async () => {
    const stub = signedIn();
    renderWith(<CallsPage />, stub);
    await screen.findByRole('row', { name: /Test Patient One/ });

    await userEvent.type(screen.getByLabelText('Date'), '2026-11-02');

    await waitFor(() => {
      const asked = stub.calls.requests.find((request) => request.path.includes('from=2026-11-02'));
      // Both bounds are the same day: the API resolves them in the clinic's zone, which is
      // the only place that knows it.
      expect(asked?.path).toContain('to=2026-11-02');
    });
  });

  it('distinguishes a clinic with no calls from filters that matched nothing', async () => {
    const stub = signedIn({
      ...baseRoutes,
      'GET /api/v1/calls': { body: { items: [], nextCursor: null } },
    });

    renderWith(<CallsPage />, stub);

    expect(await screen.findByText('No calls yet')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search calls'), '55555');

    expect(await screen.findByText('Nothing matched those filters')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear the filters' })).toBeInTheDocument();
  });
});

describe('the call drawer', () => {
  it('shows the transcript with each turn attributed', async () => {
    renderWith(<CallsPage />, signedIn());
    await openDetails();

    const dialog = await screen.findByRole('dialog');

    // Awaited: the drawer opens on the row the list already holds, and the transcript is a
    // second request that lands a tick later.
    expect(
      await within(dialog).findByText('I would like an appointment on Tuesday.'),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('There is ten thirty. Shall I book that?')).toBeInTheDocument();
    expect(within(dialog).getAllByText('Caller')).not.toHaveLength(0);
  });

  it('claims no summary, because nothing generates one', async () => {
    renderWith(<CallsPage />, signedIn());
    await openDetails();

    const dialog = await screen.findByRole('dialog');

    /**
     * The prototype's drawer leads with a generated "Conversation summary". A summary of a
     * clinical conversation invented by this screen would be read as the clinic's own record
     * of the call, so the card keeps its place and says what exists instead.
     */
    expect(within(dialog).getByText(/No summary is generated/)).toBeInTheDocument();
  });

  it('plays a recording only when asked, and says the play is logged', async () => {
    const stub = signedIn();
    renderWith(<CallsPage />, stub);
    await openDetails();

    const dialog = await screen.findByRole('dialog');

    /**
     * NOT MINTED ON RENDER. The URL is short-lived and every mint is an audit row against
     * the person who asked, so opening a drawer must not claim somebody listened.
     */
    expect(stub.calls.requests.some((request) => request.path.includes('recording-url'))).toBe(
      false,
    );
    expect(within(dialog).getByText(/logged against your account/)).toBeInTheDocument();

    await userEvent.click(within(dialog).getByRole('button', { name: 'Play recording' }));

    await waitFor(() => {
      expect(stub.calls.requests.some((request) => request.path.includes('recording-url'))).toBe(
        true,
      );
    });
  });

  it('says which of three things happened when there is no recording', async () => {
    renderWith(
      <CallsPage />,
      signedIn({
        ...baseRoutes,
        'GET /api/v1/calls': {
          body: { items: [{ ...call, hasRecording: false }], nextCursor: null },
        },
      }),
    );
    await openDetails();

    const dialog = await screen.findByRole('dialog');

    // "No recording" and "not copied yet" are different things to a receptionist, and the
    // screen cannot tell them apart, so it says both rather than picking one.
    expect(within(dialog).getByText(/may not have been recorded/)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Play recording' }),
    ).not.toBeInTheDocument();
  });

  it('tells a doctor their role cannot play recordings', async () => {
    renderWith(<CallsPage />, signedIn(baseRoutes, 'DOCTOR'));
    await openDetails();

    const dialog = await screen.findByRole('dialog');

    /**
     * `recordings: none` for a doctor. Cosmetic, as ever: the API refuses it regardless. The
     * point is not to offer a door the server will not open, and to say why rather than
     * leaving a gap where a player would be.
     */
    expect(within(dialog).getByText(/role cannot play call recordings/)).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('button', { name: 'Play recording' }),
    ).not.toBeInTheDocument();
  });

  it('renders the review controls as present and inert', async () => {
    renderWith(<CallsPage />, signedIn());
    await openDetails();

    const dialog = await screen.findByRole('dialog');

    /**
     * A missing control is a visible difference from the prototype; a working-looking one is
     * a lie. Disabled is neither, and it is the same arrangement as the header's search box.
     */
    for (const label of ['Mark as reviewed', 'Create follow-up']) {
      const control = within(dialog).getByRole('button', { name: new RegExp(label) });
      expect(control).toBeDisabled();
      expect(control).toHaveAttribute('aria-disabled', 'true');
    }
  });

  it('links to the related appointment, and says so when there is none', async () => {
    renderWith(<CallsPage />, signedIn());
    await openDetails();

    expect(
      within(await screen.findByRole('dialog')).getByRole('link', {
        name: 'View related appointment',
      }),
    ).toBeInTheDocument();
  });

  it('says when no appointment is linked rather than linking nowhere', async () => {
    renderWith(
      <CallsPage />,
      signedIn({
        ...baseRoutes,
        'GET /api/v1/calls': {
          body: { items: [{ ...call, appointmentId: null }], nextCursor: null },
        },
        [`GET /api/v1/calls/${CALL_ID}`]: {
          body: { ...callDetail, call: { ...call, appointmentId: null } },
        },
      }),
    );
    await openDetails();

    const dialog = await screen.findByRole('dialog');

    expect(within(dialog).getByText('No appointment is linked to this call.')).toBeInTheDocument();
    expect(
      within(dialog).queryByRole('link', { name: 'View related appointment' }),
    ).not.toBeInTheDocument();
  });

  it('says a transcript is missing rather than showing an empty conversation', async () => {
    renderWith(
      <CallsPage />,
      signedIn({
        ...baseRoutes,
        [`GET /api/v1/calls/${CALL_ID}`]: { body: { ...callDetail, transcript: [] } },
      }),
    );
    await openDetails();

    const dialog = await screen.findByRole('dialog');

    expect(await within(dialog).findByText(/No transcript was stored/)).toBeInTheDocument();
  });
});

describe('the voice agent dashboard', () => {
  const mapped = {
    ...baseRoutes,
    [`GET /api/v1/organisations/${ORGANISATION_ID}`]: {
      body: {
        ...clinic,
        sarvamMapping: {
          sarvamAppId: 'app_fixture',
          sarvamAppVersion: '3',
          sarvamDeploymentId: 'dep_fixture',
          sarvamConnectionId: 'conn_fixture',
          agentPhone: '+918000012345',
          promptVersion: 'v1',
          toolSecretSet: true,
          toolSecretSetAt: '2026-11-01T00:00:00.000Z',
        },
      },
    },
  };

  it('says the agent is not connected when the clinic has no Sarvam mapping', async () => {
    renderWith(<CallsPage />, signedIn());

    // The fixture's overview reports ACTIVE, and that is the point: with no mapping the agent
    // cannot be answering, and "Live" would tell the desk to stop picking up.
    expect(await screen.findByText('Not connected')).toBeInTheDocument();
    expect(screen.queryByText('Live')).not.toBeInTheDocument();
  });

  it('shows a mapped agent as live, with its number and versions', async () => {
    renderWith(<CallsPage />, signedIn(mapped));

    expect(await screen.findByText('Live')).toBeInTheDocument();
    expect(screen.getByText('+91 80000 12345')).toBeInTheDocument();
    expect(screen.getByText('Sarvam app version').nextSibling).toHaveTextContent('3');
  });

  it('works out the booking rate from the same counts the overview shows', async () => {
    renderWith(<CallsPage />, signedIn(mapped));

    // 3 bookings from 6 answered calls.
    expect(await screen.findByText('50%')).toBeInTheDocument();
  });

  it('does not ask for analytics on behalf of a role that may not read them', async () => {
    const stub = signedIn(mapped, 'STAFF');
    renderWith(<CallsPage />, stub);

    expect(await screen.findByText('Call log')).toBeInTheDocument();
    expect(screen.queryByText('Booking rate')).not.toBeInTheDocument();
    expect(stub.calls.requests.some((request) => request.path.includes('/analytics/'))).toBe(false);
  });
});
