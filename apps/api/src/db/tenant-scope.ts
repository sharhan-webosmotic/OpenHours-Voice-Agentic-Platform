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
  | { readonly kind: 'platform'; readonly reason: string };

const storage = new AsyncLocalStorage<TenantScope>();

export const runInScope = <T>(scope: TenantScope, fn: () => T): T => storage.run(scope, fn);

export const currentScope = (): TenantScope | undefined => storage.getStore();
