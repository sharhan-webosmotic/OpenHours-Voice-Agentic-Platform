import { beforeEach, describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ApiError } from '@clinicai/api-client';
import type { ClinicDetailView, OrganisationPage } from '@clinicai/api-client';
import { renderWith, stubClient, user } from '../../test-support/harness';
import { AppRoutes } from '../../app/routes';

/**
 * The clinic screens: list, create and edit.
 *
 * THE API MODULE IS MOCKED, not the network. What these tests assert is how the interface
 * behaves given an answer from the server: which state appears, what the form sends, what a
 * refusal looks like. Modelling HTTP to produce those answers would put a layer between the
 * test and the thing being checked, and the client's own suite already covers the transport.
 *
 * The tests render the whole route tree rather than a page in isolation, so the permission
 * guards and the lazy chunks are exercised too: a page that renders correctly but is
 * unreachable, or reachable by a role that should not have it, is the defect worth catching.
 */

const list = vi.fn();
const get = vi.fn();
const create = vi.fn();
const update = vi.fn();
const saveProfile = vi.fn();
const saveHours = vi.fn();
const saveTelephony = vi.fn();
const saveFaqs = vi.fn();
const saveBookingPolicy = vi.fn();
const saveAgentProfile = vi.fn();
const saveSarvamMapping = vi.fn();
const createService = vi.fn();
const updateService = vi.fn();
const createDoctor = vi.fn();
const updateDoctor = vi.fn();

vi.mock('../../lib/clinicsApi', () => ({
  clinicsApi: {
    list: (...args: unknown[]) => list(...args) as Promise<OrganisationPage>,
    get: (...args: unknown[]) => get(...args) as Promise<ClinicDetailView>,
    create: (...args: unknown[]) => create(...args) as Promise<unknown>,
    update: (...args: unknown[]) => update(...args) as Promise<void>,
    saveProfile: (...args: unknown[]) => saveProfile(...args) as Promise<void>,
    saveHours: (...args: unknown[]) => saveHours(...args) as Promise<void>,
    saveBookingPolicy: (...args: unknown[]) => saveBookingPolicy(...args) as Promise<void>,
    saveAgentProfile: (...args: unknown[]) => saveAgentProfile(...args) as Promise<void>,
    saveTelephony: (...args: unknown[]) => saveTelephony(...args) as Promise<void>,
    saveFaqs: (...args: unknown[]) => saveFaqs(...args) as Promise<void>,
    saveSarvamMapping: (...args: unknown[]) => saveSarvamMapping(...args) as Promise<unknown>,
    createService: (...args: unknown[]) => createService(...args) as Promise<unknown>,
    updateService: (...args: unknown[]) => updateService(...args) as Promise<void>,
    createDoctor: (...args: unknown[]) => createDoctor(...args) as Promise<unknown>,
    updateDoctor: (...args: unknown[]) => updateDoctor(...args) as Promise<void>,
  },
}));

const CLINIC_ID = '0193f0a0-0000-7000-8000-000000000001';

const summary = (overrides: Record<string, unknown> = {}) => ({
  id: CLINIC_ID,
  name: 'Sunrise Dental',
  timezone: 'Asia/Kolkata',
  status: 'ACTIVE' as const,
  clinicPhone: '+919876543210',
  createdAt: '2026-10-01T00:00:00.000Z',
  ...overrides,
});

/** A clinic with nothing collected beyond what creation sets: the common starting state. */
const detail = (overrides: Partial<ClinicDetailView> = {}): ClinicDetailView => ({
  organisation: {
    ...summary(),
    openingHoursCollectedAt: null,
    recordingRetentionDays: 90,
  },
  profile: {
    legalName: null,
    contactEmail: null,
    contactPhone: '+919876543210',
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    country: 'IN',
    mapUrl: null,
  },
  hours: [
    { weekday: 'MONDAY', segments: [] },
    { weekday: 'TUESDAY', segments: [] },
    { weekday: 'WEDNESDAY', segments: [] },
    { weekday: 'THURSDAY', segments: [] },
    { weekday: 'FRIDAY', segments: [] },
    { weekday: 'SATURDAY', segments: [] },
    { weekday: 'SUNDAY', segments: [] },
  ],
  bookingPolicy: {
    slotGranularityMinutes: null,
    minimumNoticeMinutes: null,
    maximumAdvanceDays: null,
    cancellationWindowHours: null,
    acceptsNewPatients: null,
    defaultBufferMinutes: null,
    maxPerSlot: null,
    noShowPolicy: null,
  },
  agentProfile: {
    greeting: null,
    languages: [],
    tone: null,
    fullyBookedResponse: null,
    escalationRules: null,
    neverPromise: [],
  },
  telephony: {
    recordingConsentMode: null,
    consentAnnouncement: null,
    consentConfirmed: false,
    consentConfirmedAt: null,
    consentConfirmedByName: null,
  },
  faqs: [],
  services: [],
  doctors: [],
  sarvamMapping: {
    sarvamAppId: null,
    sarvamAppVersion: null,
    sarvamDeploymentId: null,
    sarvamConnectionId: null,
    agentPhone: null,
    promptVersion: 'v0-placeholder',
    toolSecretSet: false,
    toolSecretSetAt: null,
  },
  // The console's shape: an agent row and nothing in it, which the server calls not configured.
  voiceAgent: {
    state: 'NOT_CONFIGURED',
    missing: ['SARVAM_APP', 'SARVAM_DEPLOYMENT', 'AGENT_NUMBER', 'TOOL_SECRET', 'WEBHOOK_SECRET'],
  },
  readiness: {
    ready: false,
    satisfiedCount: 3,
    totalCount: 21,
    incompleteSections: ['hours', 'services', 'doctors', 'sarvamMapping'],
    missing: [
      { key: 'hours.collected', section: 'hours', label: 'Opening hours asked about' },
      { key: 'services.atLeastOne', section: 'services', label: 'At least one active service' },
      { key: 'doctors.atLeastOne', section: 'doctors', label: 'At least one active doctor' },
      {
        key: 'sarvamMapping.toolSecret',
        section: 'sarvamMapping',
        label: 'Per-clinic tool secret generated',
      },
    ],
  },
  ...overrides,
});

const asSuperAdmin = () => stubClient({ user: user('SUPER_ADMIN'), bootSucceeds: true });
const asInternalAdmin = () => stubClient({ user: user('INTERNAL_ADMIN'), bootSucceeds: true });

beforeEach(() => {
  vi.clearAllMocks();
  list.mockResolvedValue({ items: [summary()], nextCursor: null });
  get.mockResolvedValue(detail());
});

describe('the clinic list', () => {
  it('shows each clinic with its status, number and created date', async () => {
    renderWith(<AppRoutes />, asSuperAdmin(), ['/clinics']);

    const row = await screen.findByRole('row', { name: /Sunrise Dental/ });

    expect(within(row).getByText('active')).toBeInTheDocument();
    expect(within(row).getByText('+919876543210')).toBeInTheDocument();
  });

  it('says so, and offers the next step, when there are no clinics at all', async () => {
    list.mockResolvedValue({ items: [], nextCursor: null });

    renderWith(<AppRoutes />, asSuperAdmin(), ['/clinics']);

    expect(await screen.findByText('No clinics yet')).toBeInTheDocument();
    // An empty state that names the next action, rather than one that reads as a fault.
    expect(screen.getByRole('button', { name: 'Add the first clinic' })).toBeInTheDocument();
  });

  it('distinguishes an empty search from an empty platform', async () => {
    renderWith(<AppRoutes />, asSuperAdmin(), ['/clinics']);
    await screen.findByRole('row', { name: /Sunrise Dental/ });

    list.mockResolvedValue({ items: [], nextCursor: null });
    await userEvent.type(screen.getByLabelText('Search'), 'nothing matches this');

    // The two need different next actions, so they must not share one message.
    expect(await screen.findByText('Nothing matched that search')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Clear the search' })).toBeInTheDocument();
  });

  it('searches, and sends the term to the server rather than filtering locally', async () => {
    renderWith(<AppRoutes />, asSuperAdmin(), ['/clinics']);
    await screen.findByRole('row', { name: /Sunrise Dental/ });

    await userEvent.type(screen.getByLabelText('Search'), 'sunrise');

    // Debounced, so this is awaited rather than asserted immediately.
    await waitFor(() => {
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ q: 'sunrise' }));
    });
  });

  it('pages forward with the cursor the server returned', async () => {
    list.mockResolvedValue({ items: [summary()], nextCursor: 'cursor-2' });

    renderWith(<AppRoutes />, asSuperAdmin(), ['/clinics']);
    await screen.findByRole('row', { name: /Sunrise Dental/ });

    await userEvent.click(screen.getByRole('button', { name: 'Next' }));

    await waitFor(() => {
      expect(list).toHaveBeenCalledWith(expect.objectContaining({ cursor: 'cursor-2' }));
    });

    /**
     * Previous is only available once there is somewhere to go back to.
     *
     * Awaited rather than asserted immediately, because the pager disables both buttons
     * while a page is in flight, and the `waitFor` above settles when the request was SENT.
     * Under the query client this used to replace, the fetch had resolved by then; RTK Query
     * keeps `isFetching` true for a tick longer. The property under test is the same.
     */
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Previous' })).toBeEnabled();
    });
  });

  it('offers a retry when the list fails', async () => {
    list.mockRejectedValue(new Error('the network went away'));

    renderWith(<AppRoutes />, asSuperAdmin(), ['/clinics']);

    expect(await screen.findByText(/the network went away/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Try again' })).toBeInTheDocument();
  });

  it('offers the add control to both platform roles, which the matrix grants', async () => {
    /**
     * Both of them, and this test exists because the first version of it asserted the
     * opposite. The matrix gives `organisations` rwd to SUPER_ADMIN and rw to
     * INTERNAL_ADMIN, so creating a clinic is open to both, and no role that reaches this
     * console is denied it. Asserting a denial here would have been asserting a cell that
     * does not exist.
     */
    renderWith(<AppRoutes />, asInternalAdmin(), ['/clinics']);
    await screen.findByRole('row', { name: /Sunrise Dental/ });

    expect(screen.getByRole('link', { name: 'Add clinic' })).toBeInTheDocument();
  });
});

describe('creating a clinic', () => {
  it('sends the three fields and goes to the clinic it created', async () => {
    create.mockResolvedValue({ organisationId: CLINIC_ID, name: 'Sunrise Dental' });

    renderWith(<AppRoutes />, asSuperAdmin(), ['/clinics/new']);

    await userEvent.type(await screen.findByLabelText('Clinic name'), 'Sunrise Dental');
    await userEvent.clear(screen.getByLabelText('Time zone'));
    await userEvent.type(screen.getByLabelText('Time zone'), 'Asia/Kolkata');
    await userEvent.type(screen.getByLabelText('Clinic phone number'), '98765 43210');

    await userEvent.click(screen.getByRole('button', { name: 'Create clinic' }));

    await waitFor(() => {
      expect(create).toHaveBeenCalledWith({
        name: 'Sunrise Dental',
        timezone: 'Asia/Kolkata',
        // Normalised by the shared schema before it is sent, not left to the server.
        clinicPhone: '+919876543210',
      });
    });

    // Lands on the clinic, which is where the configuration work continues.
    expect(await screen.findByRole('heading', { name: 'Sunrise Dental' })).toBeInTheDocument();
  });

  it('refuses an unusable phone number and a bad time zone without calling the server', async () => {
    renderWith(<AppRoutes />, asSuperAdmin(), ['/clinics/new']);

    await userEvent.type(await screen.findByLabelText('Clinic name'), 'Sunrise Dental');
    await userEvent.clear(screen.getByLabelText('Time zone'));
    // `IST` is accepted by Intl and resolves to a zone with no daylight rules, which is
    // exactly why the schema refuses it.
    await userEvent.type(screen.getByLabelText('Time zone'), 'IST');
    await userEvent.type(screen.getByLabelText('Clinic phone number'), '12345');

    await userEvent.click(screen.getByRole('button', { name: 'Create clinic' }));

    expect(await screen.findByText(/IANA time zone name/)).toBeInTheDocument();
    expect(screen.getByText(/usable phone number/)).toBeInTheDocument();
    expect(create).not.toHaveBeenCalled();
  });

  it('shows the conflict when a clinic with that name already exists', async () => {
    create.mockRejectedValue(
      new ApiError({
        type: 'https://clinicai.health/problems/conflict',
        title: 'Conflict',
        status: 409,
        detail: 'A clinic with that phone number already exists.',
      }),
    );

    renderWith(<AppRoutes />, asSuperAdmin(), ['/clinics/new']);

    await userEvent.type(await screen.findByLabelText('Clinic name'), 'Sunrise Dental');
    await userEvent.type(screen.getByLabelText('Clinic phone number'), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: 'Create clinic' }));

    expect(await screen.findByText(/already exists/)).toBeInTheDocument();
  });

  it('puts a server field error on the field it belongs to', async () => {
    create.mockRejectedValue(
      new ApiError({
        type: 'https://clinicai.health/problems/validation-failed',
        title: 'Validation Failed',
        status: 400,
        detail: 'The request is invalid.',
        errors: [{ field: 'body.name', message: 'That name is reserved.' }],
      }),
    );

    renderWith(<AppRoutes />, asSuperAdmin(), ['/clinics/new']);

    await userEvent.type(await screen.findByLabelText('Clinic name'), 'Sunrise Dental');
    await userEvent.type(screen.getByLabelText('Clinic phone number'), '9876543210');
    await userEvent.click(screen.getByRole('button', { name: 'Create clinic' }));

    // The `body.` prefix is stripped so the error lands on the form's own field rather
    // than being shown as an unattributed message.
    expect(await screen.findByText('That name is reserved.')).toBeInTheDocument();
  });

  it('is unreachable by a clinic role, which belongs in the other application', async () => {
    /**
     * No clinic role reaches any page in this console: `permits` requires a platform role
     * as well as the matrix cell (D-010). A CLINIC_OWNER has `organisations` read in the
     * matrix, which means their OWN clinic, and that is not access to the platform-wide
     * screens this console shows.
     */
    renderWith(<AppRoutes />, stubClient({ user: user('CLINIC_OWNER'), bootSucceeds: true }), [
      '/clinics/new',
    ]);

    expect(await screen.findByRole('heading', { name: 'No access' })).toBeInTheDocument();
  });
});

describe('the clinic detail page', () => {
  it('shows every section and what is still missing before go-live', async () => {
    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);

    expect(await screen.findByRole('heading', { name: 'Sunrise Dental' })).toBeInTheDocument();

    for (const section of [
      'Clinic',
      'Identity and address',
      'Opening hours',
      'Services',
      'Doctors',
      'Booking policy',
      'Agent behaviour',
      'Frequently asked answers',
      'Recording and consent',
      'Sarvam mapping',
    ]) {
      expect(screen.getByRole('heading', { name: section })).toBeInTheDocument();
    }

    expect(screen.getByText('Not ready')).toBeInTheDocument();
    expect(screen.getByText('3 of 21')).toBeInTheDocument();
    // Each gap is named in the clinic's language and links to the form that closes it.
    expect(screen.getByRole('link', { name: 'At least one active service' })).toHaveAttribute(
      'href',
      '#services',
    );
  });

  it('saves a section and reports it', async () => {
    saveProfile.mockResolvedValue(undefined);

    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Identity and address' });

    await userEvent.type(screen.getByLabelText('Address line 1'), '12 MG Road');
    await userEvent.type(screen.getByLabelText('City'), 'Bengaluru');
    await userEvent.click(screen.getByRole('button', { name: /Save identity and address/i }));

    await waitFor(() => {
      expect(saveProfile).toHaveBeenCalledWith(
        CLINIC_ID,
        expect.objectContaining({ addressLine1: '12 MG Road', city: 'Bengaluru' }),
      );
    });

    expect(await screen.findByText('Profile saved.')).toBeInTheDocument();
  });

  it('normalises a phone number in a section before sending it', async () => {
    saveProfile.mockResolvedValue(undefined);

    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Identity and address' });

    const phone = screen.getByLabelText('Contact phone');
    await userEvent.clear(phone);
    await userEvent.type(phone, '098765 43211');
    await userEvent.click(screen.getByRole('button', { name: /Save identity and address/i }));

    await waitFor(() => {
      // The trunk zero is dialling notation, not part of the number.
      expect(saveProfile).toHaveBeenCalledWith(
        CLINIC_ID,
        expect.objectContaining({ contactPhone: '+919876543211' }),
      );
    });
  });

  it('refuses an invalid section without calling the server', async () => {
    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Identity and address' });

    await userEvent.type(screen.getByLabelText('Map link'), 'http://maps.example/clinic');
    await userEvent.click(screen.getByRole('button', { name: /Save identity and address/i }));

    expect(await screen.findByText(/must be an https:\/\/ URL/)).toBeInTheDocument();
    expect(saveProfile).not.toHaveBeenCalled();
  });

  it('says the opening hours have never been collected, which is not the same as closed', async () => {
    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);

    expect(await screen.findByText(/never been saved/)).toBeInTheDocument();
  });

  it('sends all seven weekdays, including the closed ones, when hours are saved', async () => {
    saveHours.mockResolvedValue(undefined);

    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Opening hours' });

    // Open Monday, leave the rest closed. Each checkbox names its day, so this is
    // unambiguous: seven controls all called "Closed" would be as unusable for a screen
    // reader as they were for this query.
    await userEvent.click(screen.getByRole('checkbox', { name: 'Monday closed' }));

    await userEvent.click(screen.getByRole('button', { name: /Save opening hours/i }));

    await waitFor(() => {
      expect(saveHours).toHaveBeenCalled();
    });

    const payload = saveHours.mock.calls[0]?.[1] as { days: readonly { weekday: string }[] };

    // All seven, so a weekly off is a stated answer rather than an absent one.
    expect(payload.days).toHaveLength(7);
    expect(payload.days.map((day) => day.weekday)).toEqual([
      'MONDAY',
      'TUESDAY',
      'WEDNESDAY',
      'THURSDAY',
      'FRIDAY',
      'SATURDAY',
      'SUNDAY',
    ]);
  });

  it('adding a break produces a schedule that saves, rather than one the schema refuses', async () => {
    saveHours.mockResolvedValue(undefined);

    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Opening hours' });

    /**
     * THIS IS A REGRESSION TEST FOR A DEFECT A BROWSER FOUND AND JSDOM DID NOT.
     *
     * "Add a break" used to append 17:00-20:00 after the default 09:00-17:00. Those two
     * touch, the schema refuses touching segments as one opening written as two, and so the
     * primary way to add a break failed on its first click. It now splits the opening
     * instead, which is both valid and what the button means.
     */
    await userEvent.click(screen.getByRole('checkbox', { name: 'Monday closed' }));
    await userEvent.click(screen.getAllByRole('button', { name: 'Add a break' })[0]!);
    await userEvent.click(screen.getByRole('button', { name: /Save opening hours/i }));

    await waitFor(() => {
      expect(saveHours).toHaveBeenCalled();
    });

    // Saved, not refused. The assertion that matters is the absence of the schema's message.
    expect(screen.queryByText(/must not overlap or touch/)).not.toBeInTheDocument();
    expect(await screen.findByText('Opening hours saved.')).toBeInTheDocument();

    const payload = saveHours.mock.calls[0]?.[1] as {
      days: readonly {
        weekday: string;
        segments: readonly { opensAtMinute: number; closesAtMinute: number }[];
      }[];
    };
    const monday = payload.days.find((day) => day.weekday === 'MONDAY');

    // Two openings with a real gap between them, which is what a break is.
    expect(monday?.segments).toHaveLength(2);
    const [morning, afternoon] = monday?.segments ?? [];
    expect(afternoon!.opensAtMinute).toBeGreaterThan(morning!.closesAtMinute);
  });

  it('leaves an unanswered question unanswered, rather than storing it as "no"', async () => {
    saveBookingPolicy.mockResolvedValue(undefined);

    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Booking policy' });

    /**
     * REGRESSION TEST FOR A DEFECT THE RENDERED PROMPT EXPOSED.
     *
     * "Accepting new patients" is tri-state: not asked, yes, no. React Hook Form hands the
     * STORED value to `setValueAs` when a control has never been touched, so an uncollected
     * `null` fell past the empty-string test and `null === 'true'` produced `false`. The
     * clinic was stored as NOT accepting new patients, and the prompt then instructed the
     * agent to tell callers so. Nobody had answered the question.
     */
    await userEvent.type(screen.getByLabelText('Slot length, in minutes'), '15');
    await userEvent.click(screen.getByRole('button', { name: /Save booking policy/i }));

    await waitFor(() => {
      expect(saveBookingPolicy).toHaveBeenCalled();
    });

    const payload = saveBookingPolicy.mock.calls[0]?.[1] as { acceptsNewPatients: unknown };

    // Null, not false. The difference is what the agent says to a patient.
    expect(payload.acceptsNewPatients).toBeNull();
  });

  it('still records a deliberate "no" as a real answer', async () => {
    saveBookingPolicy.mockResolvedValue(undefined);

    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Booking policy' });

    // The other half of the fix: choosing "No" must still mean no.
    await userEvent.selectOptions(screen.getByLabelText('Accepting new patients'), 'false');
    await userEvent.click(screen.getByRole('button', { name: /Save booking policy/i }));

    await waitFor(() => {
      expect(saveBookingPolicy).toHaveBeenCalled();
    });

    const payload = saveBookingPolicy.mock.calls[0]?.[1] as { acceptsNewPatients: unknown };
    expect(payload.acceptsNewPatients).toBe(false);
  });

  it('shows a not-found message rather than an empty page for a clinic it cannot reach', async () => {
    get.mockRejectedValue(
      new ApiError({
        type: 'https://clinicai.health/problems/not-found',
        title: 'Not Found',
        status: 404,
        detail: 'That clinic was not found.',
      }),
    );

    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);

    expect(await screen.findByText('That clinic was not found.')).toBeInTheDocument();
    // No retry on a 404: the answer will not change, and a retry button invites a user to
    // keep pressing it.
    expect(screen.queryByRole('button', { name: 'Try again' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Back to the clinic list' })).toBeInTheDocument();
  });
});

describe('what an internal admin may change', () => {
  it('can edit clinic settings and cannot edit services or doctors', async () => {
    renderWith(<AppRoutes />, asInternalAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Sunrise Dental' });

    // `clinic_settings` is rw for INTERNAL_ADMIN, so the settings sections save.
    expect(screen.getByRole('button', { name: /Save identity and address/i })).toBeInTheDocument();

    /**
     * `doctors_services_hours` is read-only for INTERNAL_ADMIN in the matrix, and the brief
     * accepted that for the pilot rather than widening the cell. So the section is readable
     * and says plainly that this role cannot change it, instead of showing a form whose
     * submit the API would refuse.
     */
    expect(screen.queryByRole('button', { name: 'Add service' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Add doctor' })).not.toBeInTheDocument();
    expect(
      screen.getAllByText(/Your role can read this section but not change it/).length,
    ).toBeGreaterThan(0);
  });

  it('can change the clinic name and status, which the matrix does grant', async () => {
    renderWith(<AppRoutes />, asInternalAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Clinic' });

    // `organisations` is rw for INTERNAL_ADMIN, so this section is editable. Only delete
    // is withheld, and nothing in this feature deletes a clinic.
    expect(screen.getByRole('button', { name: /Save clinic/i })).toBeInTheDocument();
  });
});

describe('the Sarvam tool secret', () => {
  it('shows the generated secret once, with a warning that it cannot be shown again', async () => {
    saveSarvamMapping.mockResolvedValue({ toolSecret: 'tool-secret-value-shown-once' });

    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Sarvam mapping' });

    await userEvent.type(screen.getByLabelText('Sarvam app id'), 'app_123');
    await userEvent.click(screen.getByRole('button', { name: /Save sarvam mapping/i }));

    expect(await screen.findByText('tool-secret-value-shown-once')).toBeInTheDocument();
    expect(screen.getByText(/shown once/i)).toBeInTheDocument();
    // Saved without asking to regenerate: a first save mints one, and an ordinary save
    // must not.
    expect(saveSarvamMapping).toHaveBeenCalledWith(CLINIC_ID, expect.anything(), false);
  });

  it('asks for confirmation before regenerating, because it breaks the live agent', async () => {
    get.mockResolvedValue(
      detail({
        sarvamMapping: {
          sarvamAppId: 'app_123',
          sarvamAppVersion: '1',
          sarvamDeploymentId: 'dep_123',
          sarvamConnectionId: 'conn_123',
          agentPhone: '+919000000001',
          promptVersion: 'v0-placeholder',
          toolSecretSet: true,
          toolSecretSetAt: '2026-10-03T00:00:00.000Z',
        },
      }),
    );

    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Sarvam mapping' });

    await userEvent.click(screen.getByRole('button', { name: 'Regenerate the tool secret' }));

    // Nothing is sent on the first click: the warning names the consequence first.
    expect(saveSarvamMapping).not.toHaveBeenCalled();
    expect(
      screen.getByText(/tool calls will fail until the new value is pasted/i),
    ).toBeInTheDocument();

    saveSarvamMapping.mockResolvedValue({ toolSecret: 'a-new-secret' });
    await userEvent.click(screen.getByRole('button', { name: 'Regenerate it' }));

    await waitFor(() => {
      expect(saveSarvamMapping).toHaveBeenCalledWith(CLINIC_ID, expect.anything(), true);
    });

    expect(await screen.findByText('a-new-secret')).toBeInTheDocument();
  });

  it('never shows a secret for a mapping that already has one', async () => {
    get.mockResolvedValue(
      detail({
        sarvamMapping: {
          sarvamAppId: 'app_123',
          sarvamAppVersion: null,
          sarvamDeploymentId: null,
          sarvamConnectionId: null,
          agentPhone: null,
          promptVersion: 'v0-placeholder',
          toolSecretSet: true,
          toolSecretSetAt: '2026-10-03T00:00:00.000Z',
        },
      }),
    );

    renderWith(<AppRoutes />, asSuperAdmin(), [`/clinics/${CLINIC_ID}`]);
    await screen.findByRole('heading', { name: 'Sarvam mapping' });

    // Only that one exists and when it was set. The value is unrecoverable by design.
    expect(screen.getByText(/The value itself cannot be shown again/)).toBeInTheDocument();
  });
});
