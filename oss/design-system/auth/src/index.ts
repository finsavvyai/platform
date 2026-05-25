// Types
export type { AuthUser, TokenPayload, AuthProvider } from './types';
export type { UserRole } from './types';

// JWT
export { signToken } from './jwt/sign';
export type { SignTokenInput, SignOptions } from './jwt/sign';
export { verifyToken, verifyTokenSafe, TokenVerificationError } from './jwt/verify';
export type { VerifyOptions } from './jwt/verify';

// RBAC
export {
  hasPermission,
  buildPermissionString,
  parsePermissionString,
  filterResourcesByPermission,
  getEffectivePermissions,
} from './rbac/permissions';
export type { PermissionAction, ResourcePermission } from './rbac/permissions';
export {
  getRoleConfig,
  getInheritedRoles,
  getAllRolePermissions,
  isRoleHigherThan,
  getPermissionsForRole,
} from './rbac/roles';

// Middleware
export {
  requireAuth,
  requireRole,
  requirePermission,
  errorHandler,
} from './middleware/express';
export {
  createAuthMiddleware,
  createRoleMiddleware,
  createPermissionMiddleware,
  createErrorHandler,
} from './middleware/hono';
export type {
  AuthenticatedRequest,
  AuthMiddlewareOptions,
  HonoContext,
  HonoAuthContext,
} from './middleware/types';
export {
  extractTokenFromHeader,
  shouldSkipPath,
  UnauthorizedError,
  ForbiddenError,
} from './middleware/types';

// Providers
export { initClerk, ClerkAuthProvider } from './providers/clerk';
export type { ClerkConfig, ClerkUser } from './providers/clerk';
export { createSupabaseAuth, SupabaseAuthProvider } from './providers/supabase';
export type { SupabaseConfig, SupabaseUser } from './providers/supabase';
