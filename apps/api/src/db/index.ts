export {
  asSystem,
  disconnectDatabase,
  withTenant,
  type TenantContext,
  type TenantDb,
} from './tenant-client.js';
export { CrossTenantWriteError, TenantScopeMissingError } from './errors.js';
export { currentScope, type TenantScope } from './tenant-scope.js';
