/**
 * RBAC Module Exports
 */

export * from './types.js';
export { PermissionEngine, permissionEngine } from './PermissionEngine.js';
export {
  requirePermission,
  requireAllPermissions,
  requireRole,
  requireMinimumRole,
  requireProjectAccess,
  requireTeamMembership,
  checkPermissionOptional,
} from './RBACMiddleware.js';
export { default as rbacRoutes } from './rbac.routes.js';
