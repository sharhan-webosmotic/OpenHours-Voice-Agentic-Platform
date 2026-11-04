import { AsyncLocalStorage } from 'node:async_hooks';

/**
 * The scope every database query runs under.
 *
 * Held in its own AsyncLocalStorage rather than on the HTTP request context, because
 * jobs, webhook handlers and the login path all need a scope and have no request.
 *
 * A Prisma client extension cannot be applied inside a transaction (the transaction
 * client omits $extends), so one extended client is built at startup and reads the
 * scope from here per query. That is why this store exists at all.
 */

export type TenantScope =
  | { readonly kind: 'tenant'; readonly organisationId: string }
  /** Cross-organisation. Only for login, provider resolution and jobs, and always audited. */
  | { readonly kind: 'platform'; readonly reason: string }
  /**
   * A platform principal reading ONE named organisation.
   *
   * The scope a platform role gets when the matrix grants it a masked read of a clinic's
   * patients or appointments. It is cross-tenant in the DATABASE, because row-level security
   * must let the query through, and single-tenant in the APPLICATION, because the extension
   * injects `organisation_id` exactly as it does for a tenant scope.
   *
   * WHY IT EXISTS AS A THIRD KIND rather than a flag on the second. Under plain `platform`
   * scope the extension injects nothing, so confinement to one clinic rested on every
   * repository function remembering to filter by hand. That is a convention, not a control:
   * one function added later without the filter returns another clinic's patients, and
   * nothing fails. With this kind the lock is back in the one place that cannot be forgotten.
   */
  | {
      readonly kind: 'platform-organisation';
      readonly reason: string;
      readonly organisationId: string;
    };

/** Whether a scope confines queries to one organisation at the application layer. */
export const scopedOrganisationId = (scope: TenantScope): string | undefined =>
  scope.kind === 'platform' ? undefined : scope.organisationId;

const storage = new AsyncLocalStorage<TenantScope>();

export const runInScope = <T>(scope: TenantScope, fn: () => T): T => storage.run(scope, fn);

export const currentScope = (): TenantScope | undefined => storage.getStore();
