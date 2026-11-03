import { z } from 'zod';
import { isClinicDay } from '@clinicai/shared';

/**
 * What the voice agent sends, and what it gets back.
 *
 * ─── EVERY INPUT IS FORGIVING, EVERY COMMITMENT IS STRICT ───────────────────────
 *
 * These bodies are filled by a language model from what a patient said out loud, so a
 * number arrives with spaces in it and a doctor arrives as a name rather than a uuid. The
 * schemas accept that shape and the SERVICE resolves it, refusing to guess: an ambiguous
 * doctor or an unusable number comes back as a question for the caller, never as a booking
 * made on an assumption.
 *
 * ─── TIMES ARE THE CLINIC'S LOCAL DATE AND TIME, NOT AN INSTANT ─────────────────
 *
 * `date` plus `time` in the clinic's own zone, because that is what was said on the
 * telephone: "Tuesday at half past ten". Asking the agent for a UTC instant would make a
 * language model do timezone arithmetic, and the failure mode is an appointment five and a
 * half hours out that reads as a plausible time. The conversion happens here, once, from
 * the clinic's configured zone.
 */

const clinicDay = z
  .string()
  .trim()
  .refine(isClinicDay, { message: 'must be a date as YYYY-MM-DD' });

/** `HH:MM` on a 24-hour clock, which is what the prompt instructs the agent to send. */
const clinicTime = z
  .string()
  .trim()
  .regex(/^([01]\d|2[0-3]):([0-5]\d)$/, 'must be a time as HH:MM');

/**
 * Loose on the way in, normalised in the service.
 *
 * NOT the shared E.164 schema. That one refuses anything incomplete, which is right for a
 * form and wrong here: `98765 43210` spoken digit by digit must become a number rather
 * than a rejection the patient hears as "sorry, I cannot help you".
 */
const spokenPhone = z.string().trim().min(4).max(32);

const spokenName = z.string().trim().min(1).max(200);

/**
 * WHO IS CALLING: the caller's own line, from the provider's call context, never from speech.
 *
 * Each Sarvam tool's body is a template we author in its dashboard, and the contract lists
 * the caller's number ("User Identifier") among the call-context variables a tool can use
 * (`docs/sarvam-contract.md` section 2). Every tool that touches a patient's record templates
 * it in as `callerNumber`. It is the ONLY thing that identifies a patient (Feature 3 review,
 * C2): a number the caller speaks is somebody's number, not proof of being them.
 *
 * OPTIONAL because a withheld or unrecognisable line must not cost a patient their booking.
 * Without it the caller is treated as new, and nothing is looked up, moved or cancelled.
 */
const callerNumber = z.string().trim().min(4).max(32).optional();

/**
 * The provider's own identifiers for the call and this tool invocation.
 *
 * BOTH OPTIONAL AND BOTH UNKNOWN. Whether Sarvam sends anything of the kind to a tool is
 * an open question in `docs/sarvam-contract.md`. When they arrive they compose the
 * idempotency key, so a retried tool call books once. When they do not, an
 * `Idempotency-Key` header is used if present, and without either a retry books twice,
 * which is why the question matters and is written down rather than assumed away.
 */
const callIdentifiers = {
  callId: z.string().trim().min(1).max(200).optional(),
  toolCallId: z.string().trim().min(1).max(200).optional(),
};

/** Which doctor and which service, by id or by what the patient called them. */
const targets = {
  doctorId: z.uuid().optional(),
  doctorName: spokenName.optional(),
  serviceId: z.uuid().optional(),
  serviceName: spokenName.optional(),
};

export const CLINIC_INFO_TOPICS = ['hours', 'address', 'services', 'general'] as const;

export const clinicInfoBodySchema = z.object({
  topic: z.enum(CLINIC_INFO_TOPICS).default('general'),
});

/**
 * Whether the caller's own line belongs to a patient. There is no spoken number here, so
 * nobody can ask whether some other number is a patient of this clinic.
 */
export const lookupPatientBodySchema = z.object({
  callerNumber,
  /** Narrows a line that several records share, which a family's number usually is. */
  fullName: spokenName.optional(),
});

export const checkAvailabilityBodySchema = z.object({
  date: clinicDay,
  ...targets,
});

export const bookBodySchema = z.object({
  callerNumber,
  /**
   * A contact number the caller SPOKE, used for one thing only: the record of a new patient
   * calling from a line we cannot see. It is never searched, so it cannot find anybody.
   */
  phone: spokenPhone.optional(),
  /** Required only when the caller has no record yet, which the service decides. */
  fullName: spokenName.optional(),
  date: clinicDay,
  time: clinicTime,
  ...targets,
  ...callIdentifiers,
});

/**
 * Moving and cancelling act only on appointments belonging to the caller's own line. An
 * `appointmentId` picks between that line's appointments and is refused if it is not one.
 */
export const rescheduleBodySchema = z.object({
  callerNumber,
  appointmentId: z.uuid().optional(),
  /** Narrows a line several patients share, as on the lookup. */
  fullName: spokenName.optional(),
  date: clinicDay,
  time: clinicTime,
  ...callIdentifiers,
});

export const cancelBodySchema = z.object({
  callerNumber,
  appointmentId: z.uuid().optional(),
  fullName: spokenName.optional(),
  /**
   * Bounded free text, and not patient data by intention (as on the dashboard's cancel).
   * "The patient asked to cancel" is a reason. No schema can stop a model writing a
   * symptom here, so the control is that it is never logged.
   */
  reason: z.string().trim().max(500).optional(),
  ...callIdentifiers,
});

export type ClinicInfoBody = z.infer<typeof clinicInfoBodySchema>;
export type LookupPatientBody = z.infer<typeof lookupPatientBodySchema>;
export type CheckAvailabilityBody = z.infer<typeof checkAvailabilityBodySchema>;
export type BookBody = z.infer<typeof bookBodySchema>;
export type RescheduleBody = z.infer<typeof rescheduleBodySchema>;
export type CancelBody = z.infer<typeof cancelBodySchema>;

/**
 * The envelope every tool answers with, successfully or not.
 *
 * `message` IS SPOKEN TO A PATIENT, so it is a whole short sentence rather than an error
 * code, and it carries no patient data beyond what this caller already told us. `data` is
 * for the agent to reason with and is null on a refusal.
 */
export const toolEnvelopeSchema = z.object({
  ok: z.boolean(),
  message: z.string(),
  data: z.unknown().nullable(),
});

export type ToolEnvelope<T> = {
  readonly ok: boolean;
  readonly message: string;
  readonly data: T | null;
};
