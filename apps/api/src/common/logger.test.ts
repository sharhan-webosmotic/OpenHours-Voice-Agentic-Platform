import { describe, expect, it } from 'vitest';
import { pino } from 'pino';
import { buildLoggerOptions } from './logger.js';
import { REDACTED } from './redaction.js';
import { runWithContext } from './request-context.js';

const PHONE = '+919876500000';
const PATIENT = 'Priya Sharma';

/**
 * Builds a logger with the REAL production options against a capturing destination, so
 * these assertions cover the whole pino pipeline (mixin, then formatters.log, then
 * redact) rather than the redaction helper in isolation.
 */
/** Reads one captured entry, failing loudly rather than returning undefined. */
const entryAt = (entries: Record<string, unknown>[], index: number): Record<string, unknown> => {
  const entry = entries[index];
  if (entry === undefined) {
    throw new Error(`expected a log entry at index ${index}, got ${entries.length} entries`);
  }
  return entry;
};

const captureLogs = () => {
  const lines: string[] = [];
  const logger = pino(
    { ...buildLoggerOptions(), level: 'info' },
    { write: (line: string) => lines.push(line) },
  );
  return {
    logger,
    lines,
    parsed: () => lines.map((line) => JSON.parse(line) as Record<string, unknown>),
  };
};

describe('logger redaction, end to end through pino', () => {
  it('redacts PHI nested several levels deep', () => {
    const { logger, lines } = captureLogs();

    logger.info(
      {
        booking: { request: { patient: { name: PATIENT, phone: PHONE, dob: '1990-04-02' } } },
      },
      'appointment booked',
    );

    expect(lines).toHaveLength(1);
    expect(lines[0]).not.toContain(PATIENT);
    expect(lines[0]).not.toContain(PHONE);
    expect(lines[0]).not.toContain('1990-04-02');
    expect(lines[0]).toContain(REDACTED);
    // The message itself still arrives, so the line stays useful.
    expect(lines[0]).toContain('appointment booked');
  });

  it('redacts a real Error with a nested cause carrying a phone', () => {
    const { logger, lines, parsed } = captureLogs();

    const cause = new Error('patient lookup failed');
    Object.assign(cause, { phone: PHONE });
    const error = new Error('could not book appointment', { cause });

    logger.error({ err: error }, 'request failed');

    expect(lines[0]).not.toContain(PHONE);

    const entry = entryAt(parsed(), 0);
    const err = entry.err as Record<string, unknown>;
    // Non-enumerable Error properties survive: pino runs formatters.log BEFORE its
    // serializers, so the formatter must copy these out itself.
    expect(err.name).toBe('Error');
    expect(err.message).toBe('could not book appointment');
    expect(typeof err.stack).toBe('string');

    // Regression guard: pino's default err serializer folds a cause's message into the
    // parent's ("parent: cause"). Messages are never redacted, so that fold is a way
    // for unreviewed cause text to reach a message field. It must stay disabled.
    expect(err.message).not.toContain('patient lookup failed');

    const cause2 = err.cause as Record<string, unknown>;
    expect(cause2.message).toBe('patient lookup failed');
    expect(cause2.phone).toBe(REDACTED);
  });

  it('redacts request headers', () => {
    const { logger, lines } = captureLogs();

    logger.info(
      { req: { headers: { authorization: 'Bearer secret.jwt.value', cookie: 'session=abc' } } },
      'incoming',
    );

    expect(lines[0]).not.toContain('secret.jwt.value');
    expect(lines[0]).not.toContain('session=abc');
  });
});

describe('logger context binding', () => {
  it('binds the request id to every line inside a request context', () => {
    const { logger, parsed } = captureLogs();

    runWithContext({ requestId: '11111111-2222-4333-8444-555555555555' }, () => {
      logger.info('first');
      logger.info('second');
    });

    const entries = parsed();
    expect(entries).toHaveLength(2);
    for (const entry of entries) {
      expect(entry.requestId).toBe('11111111-2222-4333-8444-555555555555');
    }
  });

  it('binds identity ids when present, and omits them when absent', () => {
    const { logger, parsed } = captureLogs();

    runWithContext(
      {
        requestId: '11111111-2222-4333-8444-555555555555',
        organisationId: 'org_1',
        userId: 'usr_2',
        role: 'CLINIC_OWNER',
      },
      () => {
        logger.info('with identity');
      },
    );
    runWithContext({ requestId: '99999999-2222-4333-8444-555555555555' }, () => {
      logger.info('without identity');
    });

    const entries = parsed();
    const withIdentity = entryAt(entries, 0);
    const withoutIdentity = entryAt(entries, 1);
    expect(withIdentity).toMatchObject({
      organisationId: 'org_1',
      userId: 'usr_2',
      role: 'CLINIC_OWNER',
    });
    expect(withoutIdentity).not.toHaveProperty('organisationId');
    expect(withoutIdentity).not.toHaveProperty('role');
  });

  it('logs without a request id outside any request', () => {
    const { logger, parsed } = captureLogs();

    logger.info('startup');

    expect(entryAt(parsed(), 0)).not.toHaveProperty('requestId');
  });
});
