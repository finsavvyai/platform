/**
 * Permissions Middleware
 * 
 * Unified permissions layer that bridges legacy permission checks
 * with the comprehensive RBAC middleware system.
 * 
 * This provides backwards compatibility for existing routes while
 * delegating to the enterprise-grade RBAC system.
 */

import { Request, Response, NextFunction } from 'express';
import {
    rbac,
    Permission,
    Role,
    RBACRequest,
    RBACUser,
    hasPermission as rbacHasPermission,
    hasRoleLevel,
    getEffectivePermissions
} from './rbac.middleware.js';
import { logger } from '../utils/logger.js';

/**
 * Permission string to enum mapping for legacy support
 */
const LEGACY_PERMISSION_MAP: Record<string, Permission> = {
    // Legacy project permissions
    'project.create': Permission.PROJECT_CREATE,
    'project.read': Permission.PROJECT_READ,
    'project.update': Permission.PROJECT_UPDATE,
    'project.delete': Permission.PROJECT_DELETE,
    'project.members': Permission.PROJECT_MANAGE_MEMBERS,

    // Legacy test permissions
    'test.create': Permission.TEST_CASE_CREATE,
    'test.read': Permission.TEST_CASE_READ,
    'test.update': Permission.TEST_CASE_UPDATE,
    'test.delete': Permission.TEST_CASE_DELETE,
    'test.execute': Permission.TEST_CASE_EXECUTE,

    // Legacy run permissions
    'run.create': Permission.TEST_RUN_CREATE,
    'run.read': Permission.TEST_RUN_READ,
    'run.abort': Permission.TEST_RUN_ABORT,

    // Legacy AI permissions
    'ai.generate': Permission.AI_GENERATE,
    'ai.analyze': Permission.AI_ANALYZE,

    // Legacy admin permissions
    'admin.users': Permission.USER_MANAGE,
    'admin.roles': Permission.ROLE_MANAGE,
    'admin.settings': Permission.SETTINGS_MANAGE,
    'admin.billing': Permission.BILLING_MANAGE,
    'admin.audit': Permission.AUDIT_VIEW,
    'admin.sso': Permission.SSO_MANAGE,

    // Legacy reporting permissions
    'report.create': Permission.REPORT_CREATE,
    'report.export': Permission.REPORT_EXPORT,
    'analytics.view': Permission.ANALYTICS_VIEW,
};

/**
 * Convert legacy permission string to Permission enum
 */
function resolvePermission(permission: string): Permission | null {
    // Check if it's already a Permission enum value
    if (Object.values(Permission).includes(permission as Permission)) {
        return permission as Permission;
    }

    // Check legacy mapping
    if (LEGACY_PERMISSION_MAP[permission]) {
        return LEGACY_PERMISSION_MAP[permission];
    }

    // Log unknown permission for debugging
    logger.warn(`Unknown permission requested: ${permission}`);
    return null;
}

/**
 * Check if user has specific permission
 * Supports both legacy string permissions and Permission enum
 */
export const checkPermission = (permission: string | Permission) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
            return;
        }

        const resolvedPermission = resolvePermission(permission as string);
        if (!resolvedPermission) {
            logger.error(`Invalid permission: ${permission}`);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INVALID_PERMISSION'
            });
            return;
        }

        // Delegate to RBAC system
        const rbacReq = req as RBACRequest;
        const user = req.user as RBACUser;

        if (!rbacHasPermission(user, resolvedPermission)) {
            logger.warn(`Permission denied: User ${user.userId} lacks ${resolvedPermission}`);
            res.status(403).json({
                error: 'Permission denied',
                code: 'PERMISSION_DENIED',
                required: resolvedPermission,
                hint: 'Contact your administrator for access'
            });
            return;
        }

        // Add audit context
        rbacReq.rbacContext = {
            decision: 'allow',
            reason: 'Permission granted',
            permissionsChecked: [resolvedPermission],
            timestamp: new Date(),
        };

        next();
    };
};

/**
 * Check if user has any of the specified permissions
 */
export const checkAnyPermission = (...permissions: (string | Permission)[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
            return;
        }

        const resolvedPermissions = permissions
            .map(p => resolvePermission(p as string))
            .filter((p): p is Permission => p !== null);

        if (resolvedPermissions.length === 0) {
            logger.error(`No valid permissions in checkAnyPermission: ${permissions.join(', ')}`);
            res.status(500).json({
                error: 'Internal server error',
                code: 'INVALID_PERMISSIONS'
            });
            return;
        }

        const user = req.user as RBACUser;
        const hasAny = resolvedPermissions.some(p => rbacHasPermission(user, p));

        if (!hasAny) {
            logger.warn(`Permission denied: User ${user.userId} lacks any of ${resolvedPermissions.join(', ')}`);
            res.status(403).json({
                error: 'Permission denied',
                code: 'PERMISSION_DENIED',
                requiredAny: resolvedPermissions,
            });
            return;
        }

        next();
    };
};

/**
 * Check if user has all of the specified permissions
 */
export const checkAllPermissions = (...permissions: (string | Permission)[]) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
            return;
        }

        const resolvedPermissions = permissions
            .map(p => resolvePermission(p as string))
            .filter((p): p is Permission => p !== null);

        if (resolvedPermissions.length !== permissions.length) {
            logger.warn(`Some permissions could not be resolved: ${permissions.join(', ')}`);
        }

        const user = req.user as RBACUser;
        const missingPermissions = resolvedPermissions.filter(p => !rbacHasPermission(user, p));

        if (missingPermissions.length > 0) {
            logger.warn(`Permission denied: User ${user.userId} missing ${missingPermissions.join(', ')}`);
            res.status(403).json({
                error: 'Permission denied',
                code: 'PERMISSION_DENIED',
                required: missingPermissions,
            });
            return;
        }

        next();
    };
};

/**
 * Check resource ownership (user is owner or admin)
 */
export const checkResourceOwnership = (getOwnerId: (req: Request) => Promise<string | null>) => {
    return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
            return;
        }

        const user = req.user as RBACUser;

        // Admins always have access
        if (hasRoleLevel(user.role, Role.ADMIN)) {
            next();
            return;
        }

        try {
            const ownerId = await getOwnerId(req);

            if (ownerId === null) {
                // Resource doesn't exist or no owner - fail safe
                res.status(404).json({
                    error: 'Resource not found',
                    code: 'RESOURCE_NOT_FOUND'
                });
                return;
            }

            if (ownerId !== user.userId) {
                logger.warn(`Ownership denied: User ${user.userId} is not owner of resource (owner: ${ownerId})`);
                res.status(403).json({
                    error: 'Access denied',
                    code: 'NOT_OWNER',
                    hint: 'You must be the owner or an admin to access this resource'
                });
                return;
            }

            next();
        } catch (error) {
            logger.error(`Ownership check failed: ${error}`);
            next(error);
        }
    };
};

/**
 * Check if user has minimum role level
 */
export const checkRoleLevel = (minimumRole: Role | string) => {
    return (req: Request, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED'
            });
            return;
        }

        const user = req.user as RBACUser;
        const roleToCheck = typeof minimumRole === 'string'
            ? minimumRole as Role
            : minimumRole;

        if (!hasRoleLevel(user.role, roleToCheck)) {
            logger.warn(`Role denied: User ${user.userId} (${user.role}) requires ${roleToCheck}`);
            res.status(403).json({
                error: 'Insufficient role level',
                code: 'ROLE_INSUFFICIENT',
                required: roleToCheck,
                current: user.role,
            });
            return;
        }

        next();
    };
};

/**
 * Get user's effective permissions (for API/UI consumption)
 */
export const getUserPermissions = (req: Request): Permission[] => {
    if (!req.user) {
        return [];
    }
    return getEffectivePermissions(req.user as RBACUser);
};

/**
 * Middleware to attach user permissions to response locals
 * Useful for frontend permission checks
 */
export const attachPermissions = (req: Request, res: Response, next: NextFunction): void => {
    if (req.user) {
        res.locals.permissions = getEffectivePermissions(req.user as RBACUser);
    } else {
        res.locals.permissions = [];
    }
    next();
};

// Legacy export aliases for backwards compatibility
export { checkPermission as requirePermission };
export { checkAllPermissions as requirePermissions };
export { checkAnyPermission as requireAnyPermission };
export { checkResourceOwnership as requireOwnership };
export { checkRoleLevel as requireRole };

// Re-export RBAC types and functions for convenience
export { Permission, Role } from './rbac.middleware.js';

// Default export for convenient access
export default {
    checkPermission,
    checkAnyPermission,
    checkAllPermissions,
    checkResourceOwnership,
    checkRoleLevel,
    getUserPermissions,
    attachPermissions,
    Permission,
    Role,
};
