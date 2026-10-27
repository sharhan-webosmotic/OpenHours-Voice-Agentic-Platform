/**
 * Minimal cookie reading.
 *
 * Express can SET cookies (res.cookie) but not parse them without cookie-parser, and
 * exactly one cookie is ever read here: the refresh token. A hand-written reader avoids
 * adding a dependency outside docs/STACK.md for ten lines of work.
 */
export const readCookie = (header: unknown, name: string): string | undefined => {
  if (typeof header !== 'string') {
    return undefined;
  }

  for (const part of header.split(';')) {
    const separator = part.indexOf('=');
    if (separator === -1) {
      continue;
    }
    if (part.slice(0, separator).trim() === name) {
      try {
        return decodeURIComponent(part.slice(separator + 1).trim());
      } catch {
        // A malformed percent-encoding is not a usable token.
        return undefined;
      }
    }
  }

  return undefined;
};
