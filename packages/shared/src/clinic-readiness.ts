import type { Weekday } from './clinic.js';

/**
 * What must be true before a clinic's voice agent can take a real call.
 *
 * ONE DECLARED LIST, in one place, because three things need the same answer and must not
 * each have an opinion: the admin console's readiness indicator, the API's clinic detail
 * response, and `pnpm prompt:render`, which refuses to pretend a half-configured clinic is
 * ready to paste into Sarvam.
 *
 * THIS IS NOT VALIDATION. The zod schemas in `clinic.ts` deliberately accept a
 * half-collected clinic, because configuration arrives over several conversations. This is
 * the separate question of whether what has been collected is enough to answer a patient,
 * and it is advisory: nothing here blocks a save. What it blocks is someone believing a
 * clinic is live when its opening hours have never been asked about.
 *
 * Each requirement names the section it belongs to, so the console can show the gap beside
 * the form that closes it rather than as a list of field names.
 */

export const READINESS_SECTIONS = [
  'identity',
  'profile',
  'hours',
  'services',
  'doctors',
  'bookingPolicy',
  'agentProfile',
  'telephony',
  'sarvamMapping',
] as const;

export type ReadinessSection = (typeof READINESS_SECTIONS)[number];

export type ReadinessRequirement = {
  readonly key: string;
  readonly section: ReadinessSection;
  /** Written for the person configuring the clinic, not for a developer. */
  readonly label: string;
};

/**
 * The shape readiness is computed from: what has been collected, not how it is stored.
 *
 * Counts and flags rather than the rows themselves, so this function stays pure and the
 * caller decides how to load. `hoursCollected` is the distinction that matters: a weekday
 * with no segments is a weekly off, which is a real answer, while hours never having been
 * saved is an unanswered question, and the two look identical from row counts alone.
 */
export type ReadinessInput = {
  readonly name: string | null;
  readonly timezone: string | null;
  readonly clinicPhone: string | null;
  readonly addressLine1: string | null;
  readonly city: string | null;
  readonly hoursCollected: boolean;
  readonly openWeekdays: readonly Weekday[];
  readonly activeServiceCount: number;
  readonly activeDoctorCount: number;
  readonly slotGranularityMinutes: number | null;
  readonly maximumAdvanceDays: number | null;
  readonly greeting: string | null;
  readonly languageCount: number;
  readonly fullyBookedResponse: string | null;
  readonly escalationRules: string | null;
  readonly recordingConsentMode: string | null;
  readonly consentConfirmed: boolean;
  readonly sarvamAppId: string | null;
  readonly sarvamDeploymentId: string | null;
  readonly agentPhone: string | null;
  readonly toolSecretSet: boolean;
  readonly promptVersion: string | null;
};

type Rule = ReadinessRequirement & {
  readonly satisfied: (input: ReadinessInput) => boolean;
};

const present = (value: string | null): boolean => value !== null && value.trim() !== '';

const RULES: readonly Rule[] = [
  {
    key: 'identity.name',
    section: 'identity',
    label: 'Clinic name',
    satisfied: (input) => present(input.name),
  },
  {
    key: 'identity.timezone',
    section: 'identity',
    label: 'Time zone',
    satisfied: (input) => present(input.timezone),
  },
  {
    key: 'profile.clinicPhone',
    section: 'profile',
    label: "The clinic's own phone number",
    satisfied: (input) => present(input.clinicPhone),
  },
  {
    key: 'profile.address',
    section: 'profile',
    label: 'Street address and city, which the agent reads out when asked where you are',
    satisfied: (input) => present(input.addressLine1) && present(input.city),
  },
  {
    key: 'hours.collected',
    section: 'hours',
    label: 'Opening hours asked about for all seven weekdays',
    satisfied: (input) => input.hoursCollected,
  },
  {
    key: 'hours.openAtLeastOneDay',
    section: 'hours',
    label: 'At least one weekday the clinic is open',
    satisfied: (input) => input.openWeekdays.length > 0,
  },
  {
    key: 'services.atLeastOne',
    section: 'services',
    label: 'At least one active service, so there is something to book',
    satisfied: (input) => input.activeServiceCount > 0,
  },
  {
    key: 'doctors.atLeastOne',
    section: 'doctors',
    label: 'At least one active doctor, so a booking has somebody to be with',
    satisfied: (input) => input.activeDoctorCount > 0,
  },
  {
    key: 'bookingPolicy.slotGranularityMinutes',
    section: 'bookingPolicy',
    label: 'Appointment slot length',
    satisfied: (input) => input.slotGranularityMinutes !== null,
  },
  {
    key: 'bookingPolicy.maximumAdvanceDays',
    section: 'bookingPolicy',
    label: 'How far ahead the agent may book',
    satisfied: (input) => input.maximumAdvanceDays !== null,
  },
  {
    key: 'agentProfile.greeting',
    section: 'agentProfile',
    label: 'Greeting the caller hears',
    satisfied: (input) => present(input.greeting),
  },
  {
    key: 'agentProfile.languages',
    section: 'agentProfile',
    label: 'At least one language the agent speaks',
    satisfied: (input) => input.languageCount > 0,
  },
  {
    key: 'agentProfile.fullyBookedResponse',
    section: 'agentProfile',
    label: 'What the agent says when nothing is available',
    satisfied: (input) => present(input.fullyBookedResponse),
  },
  {
    key: 'agentProfile.escalationRules',
    section: 'agentProfile',
    label: 'When to hand the call to a person',
    satisfied: (input) => present(input.escalationRules),
  },
  {
    /**
     * Consent is a legal requirement, not a configuration preference, so it is required
     * before go-live even when the answer is that nothing is recorded.
     */
    key: 'telephony.recordingConsentMode',
    section: 'telephony',
    label: 'Recording consent decided, including deciding not to record',
    satisfied: (input) => present(input.recordingConsentMode),
  },
  {
    key: 'telephony.consentConfirmed',
    section: 'telephony',
    label: 'Someone at the clinic has confirmed the recording arrangement',
    satisfied: (input) => input.consentConfirmed,
  },
  {
    key: 'sarvamMapping.sarvamAppId',
    section: 'sarvamMapping',
    label: 'Sarvam app id, copied from the Sarvam console',
    satisfied: (input) => present(input.sarvamAppId),
  },
  {
    key: 'sarvamMapping.sarvamDeploymentId',
    section: 'sarvamMapping',
    label: 'Sarvam deployment id',
    satisfied: (input) => present(input.sarvamDeploymentId),
  },
  {
    key: 'sarvamMapping.agentPhone',
    section: 'sarvamMapping',
    label: 'The number patients dial to reach the agent',
    satisfied: (input) => present(input.agentPhone),
  },
  {
    key: 'sarvamMapping.toolSecret',
    section: 'sarvamMapping',
    label: 'Per-clinic tool secret generated and configured in Sarvam',
    satisfied: (input) => input.toolSecretSet,
  },
  {
    key: 'sarvamMapping.promptVersion',
    section: 'sarvamMapping',
    label: 'Which master prompt version is loaded in Sarvam',
    satisfied: (input) => present(input.promptVersion),
  },
];

/** Every requirement, for a console that wants to show the whole checklist. */
export const READINESS_REQUIREMENTS: readonly ReadinessRequirement[] = RULES.map(
  ({ key, section, label }) => ({ key, section, label }),
);

export type ClinicReadiness = {
  /** True only when nothing is missing. */
  readonly ready: boolean;
  readonly missing: readonly ReadinessRequirement[];
  /** Sections holding at least one gap, in the declared order, for a progress display. */
  readonly incompleteSections: readonly ReadinessSection[];
  readonly satisfiedCount: number;
  readonly totalCount: number;
};

export const clinicReadiness = (input: ReadinessInput): ClinicReadiness => {
  const missing = RULES.filter((rule) => !rule.satisfied(input)).map(({ key, section, label }) => ({
    key,
    section,
    label,
  }));

  const incomplete = new Set(missing.map((requirement) => requirement.section));

  return {
    ready: missing.length === 0,
    missing,
    incompleteSections: READINESS_SECTIONS.filter((section) => incomplete.has(section)),
    satisfiedCount: RULES.length - missing.length,
    totalCount: RULES.length,
  };
};
