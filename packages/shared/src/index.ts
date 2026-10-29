/**
 * Shared contracts used by the API and both web apps: zod schemas, enums and the
 * permission matrix. Named exports only.
 *
 * Empty of product types on purpose - this prompt builds the foundation only. The
 * permission matrix (packages/shared/permissions.ts) and the domain schemas arrive
 * with the features that need them.
 */

/** Semantic version of the shared contract package, for diagnostics endpoints. */
export const SHARED_CONTRACT_VERSION = '0.1.0';

export {
  ACTIONS,
  LOGIN_AUDIENCES,
  PERMISSIONS,
  PLATFORM_ROLES,
  RESOURCES,
  ROLES,
  SCOPES,
  isPermitted,
  isPlatformRole,
  isRole,
  permissionScope,
  roleBelongsInAudience,
  type Action,
  type Grant,
  type LoginAudience,
  type Matrix,
  type Resource,
  type Role,
  type Scope,
} from './permissions.js';
