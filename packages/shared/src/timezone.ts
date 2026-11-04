/**
 * IANA time zone validation.
 *
 * A clinic's timezone is not decoration: every appointment instant is stored in UTC and
 * converted at the edges using this value, so a wrong or invented zone silently shifts
 * every booking the clinic ever makes. `Asia/Calcutta` is a real alias and works;
 * `IST`, `+05:30` and `Asia/Bengaluru` are not zones and must be refused.
 *
 * Checked against the runtime's own zone database rather than a list committed here. A
 * hand-written list is a list that goes stale, and the one thing worse than rejecting a
 * valid zone is accepting one the runtime cannot resolve at conversion time.
 */

/**
 * Whether the runtime can resolve `value` as an IANA zone.
 *
 * `Intl.supportedValuesOf` is the direct question but is not available everywhere, so the
 * fallback actually constructs a formatter: that is the operation every conversion will
 * perform later, which makes it the honest test. `DateTimeFormat` throws a RangeError for
 * an unknown zone and accepts aliases, which is the behaviour we want.
 */
export const isIanaTimeZone = (value: string): boolean => {
  if (value.trim() !== value || value === '') {
    return false;
  }

  /**
   * The shape is checked as well as the runtime's acceptance, and this is the part that
   * does the work.
   *
   * `Intl.DateTimeFormat` accepts far more than IANA zone identifiers. Measured on this
   * runtime: `IST` resolves to `Asia/Calcutta`, `GMT` and `Zulu` to `UTC`, `Egypt` to
   * `Africa/Cairo`, and, worst of the set, **`EST` resolves to `America/Panama`**, which
   * has no daylight-saving rules at all. A clinic stored as `EST` would therefore be an
   * hour out for eight months of the year, with nothing anywhere reporting a problem.
   *
   * So a zone must be written `Area/Location`, which is the actual IANA form, with `UTC`
   * as the one single-word exception because it is unambiguous and is what tests use. A
   * bare offset such as `+05:30` fails this for the same reason: it carries no rules.
   */
  if (
    value !== 'UTC' &&
    !/^[A-Za-z]+(?:[A-Za-z_-]*)\/[A-Za-z0-9_+-]+(?:\/[A-Za-z0-9_+-]+)?$/.test(value)
  ) {
    return false;
  }

  try {
    new Intl.DateTimeFormat('en-US', { timeZone: value }).format(0);
    return true;
  } catch {
    return false;
  }
};

/**
 * The zones offered first in the admin console.
 *
 * A convenience for the picker, not a restriction: `isIanaTimeZone` is what validates, so
 * a clinic outside this list is configurable without a code change.
 */
export const SUGGESTED_TIME_ZONES = ['Asia/Kolkata'] as const;
