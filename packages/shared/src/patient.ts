import { z } from 'zod';
import { isClinicDay } from './clinic-time.js';
import { phoneSchema } from './clinic.js';

/**
 * The patient contract: what a clinic records about a person.
 *
 * SHARED BETWEEN THE API AND THE DASHBOARD, so a form and a route validate the same rules
 * rather than two descriptions of them that drift. The API parses with these; the form uses
 * them as its resolver.
 *
 * EVERY FIELD HERE IS PATIENT HEALTH DATA except `active`. Nothing in this file may be
 * logged, echoed in an error message, or put in an audit row (root CLAUDE.md rules 4 and 5).
 * The schemas name fields and constraints, never values, for that reason.
 *
 * WHAT IS REQUIRED, AND WHY ONLY THOSE TWO. A name and a number are the whole of what the
 * voice agent can collect from a caller who is booking for the first time, and a record it
 * cannot create is a booking it cannot make. A date of birth is how two people with one
 * name are told apart, so it is offered and not demanded.
 */

const fullName = z
  .string()
  .trim()
  .min(1, 'is required')
  .max(200, 'is too long')
  /**
   * One character is enough for a mononym, and a name is never validated against a pattern.
   *
   * A regular expression over names is a bug factory: it refuses the names of real people,
   * and the people it refuses are never the ones who wrote it. The only rules here are that
   * something was entered and that it fits the column.
   */
  .describe('patient name');

/** Blank means not collected, exactly as in the clinic sections (D-013). */
const optionalText = (max: number) =>
  z.preprocess(
    (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
    z.string().trim().max(max).nullable(),
  );

/**
 * A date of birth as a clinic-local calendar day.
 *
 * A DAY, NOT AN INSTANT, which is why it is not a `z.coerce.date()`. A birthday has no time
 * and no zone: storing it as a timestamp means a patient born on the 1st shows as the 31st
 * for anyone reading it west of the clinic, which is the single most common date bug in
 * clinical software. The column is a PostgreSQL `date` for the same reason.
 */
const dateOfBirth = z.preprocess(
  (value) => (typeof value === 'string' && value.trim() === '' ? null : value),
  z
    .string()
    .refine((value) => isClinicDay(value), { message: 'must be a date as yyyy-MM-dd' })
    .refine(
      (value) => {
        // A birth date in the future is a typo every time. 150 years is the other end:
        // it catches a year typed as 1890 without refusing a genuinely old patient.
        const today = new Date();
        const earliest = new Date(
          Date.UTC(today.getUTCFullYear() - 150, today.getUTCMonth(), today.getUTCDate()),
        );
        const parsed = new Date(`${value}T00:00:00.000Z`);

        return parsed <= today && parsed >= earliest;
      },
      { message: 'must be in the past and within the last 150 years' },
    )
    .nullable(),
);

export const patientSchema = z.object({
  fullName,
  phone: phoneSchema,
  dateOfBirth,
  notes: optionalText(2000),
});

export type PatientInput = z.infer<typeof patientSchema>;

/**
 * A partial update, where an ABSENT field means "leave it alone" and an explicit null means
 * "clear it".
 *
 * The distinction matters here in a way it does not for the clinic sections, which are
 * replaced whole: a patient is edited one field at a time from a form that does not always
 * show every field, and treating absence as a clear would silently delete the notes every
 * time somebody corrected a phone number.
 */
export const updatePatientSchema = patientSchema
  .partial()
  .refine((value) => Object.keys(value).length > 0, { message: 'nothing to update' });

export type UpdatePatientInput = z.infer<typeof updatePatientSchema>;

/** How a patient list may be sorted. Fixed, because an open sort field is an index scan. */
export const PATIENT_SORTS = ['recent', 'name'] as const;

export type PatientSort = (typeof PATIENT_SORTS)[number];
