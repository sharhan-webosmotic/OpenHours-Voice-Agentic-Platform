import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Route, Routes } from 'react-router';
import { renderWith, stubClient, user } from '../../test-support/harness';
import { baseRoutes, PATIENT_ID, patientDetail, patientList } from '../../test-support/fixtures';
import { PatientsPage } from './PatientsPage';
import { PatientProfilePage } from './PatientProfilePage';

/**
 * The patient screens.
 *
 * Patient data is the most sensitive thing this product holds, so two of these tests are
 * about what is NOT shown: the masked form a platform role sees, and the absence of a write
 * control for a role that may not write.
 */

const signedIn = (
  routes = baseRoutes,
  role: 'CLINIC_OWNER' | 'SUPER_ADMIN' | 'DOCTOR' = 'CLINIC_OWNER',
) => stubClient({ user: user(role), bootSucceeds: true, routes });

describe('the patient list', () => {
  it('shows a patient with their number and both appointment dates', async () => {
    renderWith(<PatientsPage />, signedIn());

    const row = await screen.findByRole('row', { name: /Test Patient One/ });

    // Grouped the way a receptionist reads it out.
    expect(within(row).getByText('+91 98765 43210')).toBeInTheDocument();
    expect(within(row).getByText('1 Oct 2026')).toBeInTheDocument();
    expect(within(row).getByText(/16 Nov 2026/)).toBeInTheDocument();
  });

  it('describes the next visit: when, what, and where it stands', async () => {
    renderWith(<PatientsPage />, signedIn());

    const row = await screen.findByRole('row', { name: /Test Patient One/ });

    // 03:30Z is 09:00 in Kolkata, and a voice booking awaiting confirmation is an AI booking.
    // Waited for: until the clinic loads, the zone is not yet known.
    expect(await within(row).findByText('16 Nov 2026 · 09:00')).toBeInTheDocument();
    expect(within(row).getByText('Consultation')).toBeInTheDocument();
    expect(within(row).getByText('AI Booking')).toBeInTheDocument();
    // A date of birth is a calendar day, never shifted through a zone.
    expect(within(row).getByText(/^14 Jun 1988 · \d+ yrs$/)).toBeInTheDocument();
  });

  it('says plainly when a patient has nothing before or after today', async () => {
    const [only] = patientList.items;
    renderWith(
      <PatientsPage />,
      signedIn({
        ...baseRoutes,
        'GET /api/v1/patients': {
          body: {
            items: [
              {
                ...only!,
                dateOfBirth: null,
                lastAppointmentAt: null,
                nextAppointmentAt: null,
                nextAppointment: null,
              },
            ],
            nextCursor: null,
          },
        },
      }),
    );

    const row = await screen.findByRole('row', { name: /Test Patient One/ });

    expect(within(row).getByText('None yet')).toBeInTheDocument();
    expect(within(row).getByText('Not booked')).toBeInTheDocument();
    expect(within(row).getByText('Date of birth not recorded')).toBeInTheDocument();
  });

  it('heads the directory with the clinic counts, not the length of the page', async () => {
    renderWith(
      <PatientsPage />,
      signedIn({
        ...baseRoutes,
        'GET /api/v1/patients/summary': { body: { registered: 142, upcomingVisits: 6 } },
      }),
    );

    expect(
      await screen.findByRole('heading', { name: '142 registered patients' }),
    ).toBeInTheDocument();
    expect(screen.getByText('upcoming visits')).toBeInTheDocument();
    expect(screen.getByText('6')).toBeInTheDocument();
  });

  it('sends the search to the server rather than filtering what is loaded', async () => {
    const stub = signedIn();
    renderWith(<PatientsPage />, stub);
    await screen.findByRole('row', { name: /Test Patient One/ });

    await userEvent.type(screen.getByLabelText('Search patients'), 'test');

    /**
     * Debounced, so this waits. Local filtering would search only the page that happens to be
     * loaded and would fail to find the patient who is on the telephone.
     */
    await waitFor(() => {
      expect(stub.calls.requests.some((request) => request.path.includes('q=test'))).toBe(true);
    });
  });

  it('distinguishes an empty search from a clinic with no patients', async () => {
    const stub = signedIn({
      ...baseRoutes,
      'GET /api/v1/patients': { body: { items: [], nextCursor: null } },
    });

    renderWith(<PatientsPage />, stub);
    expect(await screen.findByText('No patients yet')).toBeInTheDocument();

    await userEvent.type(screen.getByLabelText('Search patients'), 'nobody');

    expect(await screen.findByText('Nothing matched that search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear the search' })).toBeInTheDocument();
  });

  it('shows a masked patient as hidden rather than as missing data', async () => {
    renderWith(
      <PatientsPage />,
      signedIn(
        {
          ...baseRoutes,
          'GET /api/v1/patients': {
            body: {
              items: [{ ...patientList.items[0], fullName: null, phone: null }],
              nextCursor: null,
            },
          },
        },
        'SUPER_ADMIN',
      ),
    );

    /**
     * A platform role reads patients masked (the matrix says `read: 'masked'`), which the API
     * returns as nulled fields. "Name hidden" says a person exists and is not being shown;
     * an empty cell would read as a record with no name.
     */
    expect(await screen.findByText('Name hidden')).toBeInTheDocument();
    expect(screen.getByText('Hidden')).toBeInTheDocument();
  });

  it('offers no Add Patient to a role that may not write', async () => {
    renderWith(<PatientsPage />, signedIn(baseRoutes, 'SUPER_ADMIN'));

    await screen.findByRole('row', { name: /Name hidden|Test Patient One/ });

    // Cosmetic only: the API refuses the write regardless. The point is not to offer a door
    // the server will not open.
    expect(screen.queryByRole('button', { name: /Add Patient/ })).not.toBeInTheDocument();
  });
});

describe('adding a patient', () => {
  it('validates against the shared schema before sending anything', async () => {
    const stub = signedIn();
    renderWith(<PatientsPage />, stub);

    await userEvent.click(await screen.findByRole('button', { name: /Add Patient/ }));
    await userEvent.type(screen.getByLabelText('Full name'), 'Test Patient Two');
    await userEvent.type(screen.getByLabelText('Phone number'), '12345');
    await userEvent.click(screen.getByRole('button', { name: 'Save patient' }));

    expect(await screen.findByText(/must be a usable phone number/)).toBeInTheDocument();
    expect(stub.calls.requests.some((request) => request.method === 'POST')).toBe(false);
  });

  it('normalises the number to E.164 before it leaves the browser', async () => {
    const stub = signedIn({
      ...baseRoutes,
      'POST /api/v1/patients': { status: 201, body: { patientId: PATIENT_ID } },
    });

    renderWith(<PatientsPage />, stub);

    await userEvent.click(await screen.findByRole('button', { name: /Add Patient/ }));
    await userEvent.type(screen.getByLabelText('Full name'), 'Test Patient Two');
    await userEvent.type(screen.getByLabelText('Phone number'), '98765 43210');
    await userEvent.click(screen.getByRole('button', { name: 'Save patient' }));

    await waitFor(() => {
      const sent = stub.calls.requests.find((request) => request.method === 'POST');
      // +91 applied by the shared schema's own transform, not by anything in the screen.
      expect(sent?.body).toMatchObject({ phone: '+919876543210', fullName: 'Test Patient Two' });
    });
  });

  it('shows a field error the server raised against the field it names', async () => {
    renderWith(
      <PatientsPage />,
      signedIn({
        ...baseRoutes,
        'POST /api/v1/patients': {
          status: 400,
          body: {
            type: 'about:blank',
            title: 'Validation Failed',
            status: 400,
            detail: 'The request is invalid.',
            errors: [{ field: 'body.fullName', message: 'is already in use' }],
          },
        },
      }),
    );

    await userEvent.click(await screen.findByRole('button', { name: /Add Patient/ }));
    await userEvent.type(screen.getByLabelText('Full name'), 'Test Patient Two');
    await userEvent.type(screen.getByLabelText('Phone number'), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: 'Save patient' }));

    // Against the field, not at the top: `body.` is stripped because the form knows its
    // fields by their own names.
    expect(await screen.findByText('is already in use')).toBeInTheDocument();
  });
});

describe('the patient profile', () => {
  /**
   * Rendered THROUGH A ROUTE, not as a bare element.
   *
   * The profile reads its patient id from the path with `useParams`, so a bare render gives it
   * no id, skips the query and spins for ever. Routing it the way the application routes it is
   * also the only way the back link and the id are tested at all.
   */
  const renderProfile = (routes = baseRoutes) =>
    renderWith(
      <Routes>
        <Route path="/patients/:patientId" element={<PatientProfilePage />} />
      </Routes>,
      signedIn(routes),
      [`/patients/${PATIENT_ID}`],
    );

  it('shows the record, the history and the notes', async () => {
    renderProfile();

    expect(await screen.findByText('Test Patient One')).toBeInTheDocument();
    expect(screen.getByText('14 Jun 1988')).toBeInTheDocument();
    expect(screen.getByText('Prefers morning appointments.')).toBeInTheDocument();
    expect(screen.getByText(/16 Nov 2026, 9:00 am/)).toBeInTheDocument();
  });

  it('says follow-ups are unavailable rather than showing an empty list', async () => {
    renderProfile();

    /**
     * The difference matters: an empty list says this patient has no follow-ups, which would
     * be a claim the product cannot support, since there is no follow-up endpoint at all.
     */
    expect(await screen.findByText('Follow-ups are not available yet')).toBeInTheDocument();
  });

  it('says so when the patient has no appointments', async () => {
    renderProfile({
      ...baseRoutes,
      [`GET /api/v1/patients/${PATIENT_ID}`]: { body: { ...patientDetail, appointments: [] } },
    });

    expect(await screen.findByText('No appointments yet.')).toBeInTheDocument();
  });

  it('shows a not-found patient as not found, with a way back', async () => {
    renderProfile({
      ...baseRoutes,
      [`GET /api/v1/patients/${PATIENT_ID}`]: {
        status: 404,
        body: { type: 'about:blank', title: 'Not Found', status: 404, detail: 'Gone.' },
      },
    });

    expect(await screen.findByText('That patient was not found.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to patients' })).toBeInTheDocument();
    // No retry on a 404: the record is not there, and asking again will not change that.
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
  });
});
