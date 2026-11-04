import { describe, expect, it } from 'vitest';
import {
  WEEKDAYS,
  agentProfileSchema,
  bookingPolicySchema,
  clinicHoursSchema,
  clinicProfileSchema,
  createOrganisationSchema,
  dayHoursSchema,
  doctorSchema,
  sarvamMappingSchema,
  serviceSchema,
  telephonySchema,
  timezoneSchema,
  updateOrganisationSchema,
  type DayHours,
} from './clinic.js';

/**
 * The data-quality rules from the brief, each with the case that breaks it.
 *
 * A schema test that only feeds valid input proves the parser runs. What makes these worth
 * writing is the rejections: every one of them is a shape that would otherwise reach the
 * database and be read back later as a fact about a real clinic.
 */

const day = (weekday: DayHours['weekday'], segments: DayHours['segments'] = []): DayHours => ({
  weekday,
  segments,
});

const openEveryDay = (segments: DayHours['segments']) =>
  WEEKDAYS.map((weekday) => day(weekday, segments));

describe('timezoneSchema', () => {
  it('accepts a real IANA name', () => {
    expect(timezoneSchema.parse('Asia/Kolkata')).toBe('Asia/Kolkata');
  });

  it('accepts an alias the runtime resolves', () => {
    expect(timezoneSchema.parse('Asia/Calcutta')).toBe('Asia/Calcutta');
  });

  it('rejects an abbreviation, which carries no daylight rules', () => {
    expect(timezoneSchema.safeParse('IST').success).toBe(false);
  });

  it('rejects a bare offset', () => {
    expect(timezoneSchema.safeParse('+05:30').success).toBe(false);
  });

  it('rejects a city that is not a zone', () => {
    expect(timezoneSchema.safeParse('Asia/Bengaluru').success).toBe(false);
  });
});

describe('createOrganisationSchema', () => {
  it('normalises the clinic phone on the way in', () => {
    const parsed = createOrganisationSchema.parse({
      name: '  Sunrise Dental  ',
      timezone: 'Asia/Kolkata',
      clinicPhone: '98765 43210',
    });

    expect(parsed).toEqual({
      name: 'Sunrise Dental',
      timezone: 'Asia/Kolkata',
      clinicPhone: '+919876543210',
    });
  });

  it('refuses a clinic with no name', () => {
    const result = createOrganisationSchema.safeParse({
      name: '   ',
      timezone: 'Asia/Kolkata',
      clinicPhone: '9876543210',
    });
    expect(result.success).toBe(false);
  });

  it('refuses an unusable phone number', () => {
    const result = createOrganisationSchema.safeParse({
      name: 'Sunrise Dental',
      timezone: 'Asia/Kolkata',
      clinicPhone: '12345',
    });
    expect(result.success).toBe(false);
  });
});

describe('updateOrganisationSchema', () => {
  it('refuses an empty patch, which would be an audit row describing nothing', () => {
    expect(updateOrganisationSchema.safeParse({}).success).toBe(false);
  });

  it('accepts a single field', () => {
    expect(updateOrganisationSchema.parse({ status: 'SUSPENDED' })).toEqual({
      status: 'SUSPENDED',
    });
  });
});

describe('clinicProfileSchema', () => {
  const base = {
    legalName: null,
    contactEmail: null,
    contactPhone: null,
    website: null,
    addressLine1: null,
    addressLine2: null,
    city: null,
    state: null,
    postalCode: null,
    country: null,
    mapUrl: null,
  };

  it('accepts a wholly uncollected profile, because collection takes several calls', () => {
    expect(clinicProfileSchema.parse(base)).toEqual(base);
  });

  it('treats a blank field as not collected, so one empty field cannot block the rest', () => {
    /**
     * THIS WAS A REAL DEFECT, found by the admin console's own tests. An HTML input has no
     * null: an uncollected field arrives as `''`. With the email and phone validated
     * strictly, a clinic whose email nobody had asked for yet could not have its ADDRESS
     * saved, because the empty email failed and took the whole section with it.
     *
     * Blank now becomes null before the inner rule runs, which is what makes "every field
     * nullable until collected" true in practice rather than only in the column types.
     */
    const typedByAForm = {
      legalName: '',
      contactEmail: '',
      contactPhone: '',
      website: '',
      addressLine1: '12 MG Road',
      addressLine2: '',
      city: 'Bengaluru',
      state: '',
      postalCode: '',
      country: '',
      mapUrl: '',
    };

    const parsed = clinicProfileSchema.parse(typedByAForm);

    expect(parsed.addressLine1).toBe('12 MG Road');
    expect(parsed.city).toBe('Bengaluru');
    expect(parsed.contactEmail).toBeNull();
    expect(parsed.contactPhone).toBeNull();
    expect(parsed.country).toBeNull();
    expect(parsed.legalName).toBeNull();
  });

  it('still rejects a value that was entered and is wrong', () => {
    // Blank means "not collected"; whitespace and a malformed value are different things,
    // and only the first is forgiven.
    expect(clinicProfileSchema.parse({ ...base, contactEmail: '   ' }).contactEmail).toBeNull();
    expect(clinicProfileSchema.safeParse({ ...base, contactEmail: 'not-an-email' }).success).toBe(
      false,
    );
    expect(clinicProfileSchema.safeParse({ ...base, contactPhone: '12345' }).success).toBe(false);
  });

  it('lower-cases the contact email, so one address has one spelling', () => {
    const parsed = clinicProfileSchema.parse({ ...base, contactEmail: 'Front.Desk@Clinic.IN' });
    expect(parsed.contactEmail).toBe('front.desk@clinic.in');
  });

  it('rejects a malformed email', () => {
    expect(clinicProfileSchema.safeParse({ ...base, contactEmail: 'front desk' }).success).toBe(
      false,
    );
  });

  it('upper-cases a country code and rejects a country name', () => {
    expect(clinicProfileSchema.parse({ ...base, country: 'in' }).country).toBe('IN');
    expect(clinicProfileSchema.safeParse({ ...base, country: 'India' }).success).toBe(false);
  });

  it('refuses a plain-HTTP map link rather than downgrading on the clinic behalf', () => {
    expect(
      clinicProfileSchema.safeParse({ ...base, mapUrl: 'http://maps.example/clinic' }).success,
    ).toBe(false);
    expect(
      clinicProfileSchema.parse({ ...base, mapUrl: 'https://maps.example/clinic' }).mapUrl,
    ).toBe('https://maps.example/clinic');
  });
});

describe('dayHoursSchema', () => {
  it('accepts a weekday with no segments, which is the weekly off', () => {
    expect(dayHoursSchema.parse(day('SUNDAY'))).toEqual(day('SUNDAY'));
  });

  it('accepts two segments with a real gap, which is the lunch break', () => {
    const parsed = dayHoursSchema.parse(
      day('MONDAY', [
        { opensAtMinute: 540, closesAtMinute: 780 },
        { opensAtMinute: 1020, closesAtMinute: 1200 },
      ]),
    );
    expect(parsed.segments).toHaveLength(2);
  });

  it('rejects a segment that closes before it opens', () => {
    const result = dayHoursSchema.safeParse(
      day('MONDAY', [{ opensAtMinute: 780, closesAtMinute: 540 }]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a zero-length segment', () => {
    const result = dayHoursSchema.safeParse(
      day('MONDAY', [{ opensAtMinute: 540, closesAtMinute: 540 }]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects an overnight segment, which is out of scope for now', () => {
    // 22:00 to 02:00 can only be expressed as closes < opens, which is refused.
    const result = dayHoursSchema.safeParse(
      day('FRIDAY', [{ opensAtMinute: 1320, closesAtMinute: 120 }]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects a minute past the end of the day', () => {
    const result = dayHoursSchema.safeParse(
      day('MONDAY', [{ opensAtMinute: 540, closesAtMinute: 1441 }]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects overlapping segments', () => {
    const result = dayHoursSchema.safeParse(
      day('MONDAY', [
        { opensAtMinute: 540, closesAtMinute: 780 },
        { opensAtMinute: 700, closesAtMinute: 1200 },
      ]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects touching segments, which are one opening written as two', () => {
    const result = dayHoursSchema.safeParse(
      day('MONDAY', [
        { opensAtMinute: 540, closesAtMinute: 780 },
        { opensAtMinute: 780, closesAtMinute: 1200 },
      ]),
    );
    expect(result.success).toBe(false);
  });

  it('rejects segments given out of order', () => {
    const result = dayHoursSchema.safeParse(
      day('MONDAY', [
        { opensAtMinute: 1020, closesAtMinute: 1200 },
        { opensAtMinute: 540, closesAtMinute: 780 },
      ]),
    );
    expect(result.success).toBe(false);
  });
});

describe('clinicHoursSchema', () => {
  it('accepts a full week', () => {
    const parsed = clinicHoursSchema.parse({
      days: openEveryDay([{ opensAtMinute: 540, closesAtMinute: 1080 }]),
    });
    expect(parsed.days).toHaveLength(7);
  });

  it('refuses a week with a weekday missing, so a weekly off is never a guess', () => {
    const result = clinicHoursSchema.safeParse({
      days: WEEKDAYS.filter((weekday) => weekday !== 'SUNDAY').map((weekday) => day(weekday)),
    });
    expect(result.success).toBe(false);
  });

  it('refuses a weekday stated twice', () => {
    const days = openEveryDay([]);
    const result = clinicHoursSchema.safeParse({
      days: [...days.slice(0, 6), day('MONDAY')],
    });
    expect(result.success).toBe(false);
  });
});

describe('bookingPolicySchema', () => {
  const base = {
    slotGranularityMinutes: null,
    minimumNoticeMinutes: null,
    maximumAdvanceDays: null,
    cancellationWindowHours: null,
    acceptsNewPatients: null,
    defaultBufferMinutes: null,
    maxPerSlot: null,
    noShowPolicy: null,
  };

  it('accepts an uncollected policy', () => {
    expect(bookingPolicySchema.parse(base)).toEqual(base);
  });

  it('rejects a slot length nothing can be booked in', () => {
    expect(bookingPolicySchema.safeParse({ ...base, slotGranularityMinutes: 0 }).success).toBe(
      false,
    );
    expect(bookingPolicySchema.safeParse({ ...base, slotGranularityMinutes: 1 }).success).toBe(
      false,
    );
  });

  it('rejects a fractional slot length', () => {
    expect(bookingPolicySchema.safeParse({ ...base, slotGranularityMinutes: 12.5 }).success).toBe(
      false,
    );
  });

  it('rejects a buffer so large relative to the slot that the day is unbookable', () => {
    const result = bookingPolicySchema.safeParse({
      ...base,
      slotGranularityMinutes: 5,
      defaultBufferMinutes: 60,
    });
    expect(result.success).toBe(false);
  });

  it('accepts one appointment per slot and refuses overbooking until it exists', () => {
    // The database allows one live appointment per doctor at a time (review I5).
    expect(bookingPolicySchema.safeParse({ ...base, maxPerSlot: 1 }).success).toBe(true);
    expect(bookingPolicySchema.safeParse({ ...base, maxPerSlot: 2 }).success).toBe(false);
  });
});

describe('agentProfileSchema', () => {
  const base = {
    greeting: null,
    languages: [],
    tone: null,
    fullyBookedResponse: null,
    escalationRules: null,
    neverPromise: [],
  };

  it('accepts a language tag and rejects a language name', () => {
    expect(agentProfileSchema.parse({ ...base, languages: ['en-IN', 'hi-IN'] }).languages).toEqual([
      'en-IN',
      'hi-IN',
    ]);
    expect(agentProfileSchema.safeParse({ ...base, languages: ['Hindi'] }).success).toBe(false);
  });

  it('rejects a blank never-promise item, which would render as an empty rule', () => {
    expect(agentProfileSchema.safeParse({ ...base, neverPromise: ['  '] }).success).toBe(false);
  });
});

describe('telephonySchema', () => {
  const base = {
    recordingConsentMode: null,
    consentAnnouncement: null,
    consentConfirmed: false,
    consentConfirmedByName: null,
  };

  it('accepts not recording at all with no announcement', () => {
    expect(
      telephonySchema.safeParse({ ...base, recordingConsentMode: 'NOT_RECORDED' }).success,
    ).toBe(true);
  });

  it('refuses an announcement mode with nothing to announce', () => {
    expect(
      telephonySchema.safeParse({ ...base, recordingConsentMode: 'ANNOUNCEMENT' }).success,
    ).toBe(false);
  });

  it('refuses a confirmation with nobody named', () => {
    const result = telephonySchema.safeParse({
      ...base,
      recordingConsentMode: 'NOT_RECORDED',
      consentConfirmed: true,
    });
    expect(result.success).toBe(false);
  });
});

describe('serviceSchema', () => {
  it('rejects a non-positive duration', () => {
    expect(
      serviceSchema.safeParse({
        name: 'Cleaning',
        durationMinutes: 0,
        priceMinor: null,
        active: true,
      }).success,
    ).toBe(false);
    expect(
      serviceSchema.safeParse({
        name: 'Cleaning',
        durationMinutes: -30,
        priceMinor: null,
        active: true,
      }).success,
    ).toBe(false);
  });

  it('rejects a fractional price, because money is integer minor units', () => {
    expect(
      serviceSchema.safeParse({
        name: 'Cleaning',
        durationMinutes: 30,
        priceMinor: 150.5,
        active: true,
      }).success,
    ).toBe(false);
  });
});

describe('doctorSchema', () => {
  it('requires a name', () => {
    expect(
      doctorSchema.safeParse({ fullName: ' ', specialty: null, bufferMinutes: 0, active: true })
        .success,
    ).toBe(false);
  });
});

describe('sarvamMappingSchema', () => {
  const base = {
    sarvamAppId: null,
    sarvamAppVersion: null,
    sarvamDeploymentId: null,
    sarvamConnectionId: null,
    agentPhone: null,
    clinicPhone: null,
    promptVersion: null,
  };

  it('accepts a partly filled mapping, because the manual setup produces ids one at a time', () => {
    const parsed = sarvamMappingSchema.parse({ ...base, sarvamAppId: 'app_123' });
    expect(parsed.sarvamAppId).toBe('app_123');
  });

  it('normalises the agent number', () => {
    expect(sarvamMappingSchema.parse({ ...base, agentPhone: '98765 43210' }).agentPhone).toBe(
      '+919876543210',
    );
  });

  it('has no field for the tool secret, which the platform generates', () => {
    // The secret is minted by the API and shown once. An operator-supplied one would
    // arrive by whatever channel they chose, and D-004 makes it the per-clinic boundary.
    expect(Object.keys(base)).not.toContain('toolSecret');
    const result = sarvamMappingSchema.safeParse({ ...base, toolSecret: 'supplied-by-hand' });
    expect(result.success).toBe(true);
    expect(result.success ? Object.keys(result.data) : []).not.toContain('toolSecret');
  });
});
