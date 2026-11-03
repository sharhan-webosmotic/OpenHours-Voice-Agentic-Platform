/**
 * An E.164 number grouped for reading aloud, `+91 98765 43210`.
 *
 * Only Indian mobile numbers are grouped, because that is the one format whose grouping is
 * certain. Anything else is shown exactly as stored rather than grouped by a guess.
 */
export const formatPhone = (e164: string): string => {
  const indian = /^\+91(\d{5})(\d{5})$/.exec(e164);

  return indian === null ? e164 : `+91 ${indian[1] ?? ''} ${indian[2] ?? ''}`;
};
