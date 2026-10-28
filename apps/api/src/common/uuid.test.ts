import { describe, expect, it } from 'vitest';
import { createUuidV7, isUuid, uuidV7 } from './uuid.js';

const AT = Date.parse('2026-10-27T12:00:00.000Z');

/** A generator on a controllable clock, so no test depends on another's state. */
const fixedClock = (start = AT) => {
  let now = start;
  return {
    next: createUuidV7(() => now),
    advance: (ms: number) => {
      now += ms;
    },
    set: (value: number) => {
      now = value;
    },
  };
};

describe('uuidV7 format', () => {
  it('produces a valid UUID with version 7 and the RFC variant', () => {
    const { next } = fixedClock();

    for (let i = 0; i < 200; i += 1) {
      const id = next();
      expect(isUuid(id)).toBe(true);
      expect(id[14]).toBe('7');
      expect('89ab').toContain(id[19]);
    }
  });

  it('encodes the timestamp in the leading 48 bits', () => {
    const id = fixedClock(AT).next();

    const timeHex = id.slice(0, 8) + id.slice(9, 13);
    expect(Number.parseInt(timeHex, 16)).toBe(AT);
  });

  it('never repeats across many ids on the real clock', () => {
    const ids = new Set<string>();
    for (let i = 0; i < 20_000; i += 1) {
      ids.add(uuidV7());
    }

    expect(ids.size).toBe(20_000);
  });
});

describe('uuidV7 ordering', () => {
  it('sorts in creation order within one millisecond', () => {
    const { next } = fixedClock();
    const ids = Array.from({ length: 1000 }, () => next());

    expect([...ids].sort()).toEqual(ids);
  });

  it('sorts across increasing milliseconds', () => {
    const clock = fixedClock();
    const ids = [clock.next()];
    for (const step of [1, 1, 1000, 60_000]) {
      clock.advance(step);
      ids.push(clock.next());
    }

    expect([...ids].sort()).toEqual(ids);
  });

  it('stays ordered when the counter overflows inside one millisecond', () => {
    // 5000 ids in a single millisecond exceeds the 12-bit counter, so the generator
    // borrows the next millisecond. It must not stall and must not sort backwards.
    const { next } = fixedClock();
    const ids = Array.from({ length: 5000 }, () => next());

    expect(new Set(ids).size).toBe(5000);
    expect([...ids].sort()).toEqual(ids);
  });

  it('stays ordered when the clock jumps backwards', () => {
    const clock = fixedClock();
    const before = clock.next();
    // An NTP correction moves the clock back five seconds.
    clock.set(AT - 5000);
    const after = clock.next();

    expect(after > before).toBe(true);
    expect(isUuid(after)).toBe(true);
  });

  it('returns promptly when the clock is far in the future then rewinds', () => {
    // Regression guard: an earlier version waited for the wall clock to catch up, which
    // blocked for as long as the gap (observed: ~8 minutes in a test run).
    const clock = fixedClock(AT + 600_000);
    clock.next();
    clock.set(AT);

    const startedAt = Date.now();
    const ids = Array.from({ length: 5000 }, () => clock.next());
    const elapsed = Date.now() - startedAt;

    expect(ids).toHaveLength(5000);
    expect(elapsed).toBeLessThan(1000);
  });
});

describe('isUuid', () => {
  it('accepts generated ids and a known UUID', () => {
    expect(isUuid(uuidV7())).toBe(true);
    expect(isUuid('0189d7f1-9b3a-4c2e-8f1a-2b3c4d5e6f70')).toBe(true);
  });

  it('rejects malformed values', () => {
    for (const bad of [
      '',
      'not-a-uuid',
      '0189d7f1-9b3a-4c2e-8f1a-2b3c4d5e6f7',
      '00000000-0000-0000-0000-000000000000',
      '0189d7f1-9b3a-4c2e-8f1a-2b3c4d5e6f70-extra',
    ]) {
      expect(isUuid(bad)).toBe(false);
    }
  });
});
