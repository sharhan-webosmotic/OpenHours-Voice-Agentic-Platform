import { randomInt } from 'node:crypto';
import { WEEKDAYS } from '@clinicai/shared';

/**
 * Valid request bodies for the clinic configuration sections, shared by the tests that need
 * a request to succeed rather than a request to be rejected.
 *
 * WHY THESE ARE SHARED AND VALID. Two guards drive every one of these routes for every role,
 * and a body that failed validation would answer 400, which is not 403, so the guard would
 * report green while proving nothing about the permission. Keeping one set of known-good
 * bodies means a schema change breaks them in one place rather than in four test files, and
 * the files that test REJECTIONS build their own malformed bodies deliberately.
 *
 * All synthetic. Phone numbers are generated in the valid Indian range and are unique per
 * call, because both kinds of clinic number are unique across the whole platform.
 */

/** Unique enough for a name or an external id within one test run. */
export const uniqueSuffix = (): string =>
  `${String(Date.now()).slice(-7)}${String(randomInt(1000)).padStart(3, '0')}`;

/**
 * A valid, unique Indian mobile number in E.164.
 *
 * `9` then nine random digits: Indian subscriber numbers begin with 6 to 9, so a leading 9
 * is always in range, and the remaining nine digits give enough space that a collision
 * inside one run is not worth guarding against. Collisions would surface as a 409 rather
 * than as a wrong answer, which is why this is acceptable rather than merely convenient.
 */
export const uniquePhone = (): string => `+919${String(randomInt(1_000_000_000)).padStart(9, '0')}`;

export const PROFILE_BODY = {
  legalName: 'Probe Clinic Private Limited',
  contactEmail: 'desk@probe.test',
  // Null, because the profile write also replaces the clinic's public line and a fixed
  // number would collide with another organisation's across the suite.
  contactPhone: null,
  website: 'https://probe.test',
  addressLine1: '1 Probe Road',
  addressLine2: null,
  city: 'Bengaluru',
  state: 'Karnataka',
  postalCode: '560001',
  country: 'IN',
  mapUrl: 'https://maps.probe.test/clinic',
} as const;

/**
 * A full week: open on weekdays with a lunch break, closed at the weekend.
 *
 * All seven weekdays are stated, including the closed ones, which the shared schema
 * requires: a weekday absent from the payload would be indistinguishable from one nobody
 * has asked the clinic about.
 */
export const HOURS_BODY = {
  days: WEEKDAYS.map((weekday) =>
    weekday === 'SATURDAY' || weekday === 'SUNDAY'
      ? { weekday, segments: [] }
      : {
          weekday,
          segments: [
            { opensAtMinute: 9 * 60, closesAtMinute: 13 * 60 },
            { opensAtMinute: 17 * 60, closesAtMinute: 20 * 60 },
          ],
        },
  ),
};

export const BOOKING_POLICY_BODY = {
  slotGranularityMinutes: 15,
  minimumNoticeMinutes: 60,
  maximumAdvanceDays: 60,
  cancellationWindowHours: 24,
  acceptsNewPatients: true,
  defaultBufferMinutes: 5,
  maxPerSlot: 1,
  noShowPolicy: 'A second missed appointment is discussed with the practice manager.',
} as const;

export const AGENT_PROFILE_BODY = {
  greeting: 'Thank you for calling the Probe Clinic. How can I help?',
  languages: ['en-IN', 'hi-IN'],
  tone: 'FRIENDLY',
  fullyBookedResponse: 'I can take your number and have the desk call you back.',
  escalationRules: 'Transfer anything clinical, and anything about a bill, to the front desk.',
  neverPromise: [
    'Never say a doctor will definitely be available.',
    'Never tell a caller to stop or change a medication.',
  ],
} as const;

export const TELEPHONY_BODY = {
  recordingConsentMode: 'ANNOUNCEMENT',
  consentAnnouncement: 'This call is recorded to help us improve our service.',
  consentConfirmed: true,
  consentConfirmedByName: 'Practice Manager',
} as const;

export const FAQS_BODY = {
  faqs: [
    { question: 'Do you have parking?', answer: 'Yes, behind the building.', active: true },
    { question: 'Do you take walk-ins?', answer: 'Only before 11am.', active: false },
  ],
} as const;

/**
 * The Sarvam mapping, with no phone numbers.
 *
 * Both numbers are platform-unique, so a caller that needs them adds its own unique ones.
 * Leaving them null here keeps the body reusable across the roles a guard drives it as.
 */
export const SARVAM_MAPPING_BODY = {
  sarvamAppId: null,
  sarvamAppVersion: '1',
  sarvamDeploymentId: 'dep-probe',
  sarvamConnectionId: 'conn-probe',
  agentPhone: null,
  clinicPhone: null,
  promptVersion: 'v0-placeholder',
} as const;
