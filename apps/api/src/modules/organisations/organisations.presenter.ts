import { WEEKDAYS, type ClinicReadiness } from '@clinicai/shared';
import type { ClinicDetail } from './organisations.service.js';
import type { OrganisationListRow } from './organisations.repository.js';

/**
 * Turns what the service returns into what the HTTP layer sends.
 *
 * Pure, and separate from the routes, for two reasons. Dates become ISO-8601 UTC strings
 * here and nowhere else, so no handler can accidentally serialise a `Date` through
 * `JSON.stringify` and emit a different format on one endpoint. And the Sarvam mapping is
 * narrowed here: the `toolSecretHash` never reaches a response because it never reaches
 * this module in the first place, and this is the file a reviewer checks to confirm that.
 *
 * The opening hours are regrouped on the way out. The database stores one row per segment,
 * which is the right shape for a query over a weekday; a form and a prompt both want one
 * entry per weekday holding its segments. The regrouping is here rather than in the
 * repository so the stored shape stays the queryable one.
 */

const iso = (value: Date | null): string | null => value?.toISOString() ?? null;

export const presentOrganisationSummary = (row: OrganisationListRow) => ({
  id: row.id,
  name: row.name,
  timezone: row.timezone,
  status: row.status,
  clinicPhone: row.clinicPhone,
  createdAt: row.createdAt.toISOString(),
});

const presentReadiness = (readiness: ClinicReadiness) => ({
  ready: readiness.ready,
  satisfiedCount: readiness.satisfiedCount,
  totalCount: readiness.totalCount,
  incompleteSections: [...readiness.incompleteSections],
  missing: readiness.missing.map((requirement) => ({
    key: requirement.key,
    section: requirement.section,
    label: requirement.label,
  })),
});

/**
 * All seven weekdays, always, each with its segments.
 *
 * Every weekday is present even when the clinic is closed, so the console renders a full
 * week without inventing the missing days and a client cannot mistake "absent" for
 * "closed". Whether the hours were ever collected is a separate field,
 * `openingHoursCollectedAt`, and that is the one that distinguishes a weekly off from an
 * unanswered question.
 */
const presentHours = (detail: ClinicDetail) =>
  WEEKDAYS.map((weekday) => ({
    weekday,
    segments: detail.hours
      .filter((row) => row.weekday === weekday)
      .map((row) => ({ opensAtMinute: row.opensAtMinute, closesAtMinute: row.closesAtMinute })),
  }));

export const presentClinicDetail = (detail: ClinicDetail) => ({
  organisation: {
    id: detail.organisation.id,
    name: detail.organisation.name,
    timezone: detail.organisation.timezone,
    status: detail.organisation.status,
    clinicPhone: detail.clinicPhone,
    createdAt: detail.organisation.createdAt.toISOString(),
    openingHoursCollectedAt: iso(detail.organisation.openingHoursCollectedAt),
    recordingRetentionDays: detail.organisation.recordingRetentionDays,
  },
  profile: detail.profile,
  hours: presentHours(detail),
  bookingPolicy: detail.bookingPolicy,
  agentProfile:
    detail.agentProfile === null
      ? null
      : {
          greeting: detail.agentProfile.greeting,
          languages: [...detail.agentProfile.languages],
          tone: detail.agentProfile.tone,
          fullyBookedResponse: detail.agentProfile.fullyBookedResponse,
          escalationRules: detail.agentProfile.escalationRules,
          neverPromise: [...detail.agentProfile.neverPromise],
        },
  telephony:
    detail.telephony === null
      ? null
      : {
          recordingConsentMode: detail.telephony.recordingConsentMode,
          consentAnnouncement: detail.telephony.consentAnnouncement,
          // The stored timestamp is evidence; the boolean is what a form binds to.
          consentConfirmed: detail.telephony.consentConfirmedAt !== null,
          consentConfirmedAt: iso(detail.telephony.consentConfirmedAt),
          consentConfirmedByName: detail.telephony.consentConfirmedByName,
        },
  faqs: detail.faqs.map((faq) => ({
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    sortOrder: faq.sortOrder,
    active: faq.active,
  })),
  services: detail.services.map((service) => ({
    id: service.id,
    name: service.name,
    durationMinutes: service.durationMinutes,
    priceMinor: service.priceMinor,
    active: service.active,
  })),
  doctors: detail.doctors.map((doctor) => ({
    id: doctor.id,
    fullName: doctor.fullName,
    specialty: doctor.specialty,
    bufferMinutes: doctor.bufferMinutes,
    active: doctor.active,
  })),
  sarvamMapping:
    detail.sarvamMapping === null
      ? null
      : {
          sarvamAppId: detail.sarvamMapping.sarvamAppId,
          sarvamAppVersion: detail.sarvamMapping.sarvamAppVersion,
          sarvamDeploymentId: detail.sarvamMapping.sarvamDeploymentId,
          sarvamConnectionId: detail.sarvamMapping.sarvamConnectionId,
          agentPhone: detail.sarvamMapping.agentPhone,
          promptVersion: detail.sarvamMapping.promptVersion,
          toolSecretSet: detail.sarvamMapping.toolSecretSet,
          toolSecretSetAt: iso(detail.sarvamMapping.toolSecretSetAt),
        },
  readiness: presentReadiness(detail.readiness),
});
