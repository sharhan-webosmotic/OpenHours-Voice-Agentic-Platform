/**
 * Joins class names, dropping anything falsy.
 *
 * Deliberately not `clsx` or `classnames`. Those earn their place when you need object
 * and nested-array syntax; every call site here passes a flat list of strings and
 * conditionals, which is six lines rather than a dependency to pin, audit and keep.
 */
export const cn = (...parts: readonly (string | false | null | undefined)[]): string =>
  parts.filter((part): part is string => typeof part === 'string' && part.length > 0).join(' ');
