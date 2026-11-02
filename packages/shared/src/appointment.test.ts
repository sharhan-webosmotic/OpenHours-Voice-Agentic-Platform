import { describe, expect, it } from 'vitest';
import {
  APPOINTMENT_STATUSES,
  APPOINTMENT_TRANSITIONS,
  canTransition,
  createAppointmentSchema,
  holdsSlot,
  rescheduleAppointmentSchema,
  type AppointmentStatus,
} from './appointment.js';

/**
 * EVERY transition is asserted, allowed and refused, which is the feature brief's
 * requirement and is also the only way a table like this stays honest. Five statuses make
 * twenty-five ordered pairs, and a test that checks the interesting four leaves the other
 * twenty-one to be discovered by a user.
 */

const ALLOWED: readonly (readonly [AppointmentStatus, AppointmentStatus])[] = [
  ['SCHEDULED', 'CONFIRMED'],
  ['SCHEDULED', 'CANCELLED'],
  ['SCHEDULED', 'COMPLETED'],
  ['SCHEDULED', 'NO_SHOW'],
  ['CONFIRMED', 'COMPLETED'],
  ['CONFIRMED', 'CANCELLED'],
  ['CONFIRMED', 'NO_SHOW'],
];

describe('the appointment status transitions', () => {
  it('allows exactly the seven moves the table declares', () => {
    // Compared as sorted `from->to` strings, so the assertion is about WHICH moves are
    // allowed rather than the order the enum happens to list the statuses in.
    const allowed = APPOINTMENT_STATUSES.flatMap((from) =>
      APPOINTMENT_STATUSES.filter((to) => canTransition(from, to)).map((to) => `${from}->${to}`),
    );

    expect(allowed.toSorted()).toEqual(ALLOWED.map(([from, to]) => `${from}->${to}`).toSorted());
  });

  it('refuses all eighteen others, including every self-transition', () => {
    const refused: string[] = [];

    for (const from of APPOINTMENT_STATUSES) {
      for (const to of APPOINTMENT_STATUSES) {
        const isAllowed = ALLOWED.some(([a, b]) => a === from && b === to);

        if (!isAllowed) {
          refused.push(`${from}->${to}`);
          expect(canTransition(from, to)).toBe(false);
        }
      }
    }

    expect(refused).toHaveLength(25 - ALLOWED.length);
    // A status cannot be "changed" to itself: the API answers that with a refusal rather
    // than a silent success, so a double-clicked button cannot look like two confirmations.
    expect(refused).toContain('CONFIRMED->CONFIRMED');
  });

  it('never un-confirms, because a reminder would then be sent twice', () => {
    expect(canTransition('CONFIRMED', 'SCHEDULED')).toBe(false);
  });

  it('treats COMPLETED, CANCELLED and NO_SHOW as terminal', () => {
    for (const terminal of ['COMPLETED', 'CANCELLED', 'NO_SHOW'] as const) {
      expect(APPOINTMENT_TRANSITIONS[terminal]).toEqual([]);
    }
  });

  it('does not let a no-show be rewritten as a completed visit', () => {
    expect(canTransition('NO_SHOW', 'COMPLETED')).toBe(false);
  });
});

describe('holdsSlot', () => {
  it('matches the statuses the exclusion constraint covers, and only those', () => {
    expect(APPOINTMENT_STATUSES.filter(holdsSlot)).toEqual(['SCHEDULED', 'CONFIRMED']);
  });
});

describe('createAppointmentSchema', () => {
  const valid = {
    patientId: '0199ff00-0000-7000-8000-000000000001',
    doctorId: '0199ff00-0000-7000-8000-000000000002',
    serviceId: '0199ff00-0000-7000-8000-000000000003',
    startAt: '2026-11-02T03:30:00.000Z',
  };

  it('accepts an instant', () => {
    expect(createAppointmentSchema.parse(valid).startAt).toBe('2026-11-02T03:30:00.000Z');
  });

  it('has no notes field, because the column it would write to does not exist', () => {
    // Accepting it and dropping it would lose a receptionist's note silently, which is
    // worse than not offering the field.
    expect(createAppointmentSchema.parse({ ...valid, notes: 'something' })).not.toHaveProperty(
      'notes',
    );
  });

  it('refuses a local time with no offset, because it names no instant', () => {
    expect(
      createAppointmentSchema.safeParse({ ...valid, startAt: '2026-11-02 09:00' }).success,
    ).toBe(false);
    expect(
      createAppointmentSchema.safeParse({ ...valid, startAt: '2026-11-02T09:00:00' }).success,
    ).toBe(false);
  });

  it('refuses an id that is not a uuid', () => {
    expect(createAppointmentSchema.safeParse({ ...valid, patientId: '1' }).success).toBe(false);
  });

  it('has no endAt, so a client cannot choose how long an appointment is', () => {
    const parsed = createAppointmentSchema.parse({ ...valid, endAt: '2026-11-02T03:35:00.000Z' });

    expect(parsed).not.toHaveProperty('endAt');
  });
});

describe('rescheduleAppointmentSchema', () => {
  it('needs only the new start, leaving the doctor and service as they were', () => {
    const parsed = rescheduleAppointmentSchema.parse({
      startAt: '2026-11-03T03:30:00.000Z',
      reason: '',
    });

    expect(parsed.doctorId).toBeUndefined();
    expect(parsed.serviceId).toBeUndefined();
    expect(parsed.reason).toBeNull();
  });
});
