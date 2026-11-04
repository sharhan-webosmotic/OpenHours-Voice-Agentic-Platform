import { z } from 'zod';
import {
  AGENT_TONES,
  ORGANISATION_STATUSES,
  RECORDING_CONSENT_MODES,
  VOICE_AGENT_REQUIREMENTS,
  VOICE_AGENT_STATES,
  WEEKDAYS,
  agentProfileSchema,
  bookingPolicySchema,
  clinicFaqsSchema,
  clinicHoursSchema,
  clinicProfileSchema,
  createClinicOwnerSchema,
  createOrganisationSchema,
  doctorSchema,
  sarvamMappingSchema,
  serviceSchema,
  telephonySchema,
  updateDoctorSchema,
  updateOrganisationSchema,
  updateServiceSchema,
} from '@clinicai/shared';
import { MAX_PAGE_SIZE } from './organisations.service.js';

/**
 * The HTTP contract for clinic configuration.
 *
 * THE REQUEST SCHEMAS ARE THE SHARED ONES, re-exported rather than restated. The admin
 * console validates a form against the same object this route parses, so a rule that holds
 * in one place holds in the other. Only the params, the query and the response shapes are
 * defined here, because those are HTTP concerns the console does not own.
 *
 * Registered through `registerRoute` so M1-03 can generate the OpenAPI document from the
 * registry rather than from a second description of the same endpoints.
 */

export const organisationParamsSchema = z.object({
  organisationId: z.string().uuid(),
});

export const serviceParamsSchema = organisationParamsSchema.extend({
  serviceId: z.string().uuid(),
});

export const doctorParamsSchema = organisationParamsSchema.extend({
  doctorId: z.string().uuid(),
});

export const listQuerySchema = z.object({
  /** Matches the clinic name or any of its phone numbers. */
  q: z.string().trim().min(1).max(200).optional(),
  status: z.enum(ORGANISATION_STATUSES).optional(),
  cursor: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(MAX_PAGE_SIZE).default(25),
});

/**
 * Saving the Sarvam mapping, with the two flags that are actions rather than fields.
 *
 * Each regenerate flag is a decision about the mapping, not part of it, which is why they live
 * on the request body and not in the shared mapping schema. Both default to false: re-saving an
 * app id must never silently take a live agent off the air. They are separate because they
 * break different things (see `saveSarvamMapping`).
 */
export const sarvamMappingBodySchema = z.object({
  mapping: sarvamMappingSchema,
  regenerateToolSecret: z.boolean().default(false),
  regenerateWebhookSecret: z.boolean().default(false),
});

const isoDate = z.string();

export const organisationSummarySchema = z.object({
  id: z.string(),
  name: z.string(),
  timezone: z.string(),
  status: z.enum(ORGANISATION_STATUSES),
  clinicPhone: z.string().nullable(),
  createdAt: isoDate,
});

export const organisationListResponseSchema = z.object({
  items: z.array(organisationSummarySchema),
  nextCursor: z.string().nullable(),
});

export const readinessResponseSchema = z.object({
  ready: z.boolean(),
  satisfiedCount: z.number().int(),
  totalCount: z.number().int(),
  incompleteSections: z.array(z.string()),
  missing: z.array(z.object({ key: z.string(), section: z.string(), label: z.string() })),
});

/**
 * The Sarvam mapping as returned.
 *
 * NOTE WHAT IS ABSENT: there is no `toolSecret` and no hash of one. A caller is told
 * whether a secret exists and when it was set, which is what readiness and an operator
 * need. The secret itself was returned once, at generation, and is unrecoverable by design.
 */
export const sarvamMappingResponseSchema = z.object({
  sarvamAppId: z.string().nullable(),
  sarvamAppVersion: z.string().nullable(),
  sarvamDeploymentId: z.string().nullable(),
  sarvamConnectionId: z.string().nullable(),
  agentPhone: z.string().nullable(),
  promptVersion: z.string().nullable(),
  toolSecretSet: z.boolean(),
  toolSecretSetAt: isoDate.nullable(),
  /** Whether the webhook path secret exists and when it was minted. Never the value. */
  webhookSecretSet: z.boolean(),
  webhookSecretSetAt: isoDate.nullable(),
});

export const clinicDetailResponseSchema = z.object({
  organisation: organisationSummarySchema.extend({
    openingHoursCollectedAt: isoDate.nullable(),
    recordingRetentionDays: z.number().int(),
  }),
  profile: clinicProfileSchema.nullable(),
  hours: z.array(
    z.object({
      weekday: z.enum(WEEKDAYS),
      segments: z.array(
        z.object({ opensAtMinute: z.number().int(), closesAtMinute: z.number().int() }),
      ),
    }),
  ),
  bookingPolicy: bookingPolicySchema.nullable(),
  agentProfile: z
    .object({
      greeting: z.string().nullable(),
      languages: z.array(z.string()),
      tone: z.enum(AGENT_TONES).nullable(),
      fullyBookedResponse: z.string().nullable(),
      escalationRules: z.string().nullable(),
      neverPromise: z.array(z.string()),
    })
    .nullable(),
  telephony: z
    .object({
      recordingConsentMode: z.enum(RECORDING_CONSENT_MODES).nullable(),
      consentAnnouncement: z.string().nullable(),
      consentConfirmed: z.boolean(),
      consentConfirmedAt: isoDate.nullable(),
      consentConfirmedByName: z.string().nullable(),
    })
    .nullable(),
  faqs: z.array(
    z.object({
      id: z.string(),
      question: z.string(),
      answer: z.string(),
      sortOrder: z.number().int(),
      active: z.boolean(),
    }),
  ),
  services: z.array(
    z.object({
      id: z.string(),
      name: z.string(),
      durationMinutes: z.number().int(),
      priceMinor: z.number().int().nullable(),
      active: z.boolean(),
    }),
  ),
  doctors: z.array(
    z.object({
      id: z.string(),
      fullName: z.string(),
      specialty: z.string().nullable(),
      bufferMinutes: z.number().int(),
      active: z.boolean(),
    }),
  ),
  sarvamMapping: sarvamMappingResponseSchema.nullable(),
  readiness: readinessResponseSchema,
  /** Whether the AI receptionist can take a call now, and what it still needs. */
  voiceAgent: z.object({
    state: z.enum(VOICE_AGENT_STATES),
    missing: z.array(z.enum(VOICE_AGENT_REQUIREMENTS)),
  }),
});

export const createdOrganisationResponseSchema = z.object({
  organisationId: z.string(),
  name: z.string(),
});

export const createdServiceResponseSchema = z.object({ serviceId: z.string() });
export const createdDoctorResponseSchema = z.object({ doctorId: z.string() });

export const savedSarvamMappingResponseSchema = z.object({
  /** Present only on the response that minted it. Shown once, then unrecoverable. */
  toolSecret: z.string().optional(),
  /**
   * The path secret for this clinic's webhook URL, also shown exactly once.
   *
   * Minted with the tool secret, because a clinic is configured in one sitting and a webhook
   * URL that had to be asked for separately is the step somebody forgets. The symptom of
   * forgetting is a clinic whose agent answers calls normally and whose call history stays
   * empty, which is not a failure anybody notices quickly.
   */
  webhookSecret: z.string().optional(),
});

/** A doctor's week: all seven weekdays, a day with no segments being a day off. */
export const doctorHoursResponseSchema = z.object({
  days: z.array(
    z.object({
      weekday: z.enum(WEEKDAYS),
      segments: z.array(
        z.object({ opensAtMinute: z.number().int(), closesAtMinute: z.number().int() }),
      ),
    }),
  ),
});

export {
  createClinicOwnerSchema,
  agentProfileSchema,
  bookingPolicySchema,
  clinicFaqsSchema,
  clinicHoursSchema,
  clinicProfileSchema,
  createOrganisationSchema,
  doctorSchema,
  serviceSchema,
  telephonySchema,
  updateDoctorSchema,
  updateOrganisationSchema,
  updateServiceSchema,
};

/** A rendered master prompt, for reading and copying. Changes nothing. */
export const promptPreviewResponseSchema = z.object({
  version: z.string(),
  approved: z.boolean(),
  /** False when no version is recorded as pasted, so the default version was rendered. */
  versionRecorded: z.boolean(),
  text: z.string(),
  readiness: readinessResponseSchema,
});

/**
 * A new clinic owner. `temporaryPassword` is in this response and nowhere else: it is stored
 * only as a hash, so the page that shows it is the only chance to copy it.
 */
export const createdClinicOwnerResponseSchema = z.object({
  userId: z.string(),
  email: z.string(),
  fullName: z.string(),
  temporaryPassword: z.string(),
});
