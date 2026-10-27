/**
 * Recursive, key-based redaction for log payloads.
 *
 * Why this exists rather than pino's `redact.paths`: that option is backed by
 * fast-redact, whose `*` wildcard matches exactly ONE level. `*.phone` redacts
 * `{ patient: { phone } }` but NOT `{ data: { patient: { phone } } }`, which was
 * verified to leak a real phone number into output. Root CLAUDE.md rule 4 admits no
 * depth limit, so redaction has to walk the object.
 *
 * This module is deliberately free of config and pino imports so it can be unit
 * tested directly on plain values.
 */

export const REDACTED = '[REDACTED]';

/**
 * Field names scrubbed at ANY depth, compared lower-cased. Covers the PHI and secret
 * fields named in root CLAUDE.md rule 4 and the tenant-security-phi skill.
 */
const REDACTED_KEYS: ReadonlySet<string> = new Set([
  // Credentials and secrets
  'authorization',
  'cookie',
  'set-cookie',
  'password',
  'passwordhash',
  'token',
  'refreshtoken',
  'accesstoken',
  'devicetoken',
  'secret',
  'apikey',
  'x-api-key',
  // Patient-identifying fields (PHI)
  'name',
  'fullname',
  'firstname',
  'lastname',
  'patientname',
  'phone',
  'phonenumber',
  'dob',
  'dateofbirth',
  'email',
  'address',
  'notes',
  'transcript',
  'prescription',
  'diagnosis',
  'recordingurl',
]);

/**
 * Exact dotted paths kept verbatim even when the leaf key is in REDACTED_KEYS.
 *
 * `name` is both a patient field and the class of every Error. Redacting it everywhere
 * would reduce every error log to `[REDACTED]`, so the error's own identity is
 * preserved while a `name` anywhere else is still scrubbed.
 */
const PRESERVED_PATHS: ReadonlySet<string> = new Set(['err.name', 'err.type', 'error.name']);

/** Depth beyond which a value is replaced wholesale. Guards pathological payloads. */
const MAX_DEPTH = 8;

const isPlainRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Error);

/**
 * Errors carry `name`, `message` and `stack` as NON-enumerable properties, so a plain
 * key walk (and `JSON.stringify`) drops them. They are copied out explicitly.
 *
 * `cause` is walked rather than flattened. pino's default error serializer concatenates
 * a cause's message into the parent's (`"top boom: inner boom"`), which would carry a
 * cause's PHI into the parent message. Keeping the chain nested lets each level be
 * redacted on its own.
 *
 * IMPORTANT: an error MESSAGE is never redacted, because a redacted message is useless
 * for diagnosis. Error messages must therefore never contain patient data or secrets:
 * throw with identifiers only. See root CLAUDE.md rule 4.
 */
const redactError = (error: Error, path: string, depth: number): Record<string, unknown> => {
  const result: Record<string, unknown> = {
    type: error.name,
    name: error.name,
    message: error.message,
  };

  if (typeof error.stack === 'string') {
    result.stack = error.stack;
  }

  if (error.cause !== undefined) {
    result.cause = redactValue(error.cause, `${path ? `${path}.` : ''}cause`, depth + 1);
  }

  // Own enumerable properties a caller attached to the error are ordinary data and
  // are redacted by the normal key rules.
  for (const [key, value] of Object.entries(error)) {
    if (key === 'cause') {
      continue;
    }
    const childPath = path ? `${path}.${key}` : key;
    result[key] = REDACTED_KEYS.has(key.toLowerCase())
      ? REDACTED
      : redactValue(value, childPath, depth + 1);
  }

  return result;
};

/**
 * Returns a redacted copy of `value`. Never mutates its input, so a redacted log line
 * cannot corrupt the object the caller is still using.
 */
export const redactValue = (
  value: unknown,
  path = '',
  depth = 0,
  seen = new WeakSet<object>(),
): unknown => {
  if (depth > MAX_DEPTH) {
    return '[Object: depth limit]';
  }

  if (value instanceof Error) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    return redactError(value, path, depth);
  }

  if (Array.isArray(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);
    // An array index is not a field name, so the parent path carries into each element:
    // `patients[0].phone` must redact on `phone`.
    return value.map((item) => redactValue(item, path, depth + 1, seen));
  }

  if (isPlainRecord(value)) {
    if (seen.has(value)) {
      return '[Circular]';
    }
    seen.add(value);

    const result: Record<string, unknown> = {};
    for (const [key, child] of Object.entries(value)) {
      const childPath = path ? `${path}.${key}` : key;

      if (PRESERVED_PATHS.has(childPath)) {
        result[key] = child;
        continue;
      }

      result[key] = REDACTED_KEYS.has(key.toLowerCase())
        ? REDACTED
        : redactValue(child, childPath, depth + 1, seen);
    }
    return result;
  }

  return value;
};

/** pino `formatters.log`: redacts the whole merged log object before it is serialized. */
export const redactLogObject = (object: Record<string, unknown>): Record<string, unknown> =>
  redactValue(object) as Record<string, unknown>;
