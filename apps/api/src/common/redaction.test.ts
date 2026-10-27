import { describe, expect, it } from 'vitest';
import { REDACTED, redactValue } from './redaction.js';

const PHONE = '+919876500000';
const PATIENT = 'Priya Sharma';

describe('redactValue, nested objects', () => {
  it('redacts PHI and secrets at any depth', () => {
    const payload = {
      level1: {
        level2: {
          level3: {
            // Four levels deep: pino's `*.phone` wildcard matches one level only and
            // let exactly this case through before the recursive walker existed.
            patient: {
              name: PATIENT,
              fullName: PATIENT,
              phone: PHONE,
              dob: '1990-04-02',
              email: 'priya@example.com',
              notes: 'complains of chest pain',
              transcript: 'caller said ...',
              prescription: 'amoxicillin 500mg',
            },
            auth: {
              authorization: 'Bearer abc.def.ghi',
              cookie: 'session=xyz',
              'set-cookie': 'session=xyz; HttpOnly',
              password: 'hunter2hunter2',
              token: 'tok_live_123',
              refreshToken: 'rt_123',
            },
          },
        },
      },
    };

    const serialized = JSON.stringify(redactValue(payload));

    for (const secret of [
      PATIENT,
      PHONE,
      '1990-04-02',
      'priya@example.com',
      'chest pain',
      'caller said',
      'amoxicillin',
      'Bearer abc.def.ghi',
      'session=xyz',
      'hunter2hunter2',
      'tok_live_123',
      'rt_123',
    ]) {
      expect(serialized).not.toContain(secret);
    }
    expect(serialized).toContain(REDACTED);
  });

  it('redacts PHI inside arrays', () => {
    const redacted = redactValue({ patients: [{ phone: PHONE }, { phone: PHONE }] });

    expect(JSON.stringify(redacted)).not.toContain(PHONE);
  });

  it('keeps non-sensitive values intact', () => {
    const redacted = redactValue({
      appointmentId: 'apt_123',
      count: 3,
      active: true,
      nested: { organisationId: 'org_1' },
    });

    expect(redacted).toEqual({
      appointmentId: 'apt_123',
      count: 3,
      active: true,
      nested: { organisationId: 'org_1' },
    });
  });

  it('does not mutate the caller object', () => {
    const payload = { patient: { phone: PHONE } };

    redactValue(payload);

    expect(payload.patient.phone).toBe(PHONE);
  });

  it('survives circular references', () => {
    const node: Record<string, unknown> = { phone: PHONE };
    node.self = node;

    expect(() => JSON.stringify(redactValue(node))).not.toThrow();
    expect(JSON.stringify(redactValue(node))).not.toContain(PHONE);
  });

  it('caps runaway depth', () => {
    let deep: Record<string, unknown> = { phone: PHONE };
    for (let i = 0; i < 40; i += 1) {
      deep = { nested: deep };
    }

    const serialized = JSON.stringify(redactValue(deep));

    expect(serialized).toContain('depth limit');
    expect(serialized).not.toContain(PHONE);
  });
});

describe('redactValue, Error instances', () => {
  it('keeps name, message and stack, which are non-enumerable', () => {
    const error = new TypeError('something broke');

    const redacted = redactValue(error) as Record<string, unknown>;

    expect(redacted.name).toBe('TypeError');
    expect(redacted.type).toBe('TypeError');
    expect(redacted.message).toBe('something broke');
    expect(typeof redacted.stack).toBe('string');
  });

  it('walks cause and redacts PHI inside it', () => {
    const cause = new Error('db lookup failed');
    Object.assign(cause, { phone: PHONE, patientName: PATIENT });
    const error = new Error('could not book appointment', { cause });

    const redacted = redactValue(error) as Record<string, unknown>;
    const serialized = JSON.stringify(redacted);

    const redactedCause = redacted.cause as Record<string, unknown>;
    expect(redactedCause.message).toBe('db lookup failed');
    expect(redactedCause.phone).toBe(REDACTED);
    expect(redactedCause.patientName).toBe(REDACTED);
    expect(serialized).not.toContain(PHONE);
    expect(serialized).not.toContain(PATIENT);
  });

  it('redacts PHI an Error carries as its own enumerable property', () => {
    const error = new Error('lookup failed');
    Object.assign(error, { phone: PHONE, appointmentId: 'apt_7' });

    const redacted = redactValue(error) as Record<string, unknown>;

    expect(redacted.phone).toBe(REDACTED);
    expect(redacted.appointmentId).toBe('apt_7');
  });

  it('redacts an Error nested inside a payload', () => {
    const inner = new Error('inner');
    Object.assign(inner, { phone: PHONE });

    const serialized = JSON.stringify(redactValue({ data: { failure: inner } }));

    expect(serialized).not.toContain(PHONE);
    // Non-enumerable props survive the nesting: plain JSON.stringify would drop them.
    expect(serialized).toContain('inner');
  });
});

describe('redactValue, preserved paths', () => {
  it('keeps err.name so error logs still identify the failure class', () => {
    const redacted = redactValue({ err: { name: 'ConflictError', message: 'slot taken' } }) as {
      err: Record<string, unknown>;
    };

    expect(redacted.err.name).toBe('ConflictError');
  });

  it('still redacts a name that is not an error class', () => {
    const redacted = redactValue({ patient: { name: PATIENT } }) as {
      patient: Record<string, unknown>;
    };

    expect(redacted.patient.name).toBe(REDACTED);
  });

  it('does not treat a nested err.name as preserved', () => {
    // Only the exact top-level `err.name` path is exempt. A `name` under some other
    // `err` deeper in the payload is ordinary data and stays redacted.
    const redacted = redactValue({ data: { err: { name: PATIENT } } });

    expect(JSON.stringify(redacted)).not.toContain(PATIENT);
  });
});
