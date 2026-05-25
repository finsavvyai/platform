/**
 * Public surface for the tenant subsystem.
 *
 * Consumers import the canonical `TenantContext` type, the middleware
 * factory, and the `require*` scope guards from this module.
 */

export {
  BRAIN_TENANT_CTX_KEY,
  TENANT_ID_REGEX,
  TenantError,
  type TenantContext,
  type TenantErrorCode,
  type TenantScope,
} from "./types.js";

export { buildTenantMiddleware, getBrainTenant } from "./middleware.js";

export { deriveScope, requireAdmin, requireRead, requireWrite } from "./scope.js";
