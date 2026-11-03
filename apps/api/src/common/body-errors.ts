/**
 * Recognising the errors `express.json` raises, and the only thing about them that is safe
 * to log.
 *
 * A BODY-PARSER ERROR CARRIES THE BODY. The `SyntaxError` for malformed JSON has the raw
 * request text as its own `body` property, and V8's message for some malformations quotes
 * the start of that text. A tool call's body names a patient and their number, and a
 * webhook's body is a whole transcript, so logging the error object, or even its message,
 * puts patient data in the log (Feature 3 review, C1). What is logged instead is the kind
 * of failure and nothing else.
 */

export type BodyErrorKind = 'malformed-json' | 'body-too-large';

/** `express.json` rejects an oversized body with a 413 whose `type` names the cause. */
const isBodyTooLarge = (error: unknown): boolean =>
  typeof error === 'object' &&
  error !== null &&
  (error as { type?: string }).type === 'entity.too.large';

/** A malformed JSON body is the client's mistake, so it is a 400, not a 500. */
const isMalformedJson = (error: unknown): boolean =>
  error instanceof SyntaxError && 'body' in error;

/** Which body-parser failure this is, or undefined for any other error. */
export const bodyErrorKind = (error: unknown): BodyErrorKind | undefined => {
  if (isBodyTooLarge(error)) {
    return 'body-too-large';
  }
  if (isMalformedJson(error)) {
    return 'malformed-json';
  }
  return undefined;
};
