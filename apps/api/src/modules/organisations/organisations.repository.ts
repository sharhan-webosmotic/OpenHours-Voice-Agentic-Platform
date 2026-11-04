/**
 * The enum types come from `@clinicai/shared`, not from the generated Prisma client.
 *
 * They are the same string unions either way, and taking them from the shared contract
 * means the SERVICE never has to import the Prisma client to name one. A lint rule confines
 * that import to `src/db` and the repositories, and it was right to: the first version of
 * this module imported four enum types into the service, which is how Prisma types start
 * leaking into business logic and then into a response.
 */
import type {
  AgentTone,
  OrganisationStatus,
  RecordingConsentMode,
  Weekday,
} from '@clinicai/shared';
import { PhoneKind, Provider } from '../../generated/prisma/enums.js';
import type { TenantDb } from '../../db/tenant-client.js';
import { uuidV7 } from '../../common/uuid.js';

/**
 * The only place in this module that touches Prisma (apps/api/CLAUDE.md).
 *
 * NO PERMISSION CHECKS AND NO ORGANISATION RESOLUTION HAPPEN HERE. Every function takes an
 * `organisationId` the service has already established the caller may reach, by loading the
 * organisation row first: that load is what turns a cross-tenant id into a 404 rather than
 * into a `CrossTenantWriteError` from the client extension. See the note on
 * `findOrganisationById`.
 *
 * Under a tenant scope the client extension injects and verifies `organisation_id` on every
 * one of these queries, and row-level security applies underneath it. Under a platform scope
 * nothing is injected, which is why each function filters explicitly: a platform read that
 * forgot its filter would return every clinic's row.
 */

export type OrganisationRow = {
  readonly id: string;
  readonly name: string;
  readonly timezone: string;
  readonly status: OrganisationStatus;
  readonly openingHoursCollectedAt: Date | null;
  readonly recordingRetentionDays: number;
  readonly createdAt: Date;
};

const ORGANISATION_SELECT = {
  id: true,
  name: true,
  timezone: true,
  status: true,
  openingHoursCollectedAt: true,
  recordingRetentionDays: true,
  createdAt: true,
} as const;

/**
 * One organisation by id, or null.
 *
 * THIS IS THE TENANCY GATE FOR THE WHOLE MODULE, so it is worth being precise about why it
 * returns null rather than throwing. `Organisation` is scoped by its primary key, and the
 * client extension deliberately does NOT inject the scope when an id is supplied: it lets
 * the query reach the database so that row-level security filters it, producing no rows. A
 * clinic role asking for another clinic's id therefore gets null here and a 404 from the
 * service, which is root CLAUDE.md rule 7. Injecting the scope instead would have answered
 * with an error that only appears for ids that exist, which is itself a disclosure.
 */
export const findOrganisationById = async (
  db: TenantDb,
  id: string,
): Promise<OrganisationRow | null> =>
  db.organisation.findUnique({ where: { id }, select: ORGANISATION_SELECT });

export type ListFilters = {
  readonly search?: string;
  readonly status?: OrganisationStatus;
  readonly cursor?: string;
  readonly take: number;
};

export type OrganisationListRow = OrganisationRow & {
  /** The clinic's own line, for the list column. Null until one is recorded. */
  readonly clinicPhone: string | null;
};

/**
 * A page of organisations, newest first.
 *
 * The search matches name or phone number, because those are the two things a person
 * identifying a clinic on the telephone has in front of them. `mode: 'insensitive'` plus the
 * trigram index from prisma/sql keeps it off a sequential scan as the list grows.
 */
export const listOrganisations = async (
  db: TenantDb,
  filters: ListFilters,
): Promise<readonly OrganisationListRow[]> => {
  const search = filters.search?.trim();

  const rows = await db.organisation.findMany({
    where: {
      ...(filters.status === undefined ? {} : { status: filters.status }),
      ...(search === undefined || search === ''
        ? {}
        : {
            OR: [
              { name: { contains: search, mode: 'insensitive' } },
              { phoneNumbers: { some: { e164: { contains: search } } } },
            ],
          }),
    },
    // id is UUID v7, so it orders by creation time and makes the sort stable when two rows
    // share a timestamp. An unstable sort would skip or repeat rows across pages.
    orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    take: filters.take,
    ...(filters.cursor === undefined ? {} : { cursor: { id: filters.cursor }, skip: 1 }),
    select: {
      ...ORGANISATION_SELECT,
      phoneNumbers: {
        where: { kind: PhoneKind.CLINIC_LINE },
        select: { e164: true },
        // One row: a clinic has one public line, and the partial unique index in
        // prisma/sql enforces that one number belongs to one clinic.
        take: 1,
      },
    },
  });

  return rows.map(({ phoneNumbers, ...organisation }) => ({
    ...organisation,
    clinicPhone: phoneNumbers[0]?.e164 ?? null,
  }));
};

export type ClinicProfileRow = {
  readonly legalName: string | null;
  readonly contactEmail: string | null;
  readonly contactPhone: string | null;
  readonly website: string | null;
  readonly addressLine1: string | null;
  readonly addressLine2: string | null;
  readonly city: string | null;
  readonly state: string | null;
  readonly postalCode: string | null;
  readonly country: string | null;
  readonly mapUrl: string | null;
};

export type BookingPolicyRow = {
  readonly slotGranularityMinutes: number | null;
  readonly minimumNoticeMinutes: number | null;
  readonly maximumAdvanceDays: number | null;
  readonly cancellationWindowHours: number | null;
  readonly acceptsNewPatients: boolean | null;
  readonly defaultBufferMinutes: number | null;
  readonly maxPerSlot: number | null;
  readonly noShowPolicy: string | null;
};

export type AgentProfileRow = {
  readonly greeting: string | null;
  readonly languages: readonly string[];
  readonly tone: AgentTone | null;
  readonly fullyBookedResponse: string | null;
  readonly escalationRules: string | null;
  readonly neverPromise: readonly string[];
};

export type TelephonyRow = {
  readonly recordingConsentMode: RecordingConsentMode | null;
  readonly consentAnnouncement: string | null;
  readonly consentConfirmedAt: Date | null;
  readonly consentConfirmedByName: string | null;
};

export type FaqRow = {
  readonly id: string;
  readonly question: string;
  readonly answer: string;
  readonly sortOrder: number;
  readonly active: boolean;
};

export type HoursRow = {
  readonly weekday: Weekday;
  readonly opensAtMinute: number;
  readonly closesAtMinute: number;
};

export type ServiceRow = {
  readonly id: string;
  readonly name: string;
  readonly durationMinutes: number;
  readonly priceMinor: number | null;
  readonly active: boolean;
};

export type DoctorRow = {
  readonly id: string;
  readonly fullName: string;
  readonly specialty: string | null;
  readonly bufferMinutes: number;
  readonly active: boolean;
};

/**
 * The Sarvam mapping as it is safe to return.
 *
 * `toolSecretHash` IS NOT IN THIS TYPE, and that is the point rather than an omission: the
 * secret is shown once at generation and nothing may read it back. What a caller is told is
 * whether one exists and when it was set, which is what the readiness check and an operator
 * actually need. apps/api/CLAUDE.md: responses never include provider secrets.
 */
export type SarvamMappingRow = {
  readonly sarvamAppId: string | null;
  readonly sarvamAppVersion: string | null;
  readonly sarvamDeploymentId: string | null;
  readonly sarvamConnectionId: string | null;
  readonly agentPhone: string | null;
  readonly promptVersion: string | null;
  readonly toolSecretSet: boolean;
  readonly toolSecretSetAt: Date | null;
  /** Read for the agent's status only, and not part of the mapping a caller is shown. */
  readonly agentActive: boolean;
  /** Whether the webhook secret exists: shown on the clinic page and used for the status. */
  readonly webhookSecretSet: boolean;
  /** When the webhook secret was minted, for the page. Never the secret or its hash. */
  readonly webhookSecretSetAt: Date | null;
};

/** Everything about one clinic, which is what the detail page and the renderer both need. */
export type ClinicConfiguration = {
  readonly organisation: OrganisationRow;
  readonly clinicPhone: string | null;
  readonly profile: ClinicProfileRow | null;
  readonly hours: readonly HoursRow[];
  readonly bookingPolicy: BookingPolicyRow | null;
  readonly agentProfile: AgentProfileRow | null;
  readonly telephony: TelephonyRow | null;
  readonly faqs: readonly FaqRow[];
  readonly services: readonly ServiceRow[];
  readonly doctors: readonly DoctorRow[];
  readonly sarvamMapping: SarvamMappingRow | null;
};

/**
 * Loads a whole clinic in ONE round trip.
 *
 * Nested selects rather than ten awaits: this is the admin console's detail page and the
 * prompt renderer's only read, and ten sequential queries inside one transaction is ten
 * round trips for data that is all reachable from one row. Every list here is bounded by a
 * constraint or by the shared schema (at most 7 weekdays times 4 segments, 50 FAQs), so
 * there is no unbounded nested read.
 */
export const findClinicConfiguration = async (
  db: TenantDb,
  organisationId: string,
): Promise<ClinicConfiguration | null> => {
  const row = await db.organisation.findUnique({
    where: { id: organisationId },
    select: {
      ...ORGANISATION_SELECT,
      phoneNumbers: {
        where: { kind: PhoneKind.CLINIC_LINE },
        select: { e164: true },
        take: 1,
      },
      clinicProfile: {
        select: {
          legalName: true,
          contactEmail: true,
          contactPhone: true,
          website: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          postalCode: true,
          country: true,
          mapUrl: true,
        },
      },
      clinicHours: {
        select: { weekday: true, opensAtMinute: true, closesAtMinute: true },
        orderBy: [{ weekday: 'asc' }, { opensAtMinute: 'asc' }],
      },
      clinicBookingPolicy: {
        select: {
          slotGranularityMinutes: true,
          minimumNoticeMinutes: true,
          maximumAdvanceDays: true,
          cancellationWindowHours: true,
          acceptsNewPatients: true,
          defaultBufferMinutes: true,
          maxPerSlot: true,
          noShowPolicy: true,
        },
      },
      clinicAgentProfile: {
        select: {
          greeting: true,
          languages: true,
          tone: true,
          fullyBookedResponse: true,
          escalationRules: true,
          neverPromise: true,
        },
      },
      clinicTelephony: {
        select: {
          recordingConsentMode: true,
          consentAnnouncement: true,
          consentConfirmedAt: true,
          consentConfirmedByName: true,
        },
      },
      clinicFaqs: {
        select: { id: true, question: true, answer: true, sortOrder: true, active: true },
        orderBy: { sortOrder: 'asc' },
      },
      services: {
        where: { deletedAt: null },
        select: { id: true, name: true, durationMinutes: true, priceMinor: true, active: true },
        orderBy: { name: 'asc' },
      },
      doctors: {
        where: { deletedAt: null },
        select: { id: true, fullName: true, specialty: true, bufferMinutes: true, active: true },
        orderBy: { fullName: 'asc' },
      },
      voiceAgents: {
        where: { provider: Provider.SARVAM },
        select: {
          sarvamAppId: true,
          sarvamAppVersion: true,
          sarvamDeploymentId: true,
          sarvamConnectionId: true,
          promptVersion: true,
          // The HASH is selected only to derive the boolean below. It is never returned.
          toolSecretHash: true,
          toolSecretSetAt: true,
          // Likewise selected only to derive a boolean, for the agent's status.
          webhookSecretHash: true,
          webhookSecretSetAt: true,
          status: true,
          agentNumber: { select: { e164: true } },
        },
        take: 1,
      },
    },
  });

  if (row === null) {
    return null;
  }

  const agent = row.voiceAgents[0];

  return {
    organisation: {
      id: row.id,
      name: row.name,
      timezone: row.timezone,
      status: row.status,
      openingHoursCollectedAt: row.openingHoursCollectedAt,
      recordingRetentionDays: row.recordingRetentionDays,
      createdAt: row.createdAt,
    },
    clinicPhone: row.phoneNumbers[0]?.e164 ?? null,
    profile: row.clinicProfile,
    hours: row.clinicHours,
    bookingPolicy: row.clinicBookingPolicy,
    agentProfile: row.clinicAgentProfile,
    telephony: row.clinicTelephony,
    faqs: row.clinicFaqs,
    services: row.services,
    doctors: row.doctors,
    sarvamMapping:
      agent === undefined
        ? null
        : {
            sarvamAppId: agent.sarvamAppId,
            sarvamAppVersion: agent.sarvamAppVersion,
            sarvamDeploymentId: agent.sarvamDeploymentId,
            sarvamConnectionId: agent.sarvamConnectionId,
            agentPhone: agent.agentNumber?.e164 ?? null,
            promptVersion: agent.promptVersion,
            toolSecretSet: agent.toolSecretHash !== null,
            toolSecretSetAt: agent.toolSecretSetAt,
            agentActive: agent.status === 'ACTIVE',
            webhookSecretSet: agent.webhookSecretHash !== null,
            webhookSecretSetAt: agent.webhookSecretSetAt,
          },
  };
};

export type CreateOrganisationRow = {
  readonly organisationId: string;
  readonly name: string;
  readonly timezone: string;
  readonly clinicPhone: string;
};

/**
 * Creates a clinic and the five rows that make its configuration addressable.
 *
 * The empty section rows are created up front so that every later write is an UPDATE of a
 * row that exists. The alternative, creating a section row on first save, puts an upsert and
 * a "does it exist yet" branch into six separate write paths, and the branch nobody tests is
 * the one that silently creates a second row.
 *
 * The caller runs this inside its transaction, so a failure anywhere leaves no clinic at all
 * rather than a clinic with four of its six sections.
 */
export const createOrganisationWithShell = async (
  db: TenantDb,
  input: CreateOrganisationRow,
): Promise<void> => {
  await db.organisation.create({
    data: {
      id: input.organisationId,
      name: input.name,
      timezone: input.timezone,
      settings: { recordings_visible_to_staff: false },
    },
  });

  await db.phoneNumber.create({
    data: {
      id: uuidV7(),
      organisationId: input.organisationId,
      e164: input.clinicPhone,
      kind: PhoneKind.CLINIC_LINE,
      label: 'Clinic line',
    },
  });

  await db.clinicProfile.create({
    data: { id: uuidV7(), organisationId: input.organisationId, contactPhone: input.clinicPhone },
  });
  await db.clinicBookingPolicy.create({
    data: { id: uuidV7(), organisationId: input.organisationId },
  });
  await db.clinicAgentProfile.create({
    data: { id: uuidV7(), organisationId: input.organisationId },
  });
  await db.clinicTelephony.create({
    data: { id: uuidV7(), organisationId: input.organisationId },
  });

  await db.voiceAgent.create({
    data: {
      id: uuidV7(),
      organisationId: input.organisationId,
      provider: Provider.SARVAM,
    },
  });
};

export const updateOrganisation = async (
  db: TenantDb,
  organisationId: string,
  data: {
    readonly name?: string;
    readonly timezone?: string;
    readonly status?: OrganisationStatus;
  },
): Promise<void> => {
  await db.organisation.update({ where: { id: organisationId }, data });
};

/**
 * The four one-row sections are UPSERTED, not updated.
 *
 * A clinic made by the console's create has all four rows from birth, but one made by
 * `prisma/seed.ts` or `pnpm provision:clinic` has none, and an `update` of a missing row is
 * Prisma's P2025, which surfaced as a 500 on every save. A section is a storable state whether
 * or not it was created empty first, so a save creates the row it needs.
 */
export const updateClinicProfile = async (
  db: TenantDb,
  organisationId: string,
  data: ClinicProfileRow,
): Promise<void> => {
  await db.clinicProfile.upsert({
    where: { organisationId },
    create: { id: uuidV7(), organisationId, ...data },
    update: data,
  });
};

export const updateBookingPolicy = async (
  db: TenantDb,
  organisationId: string,
  data: BookingPolicyRow,
): Promise<void> => {
  await db.clinicBookingPolicy.upsert({
    where: { organisationId },
    create: { id: uuidV7(), organisationId, ...data },
    update: data,
  });
};

export const updateAgentProfile = async (
  db: TenantDb,
  organisationId: string,
  data: {
    readonly greeting: string | null;
    readonly languages: readonly string[];
    readonly tone: AgentTone | null;
    readonly fullyBookedResponse: string | null;
    readonly escalationRules: string | null;
    readonly neverPromise: readonly string[];
  },
): Promise<void> => {
  const row = {
    greeting: data.greeting,
    languages: [...data.languages],
    tone: data.tone,
    fullyBookedResponse: data.fullyBookedResponse,
    escalationRules: data.escalationRules,
    neverPromise: [...data.neverPromise],
  };

  await db.clinicAgentProfile.upsert({
    where: { organisationId },
    create: { id: uuidV7(), organisationId, ...row },
    update: row,
  });
};

export const updateTelephony = async (
  db: TenantDb,
  organisationId: string,
  data: TelephonyRow,
): Promise<void> => {
  await db.clinicTelephony.upsert({
    where: { organisationId },
    create: { id: uuidV7(), organisationId, ...data },
    update: data,
  });
};

/**
 * Replaces the whole week of opening hours and records that they were collected.
 *
 * DELETE THEN INSERT, inside the caller's transaction. A diff against what is stored would
 * be more code for no gain: the client sends all seven weekdays every time, there are at
 * most 28 rows, and the exclusion constraint makes a partial update order-dependent in a way
 * a diff would have to reason about. The timestamp is what distinguishes a weekly off from
 * hours nobody has asked about yet.
 */
export const replaceClinicHours = async (
  db: TenantDb,
  organisationId: string,
  segments: readonly HoursRow[],
  collectedAt: Date,
): Promise<void> => {
  await db.clinicHours.deleteMany({ where: { organisationId } });

  if (segments.length > 0) {
    await db.clinicHours.createMany({
      data: segments.map((segment) => ({
        id: uuidV7(),
        organisationId,
        weekday: segment.weekday,
        opensAtMinute: segment.opensAtMinute,
        closesAtMinute: segment.closesAtMinute,
      })),
    });
  }

  await db.organisation.update({
    where: { id: organisationId },
    data: { openingHoursCollectedAt: collectedAt },
  });
};

/** Replaces the FAQ list, so the stored order is the order the clinic gave. */
export const replaceFaqs = async (
  db: TenantDb,
  organisationId: string,
  faqs: readonly { readonly question: string; readonly answer: string; readonly active: boolean }[],
): Promise<void> => {
  // Deleted first because (organisation_id, sort_order) is unique: writing the new rows
  // first would collide with the old ones on every position.
  await db.clinicFaq.deleteMany({ where: { organisationId } });

  if (faqs.length > 0) {
    await db.clinicFaq.createMany({
      data: faqs.map((faq, index) => ({
        id: uuidV7(),
        organisationId,
        question: faq.question,
        answer: faq.answer,
        sortOrder: index,
        active: faq.active,
      })),
    });
  }
};

export const createService = async (
  db: TenantDb,
  organisationId: string,
  input: {
    readonly name: string;
    readonly durationMinutes: number;
    readonly priceMinor: number | null;
    readonly active: boolean;
  },
): Promise<string> => {
  const id = uuidV7();
  await db.service.create({ data: { id, organisationId, ...input } });
  return id;
};

/**
 * Updates one service, and reports whether it existed.
 *
 * `updateMany` rather than `update`, because `update` throws a Prisma error for a missing
 * row and the id in question may belong to another clinic. A count of zero covers both
 * cases identically, which is what rule 7 requires: a 404 either way, never a 404 for one
 * and a different error for the other.
 */
export const updateService = async (
  db: TenantDb,
  organisationId: string,
  serviceId: string,
  data: {
    readonly name?: string;
    readonly durationMinutes?: number;
    readonly priceMinor?: number | null;
    readonly active?: boolean;
  },
): Promise<boolean> => {
  const result = await db.service.updateMany({
    where: { id: serviceId, organisationId, deletedAt: null },
    data,
  });
  return result.count === 1;
};

export const createDoctor = async (
  db: TenantDb,
  organisationId: string,
  input: {
    readonly fullName: string;
    readonly specialty: string | null;
    readonly bufferMinutes: number;
    readonly active: boolean;
  },
): Promise<string> => {
  const id = uuidV7();
  await db.doctor.create({ data: { id, organisationId, ...input } });
  return id;
};

export const updateDoctor = async (
  db: TenantDb,
  organisationId: string,
  doctorId: string,
  data: {
    readonly fullName?: string;
    readonly specialty?: string | null;
    readonly bufferMinutes?: number;
    readonly active?: boolean;
  },
): Promise<boolean> => {
  const result = await db.doctor.updateMany({
    where: { id: doctorId, organisationId, deletedAt: null },
    data,
  });
  return result.count === 1;
};

/**
 * A doctor's working hours as segments, the same shape as the clinic's, or null when the
 * doctor is not in this clinic (or not at all).
 *
 * The doctor is looked up first so an unknown id and an empty week are different answers:
 * a doctor with no hours is a real state, and a missing doctor is a 404.
 */
export const findDoctorHours = async (
  db: TenantDb,
  organisationId: string,
  doctorId: string,
): Promise<readonly HoursRow[] | null> => {
  const doctor = await db.doctor.findFirst({
    where: { id: doctorId, organisationId, deletedAt: null },
    select: { id: true },
  });

  if (doctor === null) {
    return null;
  }

  const rows = await db.doctorWorkingHours.findMany({
    where: { organisationId, doctorId },
    select: { weekday: true, startAtMinute: true, endAtMinute: true },
    orderBy: [{ weekday: 'asc' }, { startAtMinute: 'asc' }],
  });

  return rows.map((row) => ({
    weekday: row.weekday,
    opensAtMinute: row.startAtMinute,
    closesAtMinute: row.endAtMinute,
  }));
};

/**
 * Replaces a doctor's whole week, as the clinic's hours are replaced: delete and insert in
 * the one transaction the service opened. False when the doctor is not in this clinic.
 */
export const replaceDoctorHours = async (
  db: TenantDb,
  organisationId: string,
  doctorId: string,
  segments: readonly HoursRow[],
): Promise<boolean> => {
  const doctor = await db.doctor.findFirst({
    where: { id: doctorId, organisationId, deletedAt: null },
    select: { id: true },
  });

  if (doctor === null) {
    return false;
  }

  await db.doctorWorkingHours.deleteMany({ where: { organisationId, doctorId } });

  if (segments.length > 0) {
    await db.doctorWorkingHours.createMany({
      data: segments.map((segment) => ({
        id: uuidV7(),
        organisationId,
        doctorId,
        weekday: segment.weekday,
        startAtMinute: segment.opensAtMinute,
        endAtMinute: segment.closesAtMinute,
      })),
    });
  }

  return true;
};

export type SarvamMappingWrite = {
  readonly sarvamAppId: string | null;
  readonly sarvamAppVersion: string | null;
  readonly sarvamDeploymentId: string | null;
  readonly sarvamConnectionId: string | null;
  readonly promptVersion: string | null;
  /** Set only when a secret is being minted. Absent leaves the stored hash alone. */
  readonly toolSecretHash?: string;
  readonly toolSecretSetAt?: Date;
  readonly webhookSecretHash?: string;
  readonly webhookSecretSetAt?: Date;
};

export const updateSarvamMapping = async (
  db: TenantDb,
  organisationId: string,
  data: SarvamMappingWrite,
): Promise<void> => {
  const row = {
    sarvamAppId: data.sarvamAppId,
    sarvamAppVersion: data.sarvamAppVersion,
    sarvamDeploymentId: data.sarvamDeploymentId,
    sarvamConnectionId: data.sarvamConnectionId,
    promptVersion: data.promptVersion,
    ...(data.toolSecretHash === undefined ? {} : { toolSecretHash: data.toolSecretHash }),
    ...(data.toolSecretSetAt === undefined ? {} : { toolSecretSetAt: data.toolSecretSetAt }),
    ...(data.webhookSecretHash === undefined ? {} : { webhookSecretHash: data.webhookSecretHash }),
    ...(data.webhookSecretSetAt === undefined
      ? {}
      : { webhookSecretSetAt: data.webhookSecretSetAt }),
  };

  /**
   * UPSERTED, because a clinic made by the seed or by `pnpm provision:clinic` has no agent row.
   * This was an `updateMany`, which matched nothing on such a clinic and returned normally, so
   * the save answered 200 and showed both secrets while storing neither: the operator pasted
   * credentials into Sarvam that authenticated nothing.
   */
  await db.voiceAgent.upsert({
    where: { organisationId_provider: { organisationId, provider: Provider.SARVAM } },
    create: { id: uuidV7(), organisationId, provider: Provider.SARVAM, ...row },
    update: row,
  });
};

/**
 * Points the clinic's agent at a phone number, replacing whatever it pointed at before.
 *
 * REPLACES RATHER THAN ADDS, which matters because both kinds of number are unique across
 * the whole platform by a partial index in prisma/sql. An operator correcting a typo would
 * otherwise leave the mistyped number attached to this clinic for ever, and that number
 * could then never be assigned to the clinic it really belongs to. The old rows go first:
 * `voice_agents.agent_number_id` is ON DELETE SET NULL, which is harmless because the next
 * statement sets it.
 */
export const setAgentNumber = async (
  db: TenantDb,
  organisationId: string,
  e164: string,
): Promise<void> => {
  await replaceNumberOfKind(
    db,
    organisationId,
    e164,
    PhoneKind.AGENT_NUMBER,
    'Sarvam agent number',
  );

  const number = await db.phoneNumber.findFirst({
    where: { organisationId, e164 },
    select: { id: true },
  });

  await db.voiceAgent.updateMany({
    where: { organisationId, provider: Provider.SARVAM },
    data: { agentNumberId: number?.id ?? null },
  });
};

/** Replaces the clinic's own public line. One clinic, one line. */
/** Whether each Sarvam secret exists, without reading either hash out of the function. */
export const findSecretState = async (
  db: TenantDb,
  organisationId: string,
): Promise<{ readonly toolSecretSet: boolean; readonly webhookSecretSet: boolean }> => {
  const agent = await db.voiceAgent.findFirst({
    where: { organisationId, provider: Provider.SARVAM },
    select: { toolSecretHash: true, webhookSecretHash: true },
  });

  return {
    toolSecretSet: agent?.toolSecretHash != null,
    webhookSecretSet: agent?.webhookSecretHash != null,
  };
};

const numberOfKind = async (
  db: TenantDb,
  organisationId: string,
  kind: PhoneKind,
): Promise<string | null> =>
  (
    await db.phoneNumber.findFirst({
      where: { organisationId, kind },
      select: { e164: true },
    })
  )?.e164 ?? null;

/** The clinic's own line, the number the agent gives a caller who needs a person. */
export const findClinicLine = (db: TenantDb, organisationId: string): Promise<string | null> =>
  numberOfKind(db, organisationId, PhoneKind.CLINIC_LINE);

/** The number patients dial to reach the agent. */
export const findAgentNumber = (db: TenantDb, organisationId: string): Promise<string | null> =>
  numberOfKind(db, organisationId, PhoneKind.AGENT_NUMBER);

export const setClinicLine = async (
  db: TenantDb,
  organisationId: string,
  e164: string,
): Promise<void> => {
  await replaceNumberOfKind(db, organisationId, e164, PhoneKind.CLINIC_LINE, 'Clinic line');
};

const replaceNumberOfKind = async (
  db: TenantDb,
  organisationId: string,
  e164: string,
  kind: PhoneKind,
  label: string,
): Promise<void> => {
  await db.phoneNumber.deleteMany({
    where: { organisationId, kind, e164: { not: e164 } },
  });

  await db.phoneNumber.upsert({
    where: { organisationId_e164: { organisationId, e164 } },
    create: { id: uuidV7(), organisationId, e164, kind, label },
    update: { kind, label },
    select: { id: true },
  });
};

/**
 * Whether an error is a unique-constraint violation, and on which constraint.
 *
 * Here rather than in the service because recognising it means knowing Prisma's error
 * shape, and apps/api/CLAUDE.md keeps Prisma inside the repository. The service maps the
 * answer to a 409 with a message naming what collided.
 */
export const uniqueViolationTarget = (error: unknown): string | undefined => {
  if (typeof error !== 'object' || error === null) {
    return undefined;
  }

  const candidate = error as { code?: unknown; meta?: { target?: unknown } };

  if (candidate.code !== 'P2002') {
    return undefined;
  }

  const target = candidate.meta?.target;

  if (typeof target === 'string') {
    return target;
  }

  if (Array.isArray(target)) {
    return target.map(String).join(', ');
  }

  // A violation Prisma could not attribute to a named constraint. Still a 409.
  return 'unknown';
};
