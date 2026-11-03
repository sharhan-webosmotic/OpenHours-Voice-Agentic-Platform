import type {
  AgentProfileInput,
  BookingPolicyInput,
  ClinicFaqsInput,
  ClinicHoursInput,
  ClinicProfileInput,
  CreateClinicOwnerInput,
  CreateOrganisationInput,
  DoctorInput,
  OrganisationStatus,
  ReadinessSection,
  SarvamMappingInput,
  ServiceInput,
  VoiceAgentStatus,
  Weekday,
} from '@clinicai/shared';
import { ApiError, toProblem } from './problem.js';

/**
 * The typed surface for clinic configuration.
 *
 * HAND-WRITTEN, LIKE THE AUTH ENDPOINTS, AND FOR THE SAME REASON. Everything in this
 * repository describes this package as generated from an OpenAPI document, and neither the
 * document nor the generator exists yet (M1-03, docs/BACKLOG.md). The alternative was raw
 * `fetch` inside the admin console's features, which the front-end rules forbid, so this
 * grows the hand-written client that M1-03 will replace. That cost is recorded in the
 * backlog entry rather than left for whoever picks that ticket up to discover.
 *
 * IT TAKES THE AUTHENTICATED CALLER RATHER THAN HOLDING A TOKEN. The access token lives in
 * one closure in `client.ts` (D-002) and must not be copied here. What this module receives
 * is the `authed` function, which attaches the token, recovers from one expired-token 401
 * and reports a lost session. So there is still exactly one token, one refresh slot and one
 * place that knows how a session works.
 *
 * TYPES ARE SHARED, NOT RESTATED. The request bodies are the zod-inferred types from
 * `@clinicai/shared`, which the API parses with the same schemas and the console's forms
 * validate against. A separate set of interfaces here would be a third description of one
 * contract and would be the one that drifted.
 */

/** The authenticated request function from `createApiClient`. */
export type AuthedFetch = (path: string, method?: string, body?: unknown) => Promise<Response>;

export type OrganisationSummary = {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly status: OrganisationStatus;
  readonly clinicPhone: string | null;
  readonly createdAt: string;
};

export type OrganisationPage = {
  readonly items: readonly OrganisationSummary[];
  readonly nextCursor: string | null;
};

export type ReadinessRequirementView = {
  readonly key: string;
  readonly section: ReadinessSection;
  readonly label: string;
};

export type ReadinessView = {
  readonly ready: boolean;
  readonly satisfiedCount: number;
  readonly totalCount: number;
  readonly incompleteSections: readonly ReadinessSection[];
  readonly missing: readonly ReadinessRequirementView[];
};

export type DayHoursView = {
  readonly weekday: Weekday;
  readonly segments: readonly { readonly opensAtMinute: number; readonly closesAtMinute: number }[];
};

export type FaqView = {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly sortOrder: number;
  readonly active: boolean;
};

export type ServiceView = {
  readonly id: string;
  readonly name: string;
  readonly durationMinutes: number;
  readonly priceMinor: number | null;
  readonly active: boolean;
};

export type DoctorView = {
  readonly id: string;
  readonly fullName: string;
  readonly specialty: string | null;
  readonly bufferMinutes: number;
  readonly active: boolean;
};

/** Note what is absent: no secret, and no hash of one. See the API's presenter. */
export type SarvamMappingView = {
  readonly sarvamAppId: string | null;
  readonly sarvamAppVersion: string | null;
  readonly sarvamDeploymentId: string | null;
  readonly sarvamConnectionId: string | null;
  readonly agentPhone: string | null;
  readonly promptVersion: string | null;
  readonly toolSecretSet: boolean;
  readonly toolSecretSetAt: string | null;
  /** Whether the webhook path secret exists, and when it was minted. Never the value. */
  readonly webhookSecretSet: boolean;
  readonly webhookSecretSetAt: string | null;
};

/** A rendered master prompt, read-only. */
export type PromptPreviewView = {
  /** The master prompt version the text was rendered from. */
  readonly version: string;
  /** Whether that wording is approved for real callers. */
  readonly approved: boolean;
  /** False when no version is recorded as pasted, so the default version was rendered. */
  readonly versionRecorded: boolean;
  readonly text: string;
  readonly readiness: ReadinessView;
};

/** A new clinic owner. The temporary password is in this response and nowhere else. */
export type CreatedClinicOwner = {
  readonly userId: string;
  readonly email: string;
  readonly fullName: string;
  readonly temporaryPassword: string;
};

export type TelephonyView = {
  readonly recordingConsentMode: string | null;
  readonly consentAnnouncement: string | null;
  readonly consentConfirmed: boolean;
  readonly consentConfirmedAt: string | null;
  readonly consentConfirmedByName: string | null;
};

export type AgentProfileView = {
  readonly greeting: string | null;
  readonly languages: readonly string[];
  readonly tone: string | null;
  readonly fullyBookedResponse: string | null;
  readonly escalationRules: string | null;
  readonly neverPromise: readonly string[];
};

export type ClinicDetailView = {
  readonly organisation: OrganisationSummary & {
    readonly openingHoursCollectedAt: string | null;
    readonly recordingRetentionDays: number;
  };
  readonly profile: ClinicProfileInput | null;
  readonly hours: readonly DayHoursView[];
  readonly bookingPolicy: BookingPolicyInput | null;
  readonly agentProfile: AgentProfileView | null;
  readonly telephony: TelephonyView | null;
  readonly faqs: readonly FaqView[];
  readonly services: readonly ServiceView[];
  readonly doctors: readonly DoctorView[];
  readonly sarvamMapping: SarvamMappingView | null;
  readonly readiness: ReadinessView;
  /** Whether the AI receptionist can take a call now, worked out on the server. */
  readonly voiceAgent: VoiceAgentStatus;
};

export type ClinicListFilters = {
  readonly q?: string | undefined;
  readonly status?: OrganisationStatus | undefined;
  readonly cursor?: string | undefined;
  readonly limit?: number | undefined;
};

export type SavedSarvamMapping = {
  /** Present only on the response that minted it. Shown once, then unrecoverable. */
  readonly toolSecret?: string;
  /**
   * The path secret for this clinic's webhook URL, present only on the response that minted it.
   *
   * Two secrets because they travel differently: this one is a path segment in a URL and the
   * other is a bearer header, so one value for both would mean an access log handed somebody
   * the tool credential.
   */
  readonly webhookSecret?: string;
};

/**
 * Which secrets a save should replace. Each one breaks something different until its new value
 * is pasted into Sarvam: the tool secret stops the agent's tool calls, the webhook secret stops
 * call events arriving.
 */
export type SarvamSecretRegeneration = {
  readonly toolSecret?: boolean;
  readonly webhookSecret?: boolean;
};

const BASE = '/api/v1/organisations';

export const createClinicsApi = (authed: AuthedFetch) => {
  /**
   * Parses a response, turning a problem+json body into an `ApiError`.
   *
   * Duplicated from `client.ts` rather than exported from it, because that one is a closure
   * over the session. Both are four lines and both will be replaced by the generated client.
   */
  const parse = async <T>(response: Response): Promise<T> => {
    if (!response.ok) {
      throw new ApiError(await toProblem(response));
    }
    if (response.status === 204) {
      return undefined as T;
    }
    return (await response.json()) as T;
  };

  const query = (filters: ClinicListFilters): string => {
    const search = new URLSearchParams();

    // Only what was given: an empty `q` would be a 400 from the API's own schema, which is
    // correct of it but a pointless round trip from here.
    if (filters.q !== undefined && filters.q.trim() !== '') {
      search.set('q', filters.q.trim());
    }
    if (filters.status !== undefined) {
      search.set('status', filters.status);
    }
    if (filters.cursor !== undefined) {
      search.set('cursor', filters.cursor);
    }
    if (filters.limit !== undefined) {
      search.set('limit', String(filters.limit));
    }

    const rendered = search.toString();
    return rendered === '' ? '' : `?${rendered}`;
  };

  const section = async (id: string, name: string, body: unknown): Promise<void> => {
    await parse<void>(await authed(`${BASE}/${id}/${name}`, 'PUT', body));
  };

  return {
    list: async (filters: ClinicListFilters = {}): Promise<OrganisationPage> =>
      parse<OrganisationPage>(await authed(`${BASE}${query(filters)}`)),

    get: async (id: string): Promise<ClinicDetailView> =>
      parse<ClinicDetailView>(await authed(`${BASE}/${id}`)),

    previewPrompt: async (id: string): Promise<PromptPreviewView> =>
      parse<PromptPreviewView>(await authed(`${BASE}/${id}/prompt-preview`)),

    createOwner: async (id: string, input: CreateClinicOwnerInput): Promise<CreatedClinicOwner> =>
      parse<CreatedClinicOwner>(await authed(`${BASE}/${id}/owners`, 'POST', input)),

    create: async (
      input: CreateOrganisationInput,
    ): Promise<{ readonly organisationId: string; readonly name: string }> =>
      parse(await authed(BASE, 'POST', input)),

    /**
     * A partial update. Every member carries `| undefined` because the repository runs with
     * `exactOptionalPropertyTypes`, which distinguishes an absent key from a key holding
     * `undefined`, and a zod schema's output is the second. The API treats an absent field
     * as "leave it alone" either way.
     */
    update: async (
      id: string,
      input: {
        readonly name?: string | undefined;
        readonly timezone?: string | undefined;
        readonly status?: OrganisationStatus | undefined;
      },
    ): Promise<void> => {
      await parse<void>(await authed(`${BASE}/${id}`, 'PATCH', input));
    },

    saveProfile: (id: string, input: ClinicProfileInput) => section(id, 'profile', input),
    saveHours: (id: string, input: ClinicHoursInput) => section(id, 'hours', input),
    saveBookingPolicy: (id: string, input: BookingPolicyInput) =>
      section(id, 'booking-policy', input),
    saveAgentProfile: (id: string, input: AgentProfileInput) => section(id, 'agent-profile', input),
    saveTelephony: (id: string, input: unknown) => section(id, 'telephony', input),
    saveFaqs: (id: string, input: ClinicFaqsInput) => section(id, 'faqs', input),

    /**
     * Saves the Sarvam mapping, and returns the tool secret on the one response that
     * mints it.
     *
     * `regenerateToolSecret` is explicit and defaults to false here as well as in the API,
     * because regenerating invalidates the secret the live agent is using: an ordinary save
     * must not take a clinic's agent off the air.
     */
    saveSarvamMapping: async (
      id: string,
      mapping: SarvamMappingInput,
      regenerate: SarvamSecretRegeneration = {},
    ): Promise<SavedSarvamMapping> =>
      parse<SavedSarvamMapping>(
        await authed(`${BASE}/${id}/sarvam-mapping`, 'PUT', {
          mapping,
          regenerateToolSecret: regenerate.toolSecret === true,
          regenerateWebhookSecret: regenerate.webhookSecret === true,
        }),
      ),

    createService: async (
      id: string,
      input: ServiceInput,
    ): Promise<{ readonly serviceId: string }> =>
      parse(await authed(`${BASE}/${id}/services`, 'POST', input)),

    updateService: async (
      id: string,
      serviceId: string,
      input: Partial<ServiceInput>,
    ): Promise<void> => {
      await parse<void>(await authed(`${BASE}/${id}/services/${serviceId}`, 'PATCH', input));
    },

    createDoctor: async (id: string, input: DoctorInput): Promise<{ readonly doctorId: string }> =>
      parse(await authed(`${BASE}/${id}/doctors`, 'POST', input)),

    updateDoctor: async (
      id: string,
      doctorId: string,
      input: Partial<DoctorInput>,
    ): Promise<void> => {
      await parse<void>(await authed(`${BASE}/${id}/doctors/${doctorId}`, 'PATCH', input));
    },
  };
};

export type ClinicsApi = ReturnType<typeof createClinicsApi>;
