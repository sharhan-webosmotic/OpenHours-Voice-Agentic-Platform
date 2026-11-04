import { WEEKDAYS, type ClinicReadiness } from '@clinicai/shared';
import type { ClinicConfiguration } from '../../modules/organisations/organisations.repository.js';
import { findPromptVersion, renderPromptTemplate, type PromptValues } from './registry.js';

/**
 * Turns one clinic's stored configuration into the text a person pastes into Sarvam.
 *
 * PURE, AND TESTED AS SUCH. It takes the configuration and returns a string: no database,
 * no clock, no environment. The command in prisma/render-prompt.ts does the loading and the
 * printing, which is what lets the interesting part (what gets baked in, how an uncollected
 * field reads, what the agent is told about availability) be asserted directly.
 *
 * WHAT GOES IN AND WHAT MUST NOT is set out at the top of master-v0-placeholder.ts. The
 * short version: hours, services, doctors, policies, contact details and the clinic's own
 * words are baked in, because they change rarely. Availability is never baked in, because a
 * prompt is a snapshot and an agent reading a stale snapshot will offer a slot that is gone.
 * Nothing about any patient is baked in at all.
 *
 * AN UNCOLLECTED FIELD RENDERS AS AN EXPLICIT STATEMENT THAT IT IS UNKNOWN, never as a
 * blank and never as a plausible default. "Not recorded" in a prompt is a thing the agent
 * can decline to answer; an empty line is a thing it will fill in for itself.
 */

const NOT_RECORDED =
  '(not recorded yet, so do not answer questions about it: offer to take a message)';

const minutesToClock = (minute: number): string => {
  const hour = Math.floor(minute / 60);
  const minutes = minute % 60;
  return `${String(hour).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
};

const titleCase = (weekday: string): string => weekday.charAt(0) + weekday.slice(1).toLowerCase();

const bulleted = (lines: readonly string[]): string =>
  lines.length === 0 ? NOT_RECORDED : lines.map((line) => `- ${line}`).join('\n');

const textOr = (value: string | null | undefined): string =>
  value === null || value === undefined || value.trim() === '' ? NOT_RECORDED : value.trim();

/**
 * The week, as the agent should read it out.
 *
 * Distinguishes the three states the data genuinely has: hours never collected, a weekday
 * the clinic is closed, and a weekday with one or more segments. Collapsing the first two
 * would make the agent say "we are closed on Sunday" about a clinic nobody has asked.
 */
const renderHours = (configuration: ClinicConfiguration): string => {
  if (configuration.organisation.openingHoursCollectedAt === null) {
    return 'Opening hours have not been collected for this clinic. Do not state any opening hours. Offer to take a message.';
  }

  return WEEKDAYS.map((weekday) => {
    const segments = configuration.hours
      .filter((row) => row.weekday === weekday)
      .sort((a, b) => a.opensAtMinute - b.opensAtMinute);

    if (segments.length === 0) {
      return `- ${titleCase(weekday)}: closed`;
    }

    const windows = segments
      .map(
        (segment) =>
          `${minutesToClock(segment.opensAtMinute)} to ${minutesToClock(segment.closesAtMinute)}`,
      )
      .join(', and again ');

    return `- ${titleCase(weekday)}: ${windows}`;
  }).join('\n');
};

const renderServices = (configuration: ClinicConfiguration): string =>
  bulleted(
    configuration.services
      .filter((candidate) => candidate.active)
      .map((candidate) => {
        const price =
          candidate.priceMinor === null
            ? 'price not recorded, so do not quote one'
            : `approximately ${String(Math.round(candidate.priceMinor / 100))} rupees`;
        return `${candidate.name}: ${String(candidate.durationMinutes)} minutes, ${price}`;
      }),
  );

const renderDoctors = (configuration: ClinicConfiguration): string =>
  bulleted(
    configuration.doctors
      .filter((doctor) => doctor.active)
      .map((doctor) =>
        doctor.specialty === null || doctor.specialty.trim() === ''
          ? doctor.fullName
          : `${doctor.fullName}, ${doctor.specialty}`,
      ),
  );

const renderBookingPolicy = (configuration: ClinicConfiguration): string => {
  const policy = configuration.bookingPolicy;

  if (policy === null) {
    return NOT_RECORDED;
  }

  const lines: string[] = [];

  if (policy.slotGranularityMinutes !== null) {
    lines.push(`Appointments are booked in ${String(policy.slotGranularityMinutes)}-minute slots.`);
  }
  if (policy.minimumNoticeMinutes !== null) {
    lines.push(
      `Nothing may be booked less than ${String(policy.minimumNoticeMinutes)} minutes before it starts.`,
    );
  }
  if (policy.maximumAdvanceDays !== null) {
    lines.push(`Do not book more than ${String(policy.maximumAdvanceDays)} days ahead.`);
  }
  if (policy.cancellationWindowHours !== null) {
    lines.push(
      `A patient may cancel up to ${String(policy.cancellationWindowHours)} hours before without penalty.`,
    );
  }
  if (policy.acceptsNewPatients !== null) {
    lines.push(
      policy.acceptsNewPatients
        ? 'The clinic is accepting new patients.'
        : 'The clinic is NOT accepting new patients. Say so politely and do not book one.',
    );
  }
  if (policy.noShowPolicy !== null && policy.noShowPolicy.trim() !== '') {
    lines.push(`No-show policy: ${policy.noShowPolicy.trim()}`);
  }

  return bulleted(lines);
};

const renderFaqs = (configuration: ClinicConfiguration): string =>
  bulleted(
    configuration.faqs
      .filter((faq) => faq.active)
      .map((faq) => `Question: ${faq.question}\n  Answer, as written: ${faq.answer}`),
  );

const renderAddress = (configuration: ClinicConfiguration): string => {
  const profile = configuration.profile;

  if (profile === null) {
    return NOT_RECORDED;
  }

  const parts = [
    profile.addressLine1,
    profile.addressLine2,
    profile.city,
    profile.state,
    profile.postalCode,
  ].filter((part): part is string => part !== null && part.trim() !== '');

  return parts.length === 0 ? NOT_RECORDED : parts.join(', ');
};

/**
 * What the agent is told about recording.
 *
 * The announcement text is reproduced verbatim when there is one, because the whole point of
 * storing the exact words is that the caller hears those words and not a paraphrase.
 */
const renderRecording = (configuration: ClinicConfiguration): string => {
  const telephony = configuration.telephony;

  if (telephony === null || telephony.recordingConsentMode === null) {
    return 'The recording arrangement has not been decided. Do not tell the caller anything about recording.';
  }

  switch (telephony.recordingConsentMode) {
    case 'NOT_RECORDED':
      return 'This call is not recorded. If asked, say that calls are not recorded.';
    case 'ANNOUNCEMENT':
      return `Play this notice at the start of the call, in these words: "${textOr(telephony.consentAnnouncement)}"`;
    case 'EXPLICIT_OPT_IN':
      return `Ask for consent before anything is recorded, in these words: "${textOr(telephony.consentAnnouncement)}" If the caller declines, continue the call and do not record.`;
    default:
      // Exhaustive today. A mode added to the enum without a line here must not render as
      // an empty instruction, so it fails loudly instead.
      throw new Error(
        `no prompt wording for recording consent mode ${String(telephony.recordingConsentMode)}`,
      );
  }
};

export const buildPromptValues = (configuration: ClinicConfiguration): PromptValues => ({
  clinicName: configuration.organisation.name,
  tone: configuration.agentProfile?.tone?.toLowerCase() ?? 'neutral and professional',
  languages:
    configuration.agentProfile === null || configuration.agentProfile.languages.length === 0
      ? 'English only, until the clinic confirms otherwise'
      : [...configuration.agentProfile.languages].join(', '),
  greeting: textOr(configuration.agentProfile?.greeting),
  address: renderAddress(configuration),
  clinicPhone: textOr(configuration.clinicPhone),
  timezone: configuration.organisation.timezone,
  mapLine:
    configuration.profile?.mapUrl === null || configuration.profile?.mapUrl === undefined
      ? ''
      : `Map link, if the caller asks you to send one: ${configuration.profile.mapUrl}`,
  openingHours: renderHours(configuration),
  services: renderServices(configuration),
  doctors: renderDoctors(configuration),
  bookingPolicy: renderBookingPolicy(configuration),
  fullyBookedResponse: textOr(configuration.agentProfile?.fullyBookedResponse),
  escalationRules: textOr(configuration.agentProfile?.escalationRules),
  neverPromise: bulleted(configuration.agentProfile?.neverPromise ?? []),
  faqs: renderFaqs(configuration),
  recording: renderRecording(configuration),
});

export type RenderedPrompt = {
  readonly version: string;
  readonly approved: boolean;
  readonly text: string;
  /** Carried alongside so the command can warn rather than the renderer refusing. */
  readonly readiness: ClinicReadiness;
};

/**
 * Renders the clinic's current prompt version.
 *
 * Uses the version the CLINIC is marked with, not the newest one in the registry, because
 * the question this answers is "what should this clinic's agent be running", and a clinic
 * is moved to a new version deliberately by saving its mapping.
 */
export const renderClinicPrompt = (
  configuration: ClinicConfiguration,
  readiness: ClinicReadiness,
  fallbackVersion: string,
): RenderedPrompt => {
  const version = configuration.sarvamMapping?.promptVersion ?? fallbackVersion;
  const text = renderPromptTemplate(version, buildPromptValues(configuration));

  return {
    version,
    /**
     * Read back from the registry rather than passed in, so "is this wording approved for
     * real callers" has exactly one answer and it lives beside the wording. False for the
     * placeholder, which is why the command prints a warning.
     */
    approved: findPromptVersion(version)?.approved ?? false,
    text,
    readiness,
  };
};
