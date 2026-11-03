import { REDACTED } from './redaction.js';

/**
 * Paths whose next segment is a credential.
 *
 * The Sarvam webhook carries its per-clinic secret IN THE PATH (D-006), because Sarvam
 * documents no signature scheme. D-012 stores that secret only as a hash so nobody can read
 * it back, and the request logger was writing it out in full on every delivery (Feature 3
 * review, C3). A prefix added here is redacted everywhere a URL is logged.
 */
const SECRET_BEARING_PREFIXES: readonly string[] = ['/webhooks/sarvam/'];

/** The URL with any credential segment replaced. The query string is kept as it was. */
export const redactUrl = (url: string): string => {
  for (const prefix of SECRET_BEARING_PREFIXES) {
    const at = url.indexOf(prefix);

    if (at !== -1) {
      const start = at + prefix.length;
      const rest = url.slice(start);
      const end = rest.search(/[/?#]/);

      return `${url.slice(0, start)}${REDACTED}${end === -1 ? '' : rest.slice(end)}`;
    }
  }

  return url;
};

/**
 * A pino-http request serializer that runs AFTER the standard one, so it receives the plain
 * object the standard serializer built and rewrites only its URL.
 *
 * `params` needs nothing here: Express names the matched segment `secret`, and that key is
 * already scrubbed at any depth by `common/redaction.ts`.
 */
export const redactRequestUrl = (serialized: Record<string, unknown>): Record<string, unknown> =>
  typeof serialized.url === 'string'
    ? { ...serialized, url: redactUrl(serialized.url) }
    : serialized;
