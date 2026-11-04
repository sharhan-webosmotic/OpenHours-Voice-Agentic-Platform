import { describe, expect, it } from 'vitest';
import { patientSchema, updatePatientSchema } from './patient.js';

/**
 * No real patient data in here, which is the rule for test data (root CLAUDE.md rule 6).
 * The names are obviously synthetic and the numbers are in the Indian mobile range without
 * belonging to anyone.
 */

const valid = {
  fullName: 'Test Patient One',
  phone: '98765 43210',
  dateOfBirth: '1988-06-14',
  notes: '',
};

describe('patientSchema', () => {
  it('normalises a number typed the way a receptionist types it', () => {
    // +91 is the default country code, so a ten-digit local number is understood.
    expect(patientSchema.parse(valid).phone).toBe('+919876543210');
    expect(patientSchema.parse({ ...valid, phone: '+91 98765 43210' }).phone).toBe('+919876543210');
  });

  it('trims the name and keeps it exactly as entered otherwise', () => {
    // No pattern is applied to a name: a regular expression over names refuses real people.
    expect(patientSchema.parse({ ...valid, fullName: "  O'Brien-Nayar  " }).fullName).toBe(
      "O'Brien-Nayar",
    );
    expect(patientSchema.parse({ ...valid, fullName: 'ಅ' }).fullName).toBe('ಅ');
  });

  it('turns blank optional fields into null rather than empty strings', () => {
    const parsed = patientSchema.parse({ ...valid, dateOfBirth: '   ', notes: '' });

    expect(parsed.dateOfBirth).toBeNull();
    expect(parsed.notes).toBeNull();
  });

  it('refuses a missing name and an unusable number', () => {
    expect(patientSchema.safeParse({ ...valid, fullName: '   ' }).success).toBe(false);
    expect(patientSchema.safeParse({ ...valid, phone: '12345' }).success).toBe(false);
  });

  it('refuses a date of birth in the future or implausibly far in the past', () => {
    expect(patientSchema.safeParse({ ...valid, dateOfBirth: '2099-01-01' }).success).toBe(false);
    expect(patientSchema.safeParse({ ...valid, dateOfBirth: '1820-01-01' }).success).toBe(false);
  });

  it('refuses a date of birth that is not a real day', () => {
    expect(patientSchema.safeParse({ ...valid, dateOfBirth: '1988-02-30' }).success).toBe(false);
    expect(patientSchema.safeParse({ ...valid, dateOfBirth: '14/06/1988' }).success).toBe(false);
  });

  it('names the field that failed and never repeats the value', () => {
    const result = patientSchema.safeParse({ ...valid, phone: 'not a number' });

    expect(result.success).toBe(false);
    if (!result.success) {
      const issue = result.error.issues[0];
      expect(issue?.path).toEqual(['phone']);
      // The message may describe the format; it must not contain what was sent.
      expect(issue?.message).not.toContain('not a number');
    }
  });
});

describe('updatePatientSchema', () => {
  it('accepts one field on its own', () => {
    expect(updatePatientSchema.parse({ notes: 'Prefers morning appointments.' })).toEqual({
      notes: 'Prefers morning appointments.',
    });
  });

  it('distinguishes an absent field from one being cleared', () => {
    // Absent: the notes are untouched. Explicit null: the notes are cleared. Collapsing the
    // two would wipe a patient's notes every time somebody corrected a phone number.
    expect(updatePatientSchema.parse({ phone: '98765 43210' })).not.toHaveProperty('notes');
    expect(updatePatientSchema.parse({ notes: '' })).toEqual({ notes: null });
  });

  it('refuses an empty update rather than performing a write that changes nothing', () => {
    expect(updatePatientSchema.safeParse({}).success).toBe(false);
  });
});

describe('sex and email on a patient', () => {
  it('records neither when a caller sends neither, as the voice agent does', () => {
    const parsed = patientSchema.parse(valid);

    expect(parsed.sex).toBeUndefined();
    expect(parsed.email).toBeUndefined();
  });

  it('accepts only the two values the clinic chose, and reads a blank as not recorded', () => {
    expect(patientSchema.parse({ ...valid, sex: 'FEMALE' }).sex).toBe('FEMALE');
    expect(patientSchema.parse({ ...valid, sex: '' }).sex).toBeNull();
    expect(patientSchema.safeParse({ ...valid, sex: 'OTHER' }).success).toBe(false);
  });

  it('stores one address however it was typed', () => {
    expect(patientSchema.parse({ ...valid, email: '  Laura@Example.COM ' }).email).toBe(
      'laura@example.com',
    );
    expect(patientSchema.parse({ ...valid, email: '' }).email).toBeNull();
  });

  it('refuses an address that is not one, or is longer than SMTP allows', () => {
    expect(patientSchema.safeParse({ ...valid, email: 'not-an-address' }).success).toBe(false);
    expect(patientSchema.safeParse({ ...valid, email: `${'a'.repeat(250)}@x.in` }).success).toBe(
      false,
    );
  });

  it('leaves both alone on an update that does not name them', () => {
    const parsed = updatePatientSchema.parse({ fullName: 'Renamed' });

    expect('sex' in parsed).toBe(false);
    expect('email' in parsed).toBe(false);
  });
});
