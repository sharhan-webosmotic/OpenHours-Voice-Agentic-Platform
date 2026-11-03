import { z } from 'zod';
import { isE164, normalisePhone } from './phone.js';
import { isIanaTimeZone } from './timezone.js';

/**
 * The clinic configuration contract: what we ask a clinic for, in the shape we store it.
 *
 * ONE DEFINITION, used by the API's routes, the admin console's forms and the prompt
 * renderer. A second copy in a web app would be a second opinion about what a valid
 * opening hour is, and the first divergence would be a clinic whose dashboard accepts a
 * schedule the agent then cannot read.
 *
 * EVERY FIELD IS OPTIONAL OR NULLABLE, deliberately. A clinic is configured by hand over
 * several conversations, so a half-collected clinic has to be a storable state rather than
 * a validation failure. What must be present before the voice agent can take a real call
 * is a separate question, answered by `clinic-readiness.ts`, which is the only place that
 * says "required".
 *
 * PHONE NUMBERS ARE NORMALISED HERE, not merely validated, so a number typed as
 * `98765 43210` is stored as `+919876543210` and matches the number an inbound call
 * arrives on. See phone.ts for why there is a default country code.
 */

export const WEEKDAYS = [
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
  'SUNDAY',
] as const;

export type Weekday = (typeof WEEKDAYS)[number];

export const AGENT_TONES = ['FORMAL', 'FRIENDLY', 'NEUTRAL'] as const;

export type AgentTone = (typeof AGENT_TONES)[number];

/**
 * How recording consent is obtained, which is a legal question and not a preference.
 *
 * `NOT_RECORDED` is the only setting that needs no consent, because nothing is kept.
 * `ANNOUNCEMENT` plays a notice and continues. `EXPLICIT_OPT_IN` requires the caller to
 * agree before recording starts. The platform stores the choice; honouring it is the
 * agent's behaviour and the recording pipeline's, both of which arrive with the voice work.
 */
export const RECORDING_CONSENT_MODES = ['NOT_RECORDED', 'ANNOUNCEMENT', 'EXPLICIT_OPT_IN'] as const;

export type RecordingConsentMode = (typeof RECORDING_CONSENT_MODES)[number];

export const ORGANISATION_STATUSES = ['ACTIVE', 'SUSPENDED', 'DEACTIVATED'] as const;

export type OrganisationStatus = (typeof ORGANISATION_STATUSES)[number];

/** Minutes from clinic-local midnight. 1440 is midnight at the end of the day. */
export const MINUTES_IN_DAY = 1440;

const minuteOfDay = z
  .number()
  .int('must be a whole number of minutes')
  .min(0, 'cannot be before midnight')
  .max(MINUTES_IN_DAY, 'cannot be after midnight');

/**
 * An empty value means NOT COLLECTED, for every optional field in this file.
 *
 * This is the difference between a usable form and an unusable one, and it was a real
 * defect rather than a theoretical nicety. An HTML input has no null: an uncollected field
 * arrives as `''`. With `contactEmail` validated as an email and `contactPhone` as a phone
 * number, a clinic whose email nobody had asked for yet could not have its ADDRESS saved,
 * because the empty email failed and took the whole section with it. That contradicts the
 * one rule this contract is built on, which is that every field is nullable until collected.
 *
 * So blank becomes null before the inner schema runs, and the inner schema only ever sees a
 * value somebody actually entered.
 */
const blankToNull = <T extends z.ZodType>(inner: T) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    inner.nullable(),
  );

/** Trimmed, bounded free text. Blank means not collected. */
const text = (max: number) => blankToNull(z.string().trim().max(max));

/** Required-shaped text, for the few fields that cannot be blank once given. */
const requiredText = (max: number) => z.string().trim().min(1).max(max);

/**
 * A phone number in any form a human types, stored in E.164.
 *
 * The transform runs after the refine, so a rejected number never reaches it.
 */
export const phoneSchema = z
  .string()
  .trim()
  .refine((value) => normalisePhone(value).ok, {
    message: 'must be a usable phone number, for example 98765 43210 or +91 98765 43210',
  })
  .transform((value) => {
    const result = normalisePhone(value);
    // Unreachable: the refine above has already rejected every failing input. Throwing
    // rather than returning the raw value, because storing an unnormalised number is the
    // defect this schema exists to prevent.
    if (!result.ok) {
      throw new Error('phone normalisation disagreed with its own validation');
    }
    return result.e164;
  });

/** An already-normalised number, for reading stored values back. */
export const e164Schema = z.string().refine(isE164, { message: 'must be an E.164 number' });

export const timezoneSchema = z
  .string()
  .trim()
  .refine(isIanaTimeZone, { message: 'must be an IANA time zone name, for example Asia/Kolkata' });

/**
 * A URL we are willing to put in front of a clinic's patients or staff.
 *
 * `http` is refused: a map link or website rendered in the dashboard over plain HTTP is a
 * downgrade we would be choosing on the clinic's behalf.
 */
const httpsUrl = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .refine((value) => value === '' || /^https:\/\/\S+$/.test(value), {
      message: 'must be an https:// URL',
    })
    .transform((value) => (value === '' ? null : value))
    .nullable();

// ─── Identity, which lives on the organisation itself ───────────────────────────

export const createOrganisationSchema = z.object({
  name: requiredText(200),
  timezone: timezoneSchema,
  /**
   * The clinic's own public line, required at creation.
   *
   * Required because it is the one field that makes a newly created clinic identifiable in
   * the list, and because it is the uniqueness key that stops a double-submitted create
   * leaving two half-configured clinics behind. See the unique index in prisma/sql.
   */
  clinicPhone: phoneSchema,
});

export type CreateOrganisationInput = z.infer<typeof createOrganisationSchema>;

export const updateOrganisationSchema = z
  .object({
    name: requiredText(200).optional(),
    timezone: timezoneSchema.optional(),
    status: z.enum(ORGANISATION_STATUSES).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, { message: 'nothing to update' });

export type UpdateOrganisationInput = z.infer<typeof updateOrganisationSchema>;

// ─── Identity and contact, address and map link ─────────────────────────────────

export const clinicProfileSchema = z.object({
  legalName: text(200),
  /**
   * Lower-cased before validation, so the stored value matches the `citext` column the
   * users table already uses and two spellings of one address cannot both be stored.
   */
  contactEmail: blankToNull(
    z.string().trim().toLowerCase().pipe(z.email('must be an email address').max(254)),
  ),
  contactPhone: blankToNull(phoneSchema),
  website: httpsUrl(500),
  addressLine1: text(200),
  addressLine2: text(200),
  city: text(100),
  state: text(100),
  postalCode: text(20),
  /** ISO 3166-1 alpha-2, upper case. Two letters is checkable; a country name is not. */
  country: blankToNull(
    z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z]{2}$/, 'must be a two-letter country code, for example IN'),
  ),
  mapUrl: httpsUrl(1000),
});

export type ClinicProfileInput = z.infer<typeof clinicProfileSchema>;

// ─── Opening hours, with breaks and a weekly off ────────────────────────────────

export const hoursSegmentSchema = z
  .object({
    opensAtMinute: minuteOfDay,
    closesAtMinute: minuteOfDay,
  })
  .refine((segment) => segment.closesAtMinute > segment.opensAtMinute, {
    message: 'must close after it opens, and an overnight segment is not supported yet',
    path: ['closesAtMinute'],
  });

export type HoursSegment = z.infer<typeof hoursSegmentSchema>;

/**
 * One weekday's opening, as an ordered list of segments.
 *
 * A BREAK IS THE GAP BETWEEN TWO SEGMENTS. 09:00-13:00 plus 17:00-20:00 is a clinic with a
 * four-hour afternoon break, and that shape expresses two breaks as easily as one, which
 * explicit break columns cannot. A WEEKLY OFF IS A WEEKDAY WITH NO SEGMENTS.
 *
 * Segments must be ordered and must not touch. Touching segments (13:00-17:00 followed by
 * 17:00-20:00) describe a break of zero length, which is one opening written as two rows,
 * and allowing both spellings of the same schedule means the prompt renderer and the
 * availability query would have to agree on how to collapse them.
 */
export const dayHoursSchema = z
  .object({
    weekday: z.enum(WEEKDAYS),
    segments: z.array(hoursSegmentSchema).max(4, 'at most four opening segments in a day'),
  })
  .superRefine((day, ctx) => {
    const sorted = [...day.segments].sort((a, b) => a.opensAtMinute - b.opensAtMinute);

    for (const [index, segment] of day.segments.entries()) {
      if (segment !== sorted[index]) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments'],
          message: 'segments must be in order, earliest first',
        });
        break;
      }
    }

    for (let index = 1; index < sorted.length; index += 1) {
      const previous = sorted[index - 1];
      const current = sorted[index];
      if (previous === undefined || current === undefined) {
        continue;
      }
      if (current.opensAtMinute <= previous.closesAtMinute) {
        ctx.addIssue({
          code: 'custom',
          path: ['segments', index, 'opensAtMinute'],
          message:
            'segments must not overlap or touch: leave a real gap, which is the break, or use one segment',
        });
      }
    }
  });

export type DayHours = z.infer<typeof dayHoursSchema>;

/**
 * The whole week, replaced in one call.
 *
 * ALL SEVEN WEEKDAYS ARE REQUIRED, which is what makes a weekly off readable. A payload
 * that simply omitted Sunday would be indistinguishable from a clinic whose Sunday has not
 * been asked about yet, and the agent would have to guess which. Present with no segments
 * means closed; a weekday absent from the table altogether means not yet collected, and
 * only the hours having never been saved can produce that.
 */
export const clinicHoursSchema = z
  .object({
    days: z.array(dayHoursSchema).length(WEEKDAYS.length),
  })
  .superRefine((value, ctx) => {
    const seen = new Set(value.days.map((day) => day.weekday));

    if (seen.size !== value.days.length) {
      ctx.addIssue({ code: 'custom', path: ['days'], message: 'each weekday may appear once' });
    }

    const missing = WEEKDAYS.filter((weekday) => !seen.has(weekday));
    if (missing.length > 0) {
      ctx.addIssue({
        code: 'custom',
        path: ['days'],
        message: `every weekday must be stated, including the closed ones. Missing: ${missing.join(', ')}`,
      });
    }
  });

export type ClinicHoursInput = z.infer<typeof clinicHoursSchema>;

// ─── Booking policy ─────────────────────────────────────────────────────────────

export const bookingPolicySchema = z
  .object({
    /** The grid appointments sit on. 5 to 120 minutes, because neither extreme is bookable. */
    slotGranularityMinutes: z.number().int().min(5).max(120).nullable(),
    /** How soon before a slot a booking may still be made. */
    minimumNoticeMinutes: z
      .number()
      .int()
      .min(0)
      .max(30 * MINUTES_IN_DAY)
      .nullable(),
    /** How far ahead the agent may book. */
    maximumAdvanceDays: z.number().int().min(1).max(365).nullable(),
    /** How late a patient may cancel without it counting as a no-show. */
    cancellationWindowHours: z.number().int().min(0).max(168).nullable(),
    acceptsNewPatients: z.boolean().nullable(),
    /** Gap enforced after every appointment, unless a doctor overrides it. */
    defaultBufferMinutes: z.number().int().min(0).max(120).nullable(),
    /** More than one only for clinics that deliberately overbook. */
    maxPerSlot: z.number().int().min(1).max(10).nullable(),
    /** What the clinic does about a no-show. Read to the caller, so it is text. */
    noShowPolicy: text(1000),
  })
  .refine(
    (value) =>
      value.slotGranularityMinutes === null ||
      value.defaultBufferMinutes === null ||
      value.defaultBufferMinutes < value.slotGranularityMinutes * 10,
    {
      path: ['defaultBufferMinutes'],
      message: 'a buffer that large relative to the slot size would make the day unbookable',
    },
  );

export type BookingPolicyInput = z.infer<typeof bookingPolicySchema>;

// ─── Agent behaviour ────────────────────────────────────────────────────────────

/**
 * A language tag, checked for BCP-47 shape rather than against a list.
 *
 * NOT validated against Sarvam's supported set, because that set is the provider's and we
 * have not confirmed it. `SUGGESTED_AGENT_LANGUAGES` is what the console offers, and
 * `docs/features/pilot-clinic.md` records that the codes have to be confirmed during the
 * manual Sarvam setup. Inventing a provider contract here is the one thing the brief
 * forbids outright.
 */
export const languageTagSchema = z
  .string()
  .trim()
  .regex(/^[a-z]{2,3}(-[A-Za-z]{2,4})?(-[A-Za-z0-9]{2,8})?$/, 'must be a language tag like en-IN');

export const SUGGESTED_AGENT_LANGUAGES = [
  'en-IN',
  'hi-IN',
  'bn-IN',
  'gu-IN',
  'kn-IN',
  'ml-IN',
  'mr-IN',
  'pa-IN',
  'ta-IN',
  'te-IN',
] as const;

export const agentProfileSchema = z.object({
  /** The first thing a caller hears. */
  greeting: text(500),
  languages: z.array(languageTagSchema).max(10),
  tone: z.enum(AGENT_TONES).nullable(),
  /** What the agent says when there is nothing to offer. */
  fullyBookedResponse: text(500),
  /** When to hand the call to a human, in the clinic's own words. */
  escalationRules: text(2000),
  /**
   * Things the agent must never say, as discrete items rather than a paragraph.
   *
   * Discrete because each one becomes a line in the rendered prompt, and because this is
   * the clinical safety boundary (root CLAUDE.md rule 9): a clinic adding "never tell a
   * caller to stop their medication" is stating a constraint, not writing prose.
   */
  neverPromise: z.array(requiredText(200)).max(20),
});

export type AgentProfileInput = z.infer<typeof agentProfileSchema>;

// ─── Frequently asked answers ───────────────────────────────────────────────────

export const faqSchema = z.object({
  question: requiredText(300),
  answer: requiredText(2000),
  active: z.boolean(),
});

export type FaqInput = z.infer<typeof faqSchema>;

/** Replaced as a whole list, so the order the clinic gave is the order stored. */
export const clinicFaqsSchema = z.object({
  faqs: z.array(faqSchema).max(50),
});

export type ClinicFaqsInput = z.infer<typeof clinicFaqsSchema>;

// ─── Telephony and recording consent ────────────────────────────────────────────

export const telephonySchema = z
  .object({
    recordingConsentMode: z.enum(RECORDING_CONSENT_MODES).nullable(),
    /** The exact words played to the caller. Stored so it is auditable, not guessed. */
    consentAnnouncement: text(1000),
    /** Set when someone at the clinic confirms the arrangement is theirs. */
    consentConfirmed: z.boolean(),
    /** Who at the clinic confirmed it. A staff name, not a patient's, so it may be stored. */
    consentConfirmedByName: text(200),
  })
  .superRefine((value, ctx) => {
    // A mode that plays a notice without the notice having been written is a clinic that
    // believes callers are being told something they are not.
    if (
      (value.recordingConsentMode === 'ANNOUNCEMENT' ||
        value.recordingConsentMode === 'EXPLICIT_OPT_IN') &&
      (value.consentAnnouncement === null || value.consentAnnouncement === '')
    ) {
      ctx.addIssue({
        code: 'custom',
        path: ['consentAnnouncement'],
        message: 'this consent mode plays a notice, so the notice has to say something',
      });
    }

    if (value.consentConfirmed && (value.consentConfirmedByName ?? '') === '') {
      ctx.addIssue({
        code: 'custom',
        path: ['consentConfirmedByName'],
        message: 'record who at the clinic confirmed it',
      });
    }
  });

export type TelephonyInput = z.infer<typeof telephonySchema>;

// ─── Services and doctors ───────────────────────────────────────────────────────

export const serviceSchema = z.object({
  name: requiredText(200),
  /** Positive, and a real appointment length rather than a whole day. */
  durationMinutes: z.number().int().min(5, 'must be at least 5 minutes').max(480),
  /** Integer paise. Never a float: money must not be approximated (root CLAUDE.md). */
  priceMinor: z.number().int().min(0).max(100_000_000).nullable(),
  active: z.boolean(),
});

export type ServiceInput = z.infer<typeof serviceSchema>;

export const updateServiceSchema = serviceSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'nothing to update' });

export const doctorSchema = z.object({
  fullName: requiredText(200),
  specialty: text(200),
  bufferMinutes: z.number().int().min(0).max(120),
  active: z.boolean(),
});

export type DoctorInput = z.infer<typeof doctorSchema>;

export const updateDoctorSchema = doctorSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'nothing to update' });

// ─── The Sarvam mapping, entered by hand after the manual setup ─────────────────

/**
 * What a person copies out of the Sarvam console and into ours.
 *
 * THE TOOL SECRET IS NOT HERE. It is generated by the platform when the mapping is first
 * saved, shown once and stored only as a hash, exactly like a temporary password (D-003's
 * pattern). An operator-supplied secret would arrive by whatever channel they chose, and a
 * per-clinic secret is the thing that stops one clinic's compromise becoming every
 * clinic's (D-004).
 *
 * Every field is nullable because the mapping is filled in over the course of the manual
 * setup, and a deployment id that does not exist yet must not block saving the app id.
 */
export const sarvamMappingSchema = z.object({
  sarvamAppId: text(200),
  sarvamAppVersion: text(50),
  sarvamDeploymentId: text(200),
  sarvamConnectionId: text(200),
  /** The number callers dial, bought inside Sarvam (D-005). Platform-unique. */
  agentPhone: blankToNull(phoneSchema),
  /** The clinic's own line, which the agent forwards to and announces. */
  clinicPhone: blankToNull(phoneSchema),
  /** Which master prompt version is loaded into the Sarvam agent right now. */
  promptVersion: text(50),
});

export type SarvamMappingInput = z.infer<typeof sarvamMappingSchema>;

// ─── A clinic owner's login, created from the admin console ─────────────────────

/**
 * The person the clinic's first login belongs to.
 *
 * No password field: the platform generates a temporary one, shows it once and stores only its
 * hash (D-003), for the same reason it generates the Sarvam secrets rather than accepting them.
 */
export const createClinicOwnerSchema = z.object({
  fullName: requiredText(200),
  email: z.string().trim().toLowerCase().pipe(z.email('must be an email address').max(254)),
});

export type CreateClinicOwnerInput = z.infer<typeof createClinicOwnerSchema>;
