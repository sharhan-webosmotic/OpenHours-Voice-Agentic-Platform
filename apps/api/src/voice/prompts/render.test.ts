import { describe, expect, it } from 'vitest';
import { clinicReadiness, type ReadinessInput } from '@clinicai/shared';
import type { ClinicConfiguration } from '../../modules/organisations/organisations.repository.js';
import { buildPromptValues, renderClinicPrompt } from './render.js';
import {
  DEFAULT_PROMPT_VERSION,
  PROMPT_PLACEHOLDERS,
  UnknownPromptVersion,
  findPromptVersion,
  renderPromptTemplate,
} from './registry.js';

/**
 * The prompt renderer.
 *
 * THE MOST IMPORTANT TEST IN THIS FILE is the one asserting that availability never reaches
 * the prompt. Everything else here is formatting. That one is the clinical-safety property:
 * a prompt is a snapshot taken when somebody last pasted it into Sarvam, and an agent that
 * answers "yes, Tuesday at three is free" from a snapshot sends a patient to an appointment
 * that was taken an hour ago.
 *
 * The second most important is that an uncollected field renders as an explicit statement
 * that it is unknown. A blank line is something the model fills in for itself.
 */

const configuration = (overrides: Partial<ClinicConfiguration> = {}): ClinicConfiguration => ({
  organisation: {
    id: '0193f0a0-0000-7000-8000-000000000001',
    name: 'Sunrise Dental',
    timezone: 'Asia/Kolkata',
    status: 'ACTIVE',
    openingHoursCollectedAt: new Date('2026-10-01T00:00:00.000Z'),
    recordingRetentionDays: 90,
    createdAt: new Date('2026-09-01T00:00:00.000Z'),
  },
  clinicPhone: '+919876543210',
  profile: {
    legalName: 'Sunrise Dental Private Limited',
    contactEmail: 'desk@sunrise.test',
    contactPhone: '+919876543210',
    website: 'https://sunrise.test',
    addressLine1: '12 MG Road',
    addressLine2: null,
    city: 'Bengaluru',
    state: 'Karnataka',
    postalCode: '560001',
    country: 'IN',
    mapUrl: 'https://maps.sunrise.test/clinic',
  },
  hours: [
    { weekday: 'MONDAY', opensAtMinute: 540, closesAtMinute: 780 },
    { weekday: 'MONDAY', opensAtMinute: 1020, closesAtMinute: 1200 },
    { weekday: 'TUESDAY', opensAtMinute: 540, closesAtMinute: 1080 },
  ],
  bookingPolicy: {
    slotGranularityMinutes: 15,
    minimumNoticeMinutes: 60,
    maximumAdvanceDays: 60,
    cancellationWindowHours: 24,
    acceptsNewPatients: true,
    defaultBufferMinutes: 5,
    maxPerSlot: 1,
    noShowPolicy: 'A second missed appointment is discussed with the practice manager.',
  },
  agentProfile: {
    greeting: 'Thank you for calling Sunrise Dental.',
    languages: ['en-IN', 'hi-IN'],
    tone: 'FRIENDLY',
    fullyBookedResponse: 'I can take your number and have the desk call you back.',
    escalationRules: 'Transfer anything clinical to the front desk.',
    neverPromise: ['Never say a doctor will definitely be available.'],
  },
  telephony: {
    recordingConsentMode: 'ANNOUNCEMENT',
    consentAnnouncement: 'This call is recorded to help us improve our service.',
    consentConfirmedAt: new Date('2026-10-02T00:00:00.000Z'),
    consentConfirmedByName: 'Practice Manager',
  },
  faqs: [
    {
      id: 'faq-1',
      question: 'Do you have parking?',
      answer: 'Yes, behind the building.',
      sortOrder: 0,
      active: true,
    },
    {
      id: 'faq-2',
      question: 'Do you take walk-ins?',
      answer: 'Only before 11am.',
      sortOrder: 1,
      active: false,
    },
  ],
  services: [
    { id: 's1', name: 'Cleaning', durationMinutes: 30, priceMinor: 150_000, active: true },
    { id: 's2', name: 'Retired Service', durationMinutes: 30, priceMinor: null, active: false },
  ],
  doctors: [
    {
      id: 'd1',
      fullName: 'Dr Asha Rao',
      specialty: 'Orthodontics',
      bufferMinutes: 5,
      active: true,
    },
    { id: 'd2', fullName: 'Dr Retired', specialty: null, bufferMinutes: 0, active: false },
  ],
  sarvamMapping: {
    sarvamAppId: 'app_123',
    sarvamAppVersion: '1',
    sarvamDeploymentId: 'dep_123',
    sarvamConnectionId: 'conn_123',
    agentPhone: '+919000000001',
    promptVersion: DEFAULT_PROMPT_VERSION,
    toolSecretSet: true,
    toolSecretSetAt: new Date('2026-10-03T00:00:00.000Z'),
    agentActive: true,
    webhookSecretSet: true,
    webhookSecretSetAt: new Date('2026-10-03T00:00:00.000Z'),
  },
  ...overrides,
});

const readiness = (overrides: Partial<ReadinessInput> = {}) =>
  clinicReadiness({
    name: 'Sunrise Dental',
    timezone: 'Asia/Kolkata',
    clinicPhone: '+919876543210',
    addressLine1: '12 MG Road',
    city: 'Bengaluru',
    hoursCollected: true,
    openWeekdays: ['MONDAY'],
    activeServiceCount: 1,
    activeDoctorCount: 1,
    slotGranularityMinutes: 15,
    maximumAdvanceDays: 60,
    greeting: 'Thank you for calling.',
    languageCount: 1,
    fullyBookedResponse: 'I will take a message.',
    escalationRules: 'Transfer clinical questions.',
    recordingConsentMode: 'ANNOUNCEMENT',
    consentConfirmed: true,
    sarvamAppId: 'app_123',
    sarvamDeploymentId: 'dep_123',
    agentPhone: '+919000000001',
    toolSecretSet: true,
    promptVersion: DEFAULT_PROMPT_VERSION,
    ...overrides,
  });

const render = (overrides: Partial<ClinicConfiguration> = {}): string =>
  renderClinicPrompt(configuration(overrides), readiness(), DEFAULT_PROMPT_VERSION).text;

describe('what must never reach the prompt', () => {
  it('never states that any time is available', () => {
    const text = render();

    /**
     * The prompt may only ever tell the agent to CHECK. These phrasings are the ones a
     * renderer would produce if somebody later decided to bake today's free slots in,
     * which is the change this test exists to break.
     */
    expect(text).not.toMatch(/available at \d/i);
    expect(text).not.toMatch(/free (slot|at)/i);
    expect(text).not.toMatch(/next appointment is/i);
    expect(text).toMatch(/do not know which appointment slots are free/i);
    expect(text).toMatch(/never state or imply that a particular time is free/i);
  });

  it('tells the agent to use its tools for availability rather than these instructions', () => {
    // Whitespace-tolerant, because the template is hard-wrapped prose and the sentence
    // runs across a line break. Matching the literal spacing would make every reflow of
    // the wording a test failure.
    expect(render().replace(/\s+/g, ' ')).toMatch(/use the tools you have been given/i);
  });

  it('contains no phone number except the clinic\u2019s own', () => {
    /**
     * A prompt is pasted into a provider's console by hand and lives in that provider's
     * configuration, which is not a place patient data may go.
     *
     * Asserted by collecting EVERY number in the output and checking each against the
     * clinic's own, rather than by a regex with a lookahead. The first version of this
     * test tried `/\+91\d{10}(?!.*human)/` to allow the clinic's line, and it could not
     * work: "human" appears before the number on that line, not after it. A test that
     * cannot distinguish the thing it is allowing from the thing it is forbidding is worse
     * than no test, because it reports green for the wrong reason.
     */
    const text = render();
    const numbers = new Set([...text.matchAll(/\+\d{8,15}/g)].map((match) => match[0]));

    expect(numbers).toEqual(new Set(['+919876543210']));
    expect(text).not.toMatch(/patient name/i);
    expect(text).not.toMatch(/date of birth/i);
  });

  it('never contains the tool secret or any provider id', () => {
    const text = render();

    // The mapping identifies the agent to us; the agent does not need to be told its own
    // app id, and a prompt is a document people paste around.
    expect(text).not.toContain('app_123');
    expect(text).not.toContain('dep_123');
    expect(text).not.toContain('conn_123');
  });
});

describe('what is baked in', () => {
  it('states the opening hours per weekday, with the break and the closed days', () => {
    const text = render();

    // Two segments render as one line with both windows, which is how a lunch break reads
    // out loud.
    expect(text).toMatch(/Monday: 09:00 to 13:00, and again 17:00 to 20:00/);
    expect(text).toMatch(/Tuesday: 09:00 to 18:00/);
    // A weekday with no segments is explicitly closed, not omitted.
    expect(text).toMatch(/Sunday: closed/);
    expect(text).toMatch(/Saturday: closed/);
  });

  it('distinguishes hours never collected from a clinic that is closed', () => {
    const text = render({
      organisation: { ...configuration().organisation, openingHoursCollectedAt: null },
      hours: [],
    });

    // Not "closed every day", which would be the agent asserting something nobody said.
    expect(text).toMatch(/have not been collected/i);
    expect(text).toMatch(/do not state any opening hours/i);
    expect(text).not.toMatch(/Monday: closed/);
  });

  it('lists only active services and doctors', () => {
    const text = render();

    expect(text).toContain('Cleaning: 30 minutes');
    expect(text).toContain('Dr Asha Rao, Orthodontics');
    // Switched off means not offered, so it must not appear at all.
    expect(text).not.toContain('Retired Service');
    expect(text).not.toContain('Dr Retired');
  });

  it('converts a price from minor units and refuses to quote one that is not recorded', () => {
    const text = render({
      services: [
        { id: 's1', name: 'Cleaning', durationMinutes: 30, priceMinor: 150_000, active: true },
        { id: 's2', name: 'Whitening', durationMinutes: 45, priceMinor: null, active: true },
      ],
    });

    // 150000 paise is 1500 rupees. Money is stored in integer minor units and converted
    // only at the edges, and this is an edge.
    expect(text).toContain('approximately 1500 rupees');
    expect(text).toMatch(/Whitening: 45 minutes, price not recorded, so do not quote one/);
  });

  it('includes only the active frequently asked answers, verbatim', () => {
    const text = render();

    expect(text).toContain('Yes, behind the building.');
    expect(text).not.toContain('Only before 11am.');
  });

  it('reproduces the consent announcement word for word', () => {
    const text = render();

    // The point of storing the exact words is that the caller hears those words.
    expect(text).toContain('"This call is recorded to help us improve our service."');
  });

  it('tells the agent calls are not recorded when that is the decision', () => {
    const text = render({
      telephony: {
        recordingConsentMode: 'NOT_RECORDED',
        consentAnnouncement: null,
        consentConfirmedAt: new Date('2026-10-02T00:00:00.000Z'),
        consentConfirmedByName: 'Practice Manager',
      },
    });

    expect(text).toMatch(/calls are not recorded/i);
  });

  it('says nothing about recording when the arrangement is undecided', () => {
    const text = render({ telephony: null });

    expect(text).toMatch(/has not been decided/i);
    expect(text).toMatch(/do not tell the caller anything about recording/i);
  });

  it('renders the never-promise list as discrete rules', () => {
    expect(render()).toContain('- Never say a doctor will definitely be available.');
  });
});

describe('uncollected fields', () => {
  it('says a field is not recorded rather than leaving a blank', () => {
    const text = render({
      profile: null,
      agentProfile: {
        greeting: null,
        languages: [],
        tone: null,
        fullyBookedResponse: null,
        escalationRules: null,
        neverPromise: [],
      },
      bookingPolicy: null,
      faqs: [],
      services: [],
      doctors: [],
    });

    // The exact phrasing matters less than that it is an instruction the agent can act on,
    // which an empty line is not.
    expect(text).toMatch(/not recorded yet, so do not answer questions about it/i);
    expect(text).not.toMatch(/\n\n\n/);
  });

  it('falls back to English only when no language has been collected', () => {
    const values = buildPromptValues(
      configuration({
        agentProfile: {
          greeting: null,
          languages: [],
          tone: null,
          fullyBookedResponse: null,
          escalationRules: null,
          neverPromise: [],
        },
      }),
    );

    expect(values.languages).toMatch(/English only, until the clinic confirms otherwise/);
  });

  it('omits the map line entirely when there is no map link', () => {
    const values = buildPromptValues(
      configuration({ profile: { ...configuration().profile!, mapUrl: null } }),
    );

    expect(values.mapLine).toBe('');
  });
});

describe('the registry', () => {
  it('fills every declared placeholder, so none reaches the output', () => {
    const text = render();

    // A visible `{{greeting}}` is a prompt an agent will read out, and the failure is
    // silent at exactly the moment it matters.
    expect(text).not.toMatch(/\{\{\w+\}\}/);
  });

  it('refuses to render a version it does not have', () => {
    // The fallback is used only when the clinic has no stored version, so the clinic's
    // mapping is cleared here. Passing a bad fallback beside a valid stored version would
    // have proved nothing, which is what the first version of this test did.
    expect(() =>
      renderClinicPrompt(configuration({ sarvamMapping: null }), readiness(), 'v99-does-not-exist'),
    ).toThrow(UnknownPromptVersion);
  });

  it('refuses when a value is missing for a declared placeholder', () => {
    const values = buildPromptValues(configuration());
    const incomplete = { ...values, greeting: undefined } as unknown as typeof values;

    // `undefined` substituted into the template would read as the string "undefined",
    // which is worse than a visible placeholder because it looks deliberate.
    expect(() => renderPromptTemplate(DEFAULT_PROMPT_VERSION, incomplete)).toThrow();
  });

  it('reports the placeholder version as not approved for real callers', () => {
    const rendered = renderClinicPrompt(configuration(), readiness(), DEFAULT_PROMPT_VERSION);

    expect(rendered.version).toBe(DEFAULT_PROMPT_VERSION);
    // The command warns on this. When the real wording lands as v1 with approved: true,
    // this assertion is what has to be updated deliberately.
    expect(rendered.approved).toBe(false);
    expect(findPromptVersion(DEFAULT_PROMPT_VERSION)?.approved).toBe(false);
  });

  it('renders the version the clinic is marked with, not the newest one', () => {
    // A clinic is moved to a new version by saving its mapping, so the renderer must
    // follow the clinic rather than the registry. With an unknown stored version this
    // throws rather than quietly rendering a different one.
    expect(() =>
      renderClinicPrompt(
        configuration({
          sarvamMapping: { ...configuration().sarvamMapping!, promptVersion: 'v-not-real' },
        }),
        readiness(),
        DEFAULT_PROMPT_VERSION,
      ),
    ).toThrow(UnknownPromptVersion);
  });

  it('carries the readiness result, so the command can warn without the renderer refusing', () => {
    const rendered = renderClinicPrompt(
      configuration(),
      readiness({ toolSecretSet: false }),
      DEFAULT_PROMPT_VERSION,
    );

    // Rendered anyway: a partly configured clinic is worth inspecting, and refusing would
    // make the whole path untestable until every clinic was finished.
    expect(rendered.text.length).toBeGreaterThan(100);
    expect(rendered.readiness.ready).toBe(false);
  });

  it('declares a closed placeholder set that the template actually uses', () => {
    const template = findPromptVersion(DEFAULT_PROMPT_VERSION)?.template ?? '';
    const used = new Set([...template.matchAll(/\{\{(\w+)\}\}/g)].map((match) => match[1]));

    // Every placeholder the template uses must be declared, or the renderer would leave it
    // in the output. The reverse is allowed: a declared placeholder a version does not use
    // is how a new version drops a section.
    for (const placeholder of used) {
      expect(PROMPT_PLACEHOLDERS).toContain(placeholder);
    }
  });
});

/**
 * The agent must not identify anybody by a number they speak (Feature 3 review, C2), because
 * the tools no longer do. A prompt that still told it to ask "which number is the booking
 * under?" would invite exactly the impersonation the endpoints refuse.
 */
describe('the default version on who is calling', () => {
  const template = findPromptVersion(DEFAULT_PROMPT_VERSION)?.template ?? '';

  it('tells the agent the caller is recognised by their own line, not a spoken number', () => {
    expect(template).toContain('WHO IS CALLING');
    expect(template).toMatch(/never ask for a phone number to find out who someone is/i);
    expect(template).toMatch(/never use a number a caller\s+tells you to look anybody up/i);
  });

  it('forbids reading back anything from the clinic’s records', () => {
    expect(template).toMatch(/never say a patient's name, an appointment or any other detail/i);
  });

  it('keeps the earlier version unedited for clinics still marked with it', () => {
    expect(findPromptVersion('v0-placeholder')?.template).not.toContain('WHO IS CALLING');
  });
});
