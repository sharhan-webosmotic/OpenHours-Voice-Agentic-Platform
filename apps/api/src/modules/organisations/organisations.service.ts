import {
  WEEKDAYS,
  clinicReadiness,
  type AgentProfileInput,
  type BookingPolicyInput,
  type ClinicFaqsInput,
  type ClinicHoursInput,
  type ClinicProfileInput,
  type ClinicReadiness,
  type CreateOrganisationInput,
  type DoctorInput,
  type OrganisationStatus,
  type SarvamMappingInput,
  type ServiceInput,
  type TelephonyInput,
  type UpdateOrganisationInput,
  type Weekday,
} from '@clinicai/shared';
import { ConflictError, NotFoundError } from '../../common/errors.js';
import { uuidV7 } from '../../common/uuid.js';
import { generateOpaqueToken, hashToken } from '../../common/tokens.js';
import { requirePermission, type Principal } from '../../common/permissions.js';
import { withPrincipalScope } from '../../db/principal-scope.js';
import type { TenantDb } from '../../db/tenant-client.js';
import { logger } from '../../common/logger.js';
import { record } from '../audit/audit.service.js';
import { DEFAULT_PROMPT_VERSION, findPromptVersion } from '../../voice/prompts/registry.js';
import * as repository from './organisations.repository.js';

/**
 * Clinic configuration: the business rules, the permission checks, the transactions and the
 * audit trail.
 *
 * ─── WHICH MATRIX CELL GOVERNS WHICH SECTION ────────────────────────────────────
 *
 * Four cells, not one, because the sections are genuinely different kinds of thing:
 *
 *   organisations           the clinic's existence, name, timezone and status
 *   clinic_settings         profile, hours, booking policy, agent behaviour, FAQs, consent
 *   doctors_services_hours  services and doctors
 *   phone_voice_mapping     the Sarvam mapping
 *
 * ONE CONSEQUENCE IS DELIBERATE AND WORTH STATING. The matrix gives INTERNAL_ADMIN only
 * `read` on `doctors_services_hours`, so an internal admin can see a clinic's services and
 * doctors and cannot change them: a SUPER_ADMIN does that. That is accepted for the pilot
 * rather than worked around, because widening the cell is a permission change and not a
 * code-review matter. It will need revisiting when support staff start onboarding clinics,
 * which is recorded in docs/features/pilot-clinic.md.
 *
 * ─── HOW TENANCY IS ENFORCED, ONCE, FOR EVERY ENTRY POINT ───────────────────────
 *
 * Every function below resolves the organisation FIRST, through `reachableOrganisation`,
 * and a clinic role asking about another clinic gets a 404 there (root CLAUDE.md rule 7).
 * That is not only the rule: it is also what makes every subsequent query safe, because by
 * then the organisation id either belongs to the caller or the caller is a platform role.
 * Without it, passing a foreign id down to a section update would raise
 * `CrossTenantWriteError` from the client extension, which is a 500 and a disclosure.
 *
 * ─── AUDIT ──────────────────────────────────────────────────────────────────────
 *
 * Every write records one row, inside the same transaction, naming the section and the
 * FIELD NAMES that changed, never their values. None of this is patient data, but it is a
 * clinic's operating configuration and its provider mapping, and rule 5 covers sensitive
 * writes. The Sarvam secret's audit row records that a secret was issued and never what it
 * was.
 */

/** Hard maximum page size (apps/api/CLAUDE.md). */
export const MAX_PAGE_SIZE = 100;

export type ClinicDetail = repository.ClinicConfiguration & {
  readonly readiness: ClinicReadiness;
};

/**
 * Loads an organisation the principal may reach, or throws NotFound.
 *
 * The 404 covers three different situations on purpose: the id does not exist, the id
 * belongs to another clinic, or the id is not a clinic this platform role can see. A caller
 * cannot tell them apart, which is the point.
 */
const reachableOrganisation = async (
  db: TenantDb,
  organisationId: string,
): Promise<repository.OrganisationRow> => {
  const organisation = await repository.findOrganisationById(db, organisationId);

  if (organisation === null) {
    throw new NotFoundError(
      `organisation ${organisationId} is not reachable by this principal`,
      'That clinic was not found.',
    );
  }

  return organisation;
};

export const readinessFor = (configuration: repository.ClinicConfiguration): ClinicReadiness =>
  clinicReadiness({
    name: configuration.organisation.name,
    timezone: configuration.organisation.timezone,
    clinicPhone: configuration.clinicPhone,
    addressLine1: configuration.profile?.addressLine1 ?? null,
    city: configuration.profile?.city ?? null,
    hoursCollected: configuration.organisation.openingHoursCollectedAt !== null,
    openWeekdays: [...new Set(configuration.hours.map((row) => row.weekday))],
    activeServiceCount: configuration.services.filter((service) => service.active).length,
    activeDoctorCount: configuration.doctors.filter((doctor) => doctor.active).length,
    slotGranularityMinutes: configuration.bookingPolicy?.slotGranularityMinutes ?? null,
    maximumAdvanceDays: configuration.bookingPolicy?.maximumAdvanceDays ?? null,
    greeting: configuration.agentProfile?.greeting ?? null,
    languageCount: configuration.agentProfile?.languages.length ?? 0,
    fullyBookedResponse: configuration.agentProfile?.fullyBookedResponse ?? null,
    escalationRules: configuration.agentProfile?.escalationRules ?? null,
    recordingConsentMode: configuration.telephony?.recordingConsentMode ?? null,
    consentConfirmed:
      configuration.telephony?.consentConfirmedAt !== null &&
      configuration.telephony?.consentConfirmedAt !== undefined,
    sarvamAppId: configuration.sarvamMapping?.sarvamAppId ?? null,
    sarvamDeploymentId: configuration.sarvamMapping?.sarvamDeploymentId ?? null,
    agentPhone: configuration.sarvamMapping?.agentPhone ?? null,
    toolSecretSet: configuration.sarvamMapping?.toolSecretSet ?? false,
    promptVersion: configuration.sarvamMapping?.promptVersion ?? null,
  });

export type OrganisationPage = {
  readonly items: readonly repository.OrganisationListRow[];
  readonly nextCursor: string | null;
};

export const listOrganisations = async (
  principal: Principal,
  filters: {
    readonly search?: string;
    readonly status?: OrganisationStatus;
    readonly cursor?: string;
    readonly limit?: number;
  },
): Promise<OrganisationPage> => {
  requirePermission('organisations', 'read', principal);

  const limit = Math.min(filters.limit ?? 25, MAX_PAGE_SIZE);

  return withPrincipalScope(principal, 'organisations.list', async (db) => {
    // One extra row tells us whether another page exists without a second count query.
    const rows = await repository.listOrganisations(db, {
      ...(filters.search === undefined ? {} : { search: filters.search }),
      ...(filters.status === undefined ? {} : { status: filters.status }),
      ...(filters.cursor === undefined ? {} : { cursor: filters.cursor }),
      take: limit + 1,
    });

    const items = rows.slice(0, limit);

    return {
      items,
      nextCursor: rows.length > limit ? (items.at(-1)?.id ?? null) : null,
    };
  });
};

export const getClinic = async (
  principal: Principal,
  organisationId: string,
): Promise<ClinicDetail> => {
  requirePermission('organisations', 'read', principal);

  return withPrincipalScope(principal, 'organisations.read', async (db) => {
    const configuration = await repository.findClinicConfiguration(db, organisationId);

    if (configuration === null) {
      throw new NotFoundError(
        `organisation ${organisationId} is not reachable by this principal`,
        'That clinic was not found.',
      );
    }

    return { ...configuration, readiness: readinessFor(configuration) };
  });
};

export type CreatedOrganisation = {
  readonly organisationId: string;
  readonly name: string;
};

/**
 * Creates a clinic, its configuration shell and its Sarvam agent row, in one transaction.
 *
 * NO `Idempotency-Key`. Root CLAUDE.md rule 8 requires one on every create the voice agent
 * can reach, and this is not one: it is an internal console action taken by a named human.
 * What protects it against a double submit is the unique index on the clinic's phone number
 * (prisma/sql 003), which turns the second request into a 409 naming the collision rather
 * than a second half-configured clinic. The console disabling its button while the request
 * is in flight is a courtesy on top of that, not the control.
 */
export const createOrganisation = async (
  principal: Principal,
  input: CreateOrganisationInput,
): Promise<CreatedOrganisation> => {
  requirePermission('organisations', 'write', principal);

  const organisationId = uuidV7();

  return withPrincipalScope(principal, 'organisations.create', async (db) => {
    try {
      await repository.createOrganisationWithShell(db, {
        organisationId,
        name: input.name,
        timezone: input.timezone,
        clinicPhone: input.clinicPhone,
        promptVersion: DEFAULT_PROMPT_VERSION,
      });
    } catch (error) {
      const target = repository.uniqueViolationTarget(error);

      if (target !== undefined) {
        /**
         * Almost always the clinic phone number, which is the double-submit guard doing
         * its job. Reported as a conflict naming the field rather than the index, because
         * the person reading it is configuring a clinic, not debugging a schema.
         */
        throw new ConflictError(
          `organisation create violated a unique constraint: ${target}`,
          'A clinic with that phone number already exists. Search for it in the list before creating another.',
        );
      }

      throw error;
    }

    await record(db, {
      organisationId,
      action: 'organisation.created',
      entityType: 'organisation',
      entityId: organisationId,
      // Field names and the prompt version, never the clinic's phone number: an audit row
      // carries ids and the names of what changed.
      metadata: {
        fields: ['name', 'timezone', 'clinicPhone'],
        promptVersion: DEFAULT_PROMPT_VERSION,
      },
    });

    logger.info({ organisationId }, 'clinic created');

    return { organisationId, name: input.name };
  });
};

export const updateOrganisation = async (
  principal: Principal,
  organisationId: string,
  input: UpdateOrganisationInput,
): Promise<void> => {
  requirePermission('organisations', 'write', principal);

  await withPrincipalScope(principal, 'organisations.update', async (db) => {
    await reachableOrganisation(db, organisationId);

    await repository.updateOrganisation(db, organisationId, {
      ...(input.name === undefined ? {} : { name: input.name }),
      ...(input.timezone === undefined ? {} : { timezone: input.timezone }),
      ...(input.status === undefined ? {} : { status: input.status }),
    });

    await record(db, {
      organisationId,
      action: 'organisation.updated',
      entityType: 'organisation',
      entityId: organisationId,
      metadata: { fields: Object.keys(input).sort() },
    });
  });
};

/**
 * One shape for every section write.
 *
 * The six sections differ only in which cell they check, what they write and what the audit
 * row is called. Writing them out six times produced six places to forget the organisation
 * resolution or the audit row, so the shared parts live here once and each section supplies
 * its three differences. The permission check still happens per section, before any query.
 */
const writeSection = async <T>(
  principal: Principal,
  organisationId: string,
  section: {
    readonly resource: Parameters<typeof requirePermission>[0];
    readonly auditAction: string;
    readonly changedFields: readonly string[];
    readonly apply: (db: TenantDb) => Promise<T>;
  },
): Promise<T> => {
  requirePermission(section.resource, 'write', principal);

  return withPrincipalScope(principal, section.auditAction, async (db) => {
    await reachableOrganisation(db, organisationId);

    const result = await section.apply(db);

    await record(db, {
      organisationId,
      action: section.auditAction,
      entityType: 'organisation',
      entityId: organisationId,
      metadata: { fields: [...section.changedFields].sort() },
    });

    return result;
  });
};

export const updateClinicProfile = async (
  principal: Principal,
  organisationId: string,
  input: ClinicProfileInput,
): Promise<void> => {
  await writeSection(principal, organisationId, {
    resource: 'clinic_settings',
    auditAction: 'clinic_settings.profile.updated',
    changedFields: Object.keys(input),
    apply: async (db) => {
      await repository.updateClinicProfile(db, organisationId, input);

      /**
       * The contact number is also the clinic's public line.
       *
       * Kept in step deliberately: the number a patient is told to ring and the number
       * stored as the clinic's line being different values is the kind of divergence
       * nobody notices until a call is forwarded to the wrong place.
       */
      if (input.contactPhone !== null) {
        await repository.setClinicLine(db, organisationId, input.contactPhone);
      }
    },
  });
};

export const updateBookingPolicy = async (
  principal: Principal,
  organisationId: string,
  input: BookingPolicyInput,
): Promise<void> => {
  await writeSection(principal, organisationId, {
    resource: 'clinic_settings',
    auditAction: 'clinic_settings.booking_policy.updated',
    changedFields: Object.keys(input),
    apply: (db) => repository.updateBookingPolicy(db, organisationId, input),
  });
};

export const updateAgentProfile = async (
  principal: Principal,
  organisationId: string,
  input: AgentProfileInput,
): Promise<void> => {
  await writeSection(principal, organisationId, {
    resource: 'clinic_settings',
    auditAction: 'clinic_settings.agent_profile.updated',
    changedFields: Object.keys(input),
    apply: (db) =>
      repository.updateAgentProfile(db, organisationId, {
        greeting: input.greeting,
        languages: input.languages,
        tone: input.tone,
        fullyBookedResponse: input.fullyBookedResponse,
        escalationRules: input.escalationRules,
        neverPromise: input.neverPromise,
      }),
  });
};

export const updateTelephony = async (
  principal: Principal,
  organisationId: string,
  input: TelephonyInput,
): Promise<void> => {
  await writeSection(principal, organisationId, {
    resource: 'clinic_settings',
    auditAction: 'clinic_settings.telephony.updated',
    changedFields: Object.keys(input),
    apply: (db) =>
      repository.updateTelephony(db, organisationId, {
        recordingConsentMode: input.recordingConsentMode,
        consentAnnouncement: input.consentAnnouncement,
        /**
         * The boolean the client sends becomes a timestamp, because WHEN consent was
         * confirmed is the part that is evidence. Un-confirming clears both, which the
         * CHECK constraint in prisma/sql requires to happen together.
         */
        consentConfirmedAt: input.consentConfirmed ? new Date() : null,
        consentConfirmedByName: input.consentConfirmed ? input.consentConfirmedByName : null,
      }),
  });
};

export const replaceClinicHours = async (
  principal: Principal,
  organisationId: string,
  input: ClinicHoursInput,
): Promise<void> => {
  const segments = input.days.flatMap((day) =>
    day.segments.map((segment) => ({
      weekday: day.weekday,
      opensAtMinute: segment.opensAtMinute,
      closesAtMinute: segment.closesAtMinute,
    })),
  );

  await writeSection(principal, organisationId, {
    resource: 'clinic_settings',
    auditAction: 'clinic_settings.hours.replaced',
    // Counts rather than the schedule: the audit row records that hours changed and how
    // many segments resulted, which is enough to investigate without copying the data.
    changedFields: [`segments:${String(segments.length)}`],
    apply: (db) => repository.replaceClinicHours(db, organisationId, segments, new Date()),
  });
};

export const replaceFaqs = async (
  principal: Principal,
  organisationId: string,
  input: ClinicFaqsInput,
): Promise<void> => {
  await writeSection(principal, organisationId, {
    resource: 'clinic_settings',
    auditAction: 'clinic_settings.faqs.replaced',
    changedFields: [`faqs:${String(input.faqs.length)}`],
    apply: (db) => repository.replaceFaqs(db, organisationId, input.faqs),
  });
};

export const createService = async (
  principal: Principal,
  organisationId: string,
  input: ServiceInput,
): Promise<{ readonly serviceId: string }> => {
  const serviceId = await writeSection(principal, organisationId, {
    resource: 'doctors_services_hours',
    auditAction: 'service.created',
    changedFields: Object.keys(input),
    apply: async (db) => {
      try {
        return await repository.createService(db, organisationId, input);
      } catch (error) {
        if (repository.uniqueViolationTarget(error) !== undefined) {
          throw new ConflictError(
            'service name already exists in this organisation',
            'A service with that name already exists at this clinic.',
          );
        }
        throw error;
      }
    },
  });

  return { serviceId };
};

export const updateService = async (
  principal: Principal,
  organisationId: string,
  serviceId: string,
  input: Partial<ServiceInput>,
): Promise<void> => {
  await writeSection(principal, organisationId, {
    resource: 'doctors_services_hours',
    auditAction: 'service.updated',
    changedFields: Object.keys(input),
    apply: async (db) => {
      const updated = await repository.updateService(db, organisationId, serviceId, input);

      if (!updated) {
        // Unknown id and another clinic's id are the same answer, by rule 7.
        throw new NotFoundError(
          `service ${serviceId} not found in organisation ${organisationId}`,
          'That service was not found.',
        );
      }
    },
  });
};

export const createDoctor = async (
  principal: Principal,
  organisationId: string,
  input: DoctorInput,
): Promise<{ readonly doctorId: string }> => {
  const doctorId = await writeSection(principal, organisationId, {
    resource: 'doctors_services_hours',
    auditAction: 'doctor.created',
    changedFields: Object.keys(input),
    apply: (db) => repository.createDoctor(db, organisationId, input),
  });

  return { doctorId };
};

export const updateDoctor = async (
  principal: Principal,
  organisationId: string,
  doctorId: string,
  input: Partial<DoctorInput>,
): Promise<void> => {
  await writeSection(principal, organisationId, {
    resource: 'doctors_services_hours',
    auditAction: 'doctor.updated',
    changedFields: Object.keys(input),
    apply: async (db) => {
      const updated = await repository.updateDoctor(db, organisationId, doctorId, input);

      if (!updated) {
        throw new NotFoundError(
          `doctor ${doctorId} not found in organisation ${organisationId}`,
          'That doctor was not found.',
        );
      }
    },
  });
};

export type WeekView = {
  readonly days: readonly {
    readonly weekday: Weekday;
    readonly segments: readonly {
      readonly opensAtMinute: number;
      readonly closesAtMinute: number;
    }[];
  }[];
};

/** All seven weekdays, a day with no segments being a day off, as the clinic's hours read. */
const toWeek = (rows: readonly repository.HoursRow[]): WeekView => ({
  days: WEEKDAYS.map((weekday) => ({
    weekday,
    segments: rows
      .filter((row) => row.weekday === weekday)
      .map((row) => ({ opensAtMinute: row.opensAtMinute, closesAtMinute: row.closesAtMinute })),
  })),
});

const doctorNotFound = (doctorId: string, organisationId: string): NotFoundError =>
  new NotFoundError(
    `doctor ${doctorId} not found in organisation ${organisationId}`,
    'That doctor was not found.',
  );

/**
 * One doctor's working week, inside which the slot engine offers that doctor's times.
 *
 * Read under `doctors_services_hours`, the resource the doctors themselves are read under.
 * Not audited: a schedule names nobody, as the clinic's own hours do not.
 */
export const getDoctorHours = async (
  principal: Principal,
  organisationId: string,
  doctorId: string,
): Promise<WeekView> => {
  requirePermission('doctors_services_hours', 'read', principal);

  return withPrincipalScope(principal, 'doctors_services_hours.read', async (db) => {
    await reachableOrganisation(db, organisationId);
    const rows = await repository.findDoctorHours(db, organisationId, doctorId);

    if (rows === null) {
      throw doctorNotFound(doctorId, organisationId);
    }

    return toWeek(rows);
  });
};

export const replaceDoctorHours = async (
  principal: Principal,
  organisationId: string,
  doctorId: string,
  input: ClinicHoursInput,
): Promise<void> => {
  const segments = input.days.flatMap((day) =>
    day.segments.map((segment) => ({
      weekday: day.weekday,
      opensAtMinute: segment.opensAtMinute,
      closesAtMinute: segment.closesAtMinute,
    })),
  );

  await writeSection(principal, organisationId, {
    resource: 'doctors_services_hours',
    auditAction: 'doctor.hours.replaced',
    // The doctor and a count, as the clinic's hours record a count: never the schedule.
    changedFields: [`doctor:${doctorId}`, `segments:${String(segments.length)}`],
    apply: async (db) => {
      if (!(await repository.replaceDoctorHours(db, organisationId, doctorId, segments))) {
        throw doctorNotFound(doctorId, organisationId);
      }
    },
  });
};

export type SarvamMappingSaved = {
  /** The webhook URL's path secret, shown exactly once, like the tool secret. */
  readonly webhookSecret?: string;
  /**
   * The newly minted tool secret, returned EXACTLY ONCE and only when one was generated.
   *
   * `undefined` on every later save. Only the hash is stored, so a lost secret cannot be
   * recovered and a new one has to be generated, which also means re-pasting it into
   * Sarvam. That is the same trade as a temporary password (D-003) and for the same reason.
   */
  readonly toolSecret?: string;
};

/**
 * Saves the hand-entered Sarvam mapping, minting the per-clinic tool secret the first time.
 *
 * THE SECRET IS OURS TO GENERATE, not the operator's to supply. A secret typed in by a
 * person arrives by whatever channel they chose and is as strong as they felt like making
 * it, and this secret is the entire authentication for the tool endpoints the agent calls
 * (D-004). So it is generated from the CSPRNG, shown once, stored as a hash, and never
 * returned again by any endpoint.
 *
 * REGENERATION IS EXPLICIT. Passing `regenerateToolSecret` mints a new one and invalidates
 * the old, which breaks the live agent until the new value is pasted into Sarvam. That is
 * why it is a separate flag rather than something an ordinary save does: re-saving the app
 * id must not silently take a clinic's agent off the air.
 */
export const saveSarvamMapping = async (
  principal: Principal,
  organisationId: string,
  input: SarvamMappingInput,
  options: { readonly regenerateToolSecret?: boolean } = {},
): Promise<SarvamMappingSaved> => {
  requirePermission('phone_voice_mapping', 'write', principal);

  if (input.promptVersion !== null && findPromptVersion(input.promptVersion) === undefined) {
    throw new ConflictError(
      `unknown prompt version ${input.promptVersion}`,
      'That master prompt version does not exist in this build.',
    );
  }

  return withPrincipalScope(principal, 'phone_voice_mapping.update', async (db) => {
    await reachableOrganisation(db, organisationId);

    const existing = await repository.findClinicConfiguration(db, organisationId);
    const alreadyHasSecret = existing?.sarvamMapping?.toolSecretSet === true;
    const mintSecret = options.regenerateToolSecret === true || !alreadyHasSecret;

    const toolSecret = mintSecret ? generateOpaqueToken() : undefined;

    /**
     * The WEBHOOK secret is minted on the same rules and shown in the same breath.
     *
     * Two secrets rather than one, because they travel differently: this one is a path
     * segment in the URL pasted into Sarvam's `webhook_config` (D-006), where proxies and
     * access logs can see it, and the other is a bearer header. One value for both would
     * mean a leaked access log handed somebody the credential for the tool endpoints too.
     *
     * They are minted TOGETHER because the clinic is configured in one sitting: a webhook
     * URL that had to be requested separately is a step somebody forgets, and the symptom
     * is a clinic whose calls are never recorded while its agent answers normally.
     */
    const webhookSecret = mintSecret ? generateOpaqueToken() : undefined;

    try {
      await repository.updateSarvamMapping(db, organisationId, {
        sarvamAppId: input.sarvamAppId,
        sarvamAppVersion: input.sarvamAppVersion,
        sarvamDeploymentId: input.sarvamDeploymentId,
        sarvamConnectionId: input.sarvamConnectionId,
        promptVersion: input.promptVersion,
        ...(toolSecret === undefined
          ? {}
          : { toolSecretHash: hashToken(toolSecret), toolSecretSetAt: new Date() }),
        ...(webhookSecret === undefined
          ? {}
          : { webhookSecretHash: hashToken(webhookSecret), webhookSecretSetAt: new Date() }),
      });

      if (input.agentPhone !== null) {
        await repository.setAgentNumber(db, organisationId, input.agentPhone);
      }

      if (input.clinicPhone !== null) {
        await repository.setClinicLine(db, organisationId, input.clinicPhone);
      }
    } catch (error) {
      const target = repository.uniqueViolationTarget(error);

      if (target !== undefined) {
        /**
         * An agent number already belongs to another clinic, or a Sarvam app id does. Both
         * are platform-unique on purpose: an inbound call is resolved to an organisation by
         * the number dialled, so two clinics claiming one number would make that resolution
         * ambiguous, and ambiguous means wrong.
         */
        throw new ConflictError(
          `sarvam mapping violated a unique constraint: ${target}`,
          'That phone number or Sarvam app id is already mapped to another clinic.',
        );
      }

      throw error;
    }

    await record(db, {
      organisationId,
      action: 'phone_voice_mapping.updated',
      entityType: 'voice_agent',
      entityId: organisationId,
      /**
       * Records THAT a secret was issued, never the secret, and never the app or deployment
       * ids: those are provider credentials of a sort, and the trail only needs to say which
       * fields moved.
       */
      metadata: {
        fields: Object.keys(input)
          .filter((key) => input[key as keyof SarvamMappingInput] !== null)
          .sort(),
        toolSecretIssued: toolSecret !== undefined,
        toolSecretRegenerated: options.regenerateToolSecret === true && alreadyHasSecret,
      },
    });

    logger.info(
      { organisationId, toolSecretIssued: toolSecret !== undefined },
      'sarvam mapping saved',
    );

    return {
      ...(toolSecret === undefined ? {} : { toolSecret }),
      ...(webhookSecret === undefined ? {} : { webhookSecret }),
    };
  });
};
