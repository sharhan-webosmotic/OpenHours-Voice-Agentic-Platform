import { describe, expect, it } from 'vitest';
import { inboundCallFinished } from './__fixtures__/inbound-call-finished.js';
import { internals, sarvamProvider } from './sarvam.js';
import { ProviderContractError } from '../provider.js';

/**
 * The Sarvam adapter against recorded payloads.
 *
 * THE FIXTURE IS SYNTHETIC AND BUILT FROM THE DOCUMENTED FIELD LIST in
 * `docs/sarvam-contract.md` section 3, not from a real call: no real call has happened yet.
 * That is stated here because it bounds what these tests prove. They prove the parser handles
 * the documented shape, the shape it is told to tolerate, and the shapes that would break it.
 * They cannot prove the documentation matches the provider.
 *
 * The step that closes that gap is the pilot call, after which the raw body in
 * `webhook_events.payload` is the thing to check this file against.
 */

describe('parsing the inbound call-finished webhook', () => {
  it('reads the documented payload', () => {
    const event = sarvamProvider.parseWebhook(inboundCallFinished);

    expect(event).toMatchObject({
      externalCallId: '20261102/int_fixture_0001',
      direction: 'INBOUND',
      fromE164: '+919876500001',
      toE164: '+918000000001',
      durationSeconds: 92,
    });
    expect(event.startedAt?.toISOString()).toBe('2026-11-02T06:30:00.000Z');
    expect(event.routing.deploymentId).toBe('dep_fixture_0001');
  });

  it('keeps the interaction id exactly as sent, slash and all', () => {
    const event = sarvamProvider.parseWebhook(inboundCallFinished);

    /**
     * `<YYYYMMDD>/<id>` with a real slash in it (contract section 1). Reformatting it to make
     * a URL convenient is how it stops matching the id the provider sends next time, so it is
     * stored verbatim and encoded at the point of use.
     */
    expect(event.externalCallId).toContain('/');
    expect(internals.idForPath(event.externalCallId)).toBe('20261102%2Fint_fixture_0001');
  });

  it('turns the transcript into attributed turns, in order', () => {
    const event = sarvamProvider.parseWebhook(inboundCallFinished);

    expect(event.transcript).toHaveLength(4);
    expect(event.transcript[0]).toEqual({
      role: 'AGENT',
      text: 'Good morning, this is the clinic. How can I help?',
    });
    expect(event.transcript[1]?.role).toBe('CALLER');
  });

  it('tolerates a field it has never seen', () => {
    // A provider adding a field must not take a clinic's telephone line off the air. Zod's
    // default for an object is to ignore unknown keys, which is this behaviour, and the test
    // exists so nobody "tightens" it to `.strict()` without the consequence being visible.
    const event = sarvamProvider.parseWebhook({
      ...inboundCallFinished,
      sentiment_score: 0.82,
      a_whole_new_object: { nested: true },
    });

    expect(event.externalCallId).toBe('20261102/int_fixture_0001');
  });

  it('accepts a payload with nothing but an interaction id', () => {
    // Everything else is optional on purpose: a payload missing its duration is still a call
    // that happened, and the id is the only field without which it cannot be deduplicated.
    const event = sarvamProvider.parseWebhook({ interaction_id: '20261102/bare' });

    expect(event.externalCallId).toBe('20261102/bare');
    expect(event.durationSeconds).toBeNull();
    expect(event.transcript).toEqual([]);
  });

  it('refuses a payload with no interaction id, naming no field values', () => {
    const attempt = () => sarvamProvider.parseWebhook({ user_phone_number: '+919876500001' });

    expect(attempt).toThrow(ProviderContractError);
    // The message is logged, and a webhook body is full of patient data, so it may name the
    // FIELD and never the value.
    try {
      attempt();
    } catch (error) {
      expect((error as Error).message).not.toContain('919876500001');
    }
  });

  it('reads an outbound attempt as outbound rather than filing it as a call in', () => {
    const event = sarvamProvider.parseWebhook({
      ...inboundCallFinished,
      attempt_id: 'att_0001',
      status: 'connected',
    });

    // Outbound calls are not part of this phase, and one arriving at the inbound endpoint
    // must not be recorded as somebody ringing the clinic.
    expect(event.direction).toBe('OUTBOUND');
  });
});

describe('the awkward values a real payload will carry', () => {
  it('reads a duration sent as a string', () => {
    expect(internals.seconds('92')).toBe(92);
    expect(internals.seconds(92.4)).toBe(92);
    expect(internals.seconds('')).toBeNull();
    expect(internals.seconds('about a minute')).toBeNull();
  });

  it('turns an unparseable date into null rather than an invalid one', () => {
    // The contract states that `start_datetime` exists and not what format it is in. An
    // Invalid Date written to a timestamptz column either throws or stores 1970.
    expect(internals.instant('not a date')).toBeNull();
    expect(internals.instant(undefined)).toBeNull();
    expect(internals.instant('2026-11-02T06:30:00.000Z')?.getUTCFullYear()).toBe(2026);
  });

  it('turns a number it cannot normalise into an empty string, not a wrong number', () => {
    // `calls.from_e164` is NOT NULL and a call that happened is worth a row even when the
    // caller withheld their number. Empty cannot be confused with a real one.
    expect(internals.e164('+919876500001')).toBe('+919876500001');
    expect(internals.e164('anonymous')).toBe('');
    expect(internals.e164(undefined)).toBe('');
  });

  it('labels an unrecognised speaker as OTHER instead of dropping the turn', () => {
    expect(internals.role('assistant')).toBe('AGENT');
    expect(internals.role('user')).toBe('CALLER');
    // The contract does not enumerate the webhook's roles, and a turn whose speaker we
    // cannot label is still part of what was said.
    expect(internals.role('supervisor')).toBe('OTHER');
    expect(internals.role(undefined)).toBe('OTHER');
  });

  it('falls back to the indic text and drops a turn with no words at all', () => {
    const turns = internals.turns([
      { role: 'user', indic_text: 'मुझे अपॉइंटमेंट चाहिए' },
      { role: 'assistant', en_text: '   ' },
      { role: 'user' },
    ]);

    expect(turns).toHaveLength(1);
    expect(turns[0]?.text).toBe('मुझे अपॉइंटमेंट चाहिए');
  });
});
