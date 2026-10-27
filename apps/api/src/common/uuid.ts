import { randomBytes } from 'node:crypto';

/**
 * UUID v7 (RFC 9562): a 48-bit millisecond timestamp followed by random bits, so ids
 * sort by creation time. That ordering keeps primary-key index inserts local instead of
 * scattering them across the B-tree the way random v4 ids do.
 *
 * Generated in the application rather than by the database so an id exists before the
 * row is written: it can be logged, returned, and used in a related insert inside the
 * same transaction.
 *
 * Layout (128 bits):
 *   unix_ts_ms  48 bits
 *   version      4 bits  = 0b0111
 *   counter     12 bits  monotonic within one millisecond
 *   variant      2 bits  = 0b10
 *   random      62 bits
 *
 * `counter` is RFC 9562's "method 1" monotonic counter: two ids generated in the same
 * millisecond still order correctly. That matters because cursor pagination orders by
 * id, and rows created in a tight loop would otherwise paginate unstably.
 *
 * Not a source of unpredictability on its own, since the timestamp is public. Anywhere
 * secrecy matters (refresh tokens, device tokens, pairing codes) uses randomBytes.
 */

const MAX_COUNTER = 0xfff;

const hex = (value: number, width: number): string => value.toString(16).padStart(width, '0');

const format = (timestampMs: number, seq: number): string => {
  const timeHex = hex(timestampMs, 12);
  const random = randomBytes(8);

  // Top two bits of the first random byte set to 0b10 => RFC 4122 variant.
  const variantByte = ((random[0] ?? 0) & 0x3f) | 0x80;
  let tail = hex(variantByte, 2);
  for (let i = 1; i < 8; i += 1) {
    tail += hex(random[i] ?? 0, 2);
  }

  return [
    timeHex.slice(0, 8),
    timeHex.slice(8, 12),
    `7${hex(seq, 3)}`,
    tail.slice(0, 4),
    tail.slice(4, 16),
  ].join('-');
};

/**
 * Builds an independent generator. The clock is injected so tests get deterministic,
 * isolated state instead of sharing module-level counters, which made results depend on
 * test order.
 */
export const createUuidV7 = (clock: () => number = Date.now): (() => string) => {
  let lastTimestamp = -1;
  let counter = 0;

  return () => {
    const now = clock();

    if (now > lastTimestamp) {
      lastTimestamp = now;
      counter = 0;
    } else {
      // Covers two cases with one rule: a second call inside the same millisecond, and a
      // clock that moved backwards (an NTP correction). In both, time is held at the
      // highest value already issued so no id can ever sort before an earlier one.
      counter += 1;
      if (counter > MAX_COUNTER) {
        // More than 4096 ids in one millisecond. Borrow from the next millisecond rather
        // than waiting for the clock: a spin here would block the event loop, for
        // minutes if the clock ever jumped forward and back.
        lastTimestamp += 1;
        counter = 0;
      }
    }

    return format(lastTimestamp, counter);
  };
};

/** The application's generator, on the real clock. */
export const uuidV7 = createUuidV7();

/** True when `value` is a syntactically valid UUID of any version. */
export const isUuid = (value: string): boolean =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
