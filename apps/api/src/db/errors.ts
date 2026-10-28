/**
 * Raised when a query is attempted with no tenant scope.
 *
 * Row-level security already makes such a query return ZERO ROWS rather than leaking
 * (verified in docs/STACK.md), which is safe but silent: the caller sees an empty list
 * and may conclude the data does not exist. Throwing turns a silent wrong answer into a
 * visible bug, which is the whole reason the application lock exists alongside the
 * database one.
 */
export class TenantScopeMissingError extends Error {
  constructor(detail: string) {
    super(`No tenant scope: ${detail}. Wrap the call in withTenant() or asSystem().`);
    this.name = 'TenantScopeMissingError';
  }
}

/** Raised when input tries to address a different organisation than the active scope. */
export class CrossTenantWriteError extends Error {
  constructor(detail: string) {
    super(`Cross-tenant write rejected: ${detail}`);
    this.name = 'CrossTenantWriteError';
  }
}
