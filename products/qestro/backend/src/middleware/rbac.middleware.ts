/**
 * RBAC (Role-Based Access Control) Middleware
 * 
 * Enterprise-grade access control system supporting:
 * - Hierarchical roles (admin > manager > member > viewer)
 * - Fine-grained permissions
 * - Resource-level access control
 * - Audit logging for access decisions
 */

import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';

// Role definitions with hierarchy
export enum Role {
    SUPER_ADMIN = 'super_admin',
    ADMIN = 'admin',
    MANAGER = 'manager',
    MEMBER = 'member',
    VIEWER = 'viewer',
    GUEST = 'guest',
}

// Role hierarchy - higher index = higher privilege
const ROLE_HIERARCHY: Role[] = [
    Role.GUEST,
    Role.VIEWER,
    Role.MEMBER,
    Role.MANAGER,
    Role.ADMIN,
    Role.SUPER_ADMIN,
];

// Permission definitions
export enum Permission {
    // Project permissions
    PROJECT_CREATE = 'project:create',
    PROJECT_READ = 'project:read',
    PROJECT_UPDATE = 'project:update',
    PROJECT_DELETE = 'project:delete',
    PROJECT_MANAGE_MEMBERS = 'project:manage_members',

    // Test case permissions
    TEST_CASE_CREATE = 'test_case:create',
    TEST_CASE_READ = 'test_case:read',
    TEST_CASE_UPDATE = 'test_case:update',
    TEST_CASE_DELETE = 'test_case:delete',
    TEST_CASE_EXECUTE = 'test_case:execute',

    // Test run permissions
    TEST_RUN_CREATE = 'test_run:create',
    TEST_RUN_READ = 'test_run:read',
    TEST_RUN_ABORT = 'test_run:abort',

    // AI features
    AI_GENERATE = 'ai:generate',
    AI_ANALYZE = 'ai:analyze',

    // Admin permissions
    USER_MANAGE = 'user:manage',
    ROLE_MANAGE = 'role:manage',
    SETTINGS_MANAGE = 'settings:manage',
    BILLING_MANAGE = 'billing:manage',
    AUDIT_VIEW = 'audit:view',
    SSO_MANAGE = 'sso:manage',

    // Reporting
    REPORT_CREATE = 'report:create',
    REPORT_EXPORT = 'report:export',
    ANALYTICS_VIEW = 'analytics:view',
}

// Extended user interface with RBAC fields - extends global Express.Request.user
export interface RBACUser {
    userId: string;
    email: string;
    role: string; // Will be cast to Role when needed
    permissions?: Permission[];
    groups?: string[];
    organizationId?: string;
    teamId?: string;
    firstName?: string;
    lastName?: string;
    avatar?: string;
    subscription?: string;
}

// Use standard Request with our global user type
export interface RBACRequest extends Request {
    user?: RBACUser;
    rbacContext?: {
        decision: 'allow' | 'deny';
        reason: string;
        permissionsChecked: string[];
        roleChecked?: Role;
        resourceType?: string;
        resourceId?: string;
        timestamp: Date;
    };
}

// Default permissions per role
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
    [Role.SUPER_ADMIN]: Object.values(Permission), // All permissions

    [Role.ADMIN]: [
        Permission.PROJECT_CREATE,
        Permission.PROJECT_READ,
        Permission.PROJECT_UPDATE,
        Permission.PROJECT_DELETE,
        Permission.PROJECT_MANAGE_MEMBERS,
        Permission.TEST_CASE_CREATE,
        Permission.TEST_CASE_READ,
        Permission.TEST_CASE_UPDATE,
        Permission.TEST_CASE_DELETE,
        Permission.TEST_CASE_EXECUTE,
        Permission.TEST_RUN_CREATE,
        Permission.TEST_RUN_READ,
        Permission.TEST_RUN_ABORT,
        Permission.AI_GENERATE,
        Permission.AI_ANALYZE,
        Permission.USER_MANAGE,
        Permission.SETTINGS_MANAGE,
        Permission.AUDIT_VIEW,
        Permission.REPORT_CREATE,
        Permission.REPORT_EXPORT,
        Permission.ANALYTICS_VIEW,
    ],

    [Role.MANAGER]: [
        Permission.PROJECT_CREATE,
        Permission.PROJECT_READ,
        Permission.PROJECT_UPDATE,
        Permission.PROJECT_MANAGE_MEMBERS,
        Permission.TEST_CASE_CREATE,
        Permission.TEST_CASE_READ,
        Permission.TEST_CASE_UPDATE,
        Permission.TEST_CASE_DELETE,
        Permission.TEST_CASE_EXECUTE,
        Permission.TEST_RUN_CREATE,
        Permission.TEST_RUN_READ,
        Permission.TEST_RUN_ABORT,
        Permission.AI_GENERATE,
        Permission.AI_ANALYZE,
        Permission.REPORT_CREATE,
        Permission.REPORT_EXPORT,
        Permission.ANALYTICS_VIEW,
    ],

    [Role.MEMBER]: [
        Permission.PROJECT_READ,
        Permission.TEST_CASE_CREATE,
        Permission.TEST_CASE_READ,
        Permission.TEST_CASE_UPDATE,
        Permission.TEST_CASE_EXECUTE,
        Permission.TEST_RUN_CREATE,
        Permission.TEST_RUN_READ,
        Permission.AI_GENERATE,
        Permission.AI_ANALYZE,
        Permission.REPORT_CREATE,
        Permission.ANALYTICS_VIEW,
    ],

    [Role.VIEWER]: [
        Permission.PROJECT_READ,
        Permission.TEST_CASE_READ,
        Permission.TEST_RUN_READ,
        Permission.ANALYTICS_VIEW,
    ],

    [Role.GUEST]: [
        Permission.PROJECT_READ,
        Permission.TEST_CASE_READ,
        Permission.TEST_RUN_READ,
    ],
};

/**
 * Check if a role has at least the privilege level of another role
 */
export function hasRoleLevel(userRole: Role | string, requiredRole: Role): boolean {
    const userLevel = ROLE_HIERARCHY.indexOf(userRole as Role);
    const requiredLevel = ROLE_HIERARCHY.indexOf(requiredRole);
    return userLevel >= requiredLevel;
}

/**
 * Get all permissions for a role (including inherited)
 */
export function getPermissionsForRole(role: Role | string): Permission[] {
    return ROLE_PERMISSIONS[role as Role] || [];
}

/**
 * Check if user has specific permission
 */
export function hasPermission(user: RBACUser, permission: Permission): boolean {
    // Check explicit permissions first
    if (user.permissions?.includes(permission)) {
        return true;
    }
    // Check role-based permissions
    const rolePermissions = getPermissionsForRole(user.role);
    return rolePermissions.includes(permission);
}

/**
 * Middleware: Require minimum role level
 */
export function requireRoleLevel(minimumRole: Role) {
    return (req: RBACRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED',
            });
            return;
        }

        const userRole = req.user.role as Role;
        const hasAccess = hasRoleLevel(userRole, minimumRole);

        // Add RBAC context for audit
        req.rbacContext = {
            decision: hasAccess ? 'allow' : 'deny',
            reason: hasAccess ? 'Role level sufficient' : `Minimum role ${minimumRole} required`,
            permissionsChecked: [],
            roleChecked: minimumRole,
            timestamp: new Date(),
        };

        if (!hasAccess) {
            logger.warn(`RBAC denied: User ${req.user.userId} (${userRole}) requires ${minimumRole}`);
            res.status(403).json({
                error: 'Insufficient role level',
                code: 'ROLE_INSUFFICIENT',
                required: minimumRole,
                current: userRole,
            });
            return;
        }

        next();
    };
}

/**
 * Middleware: Require specific permission(s)
 */
export function requirePermission(...permissions: Permission[]) {
    return (req: RBACRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED',
            });
            return;
        }

        const missingPermissions: Permission[] = [];
        for (const permission of permissions) {
            if (!hasPermission(req.user, permission)) {
                missingPermissions.push(permission);
            }
        }

        const hasAccess = missingPermissions.length === 0;

        // Add RBAC context for audit
        req.rbacContext = {
            decision: hasAccess ? 'allow' : 'deny',
            reason: hasAccess ? 'All permissions granted' : `Missing permissions: ${missingPermissions.join(', ')}`,
            permissionsChecked: permissions,
            timestamp: new Date(),
        };

        if (!hasAccess) {
            logger.warn(`RBAC denied: User ${req.user.userId} missing permissions: ${missingPermissions.join(', ')}`);
            res.status(403).json({
                error: 'Insufficient permissions',
                code: 'PERMISSION_DENIED',
                required: missingPermissions,
                hint: 'Contact your administrator for access',
            });
            return;
        }

        next();
    };
}

/**
 * Middleware: Require any of the specified permissions
 */
export function requireAnyPermission(...permissions: Permission[]) {
    return (req: RBACRequest, res: Response, next: NextFunction): void => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED',
            });
            return;
        }

        const hasAny = permissions.some(p => hasPermission(req.user!, p));

        req.rbacContext = {
            decision: hasAny ? 'allow' : 'deny',
            reason: hasAny ? 'Has at least one required permission' : 'Missing all required permissions',
            permissionsChecked: permissions,
            timestamp: new Date(),
        };

        if (!hasAny) {
            logger.warn(`RBAC denied: User ${req.user.userId} has none of: ${permissions.join(', ')}`);
            res.status(403).json({
                error: 'Missing required permission',
                code: 'PERMISSION_DENIED',
                requiredAny: permissions,
            });
            return;
        }

        next();
    };
}

/**
 * Middleware: Resource owner or admin check
 */
export function requireOwnerOrAdmin(getResourceOwnerId: (req: RBACRequest) => Promise<string | null>) {
    return async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED',
            });
            return;
        }

        // Admins always have access
        if (hasRoleLevel(req.user.role, Role.ADMIN)) {
            req.rbacContext = {
                decision: 'allow',
                reason: 'Admin access',
                permissionsChecked: [],
                timestamp: new Date(),
            };
            next();
            return;
        }

        try {
            const ownerId = await getResourceOwnerId(req);
            const isOwner = ownerId === req.user.userId;

            req.rbacContext = {
                decision: isOwner ? 'allow' : 'deny',
                reason: isOwner ? 'Resource owner' : 'Not owner or admin',
                permissionsChecked: [],
                timestamp: new Date(),
            };

            if (!isOwner) {
                res.status(403).json({
                    error: 'Access denied',
                    code: 'NOT_OWNER',
                    hint: 'You must be the owner or an admin to access this resource',
                });
                return;
            }

            next();
        } catch (error) {
            logger.error(`RBAC owner check failed: ${error}`);
            res.status(500).json({
                error: 'Access check failed',
                code: 'RBAC_ERROR',
            });
        }
    };
}

/**
 * Middleware: Team-based access control
 */
export function requireTeamAccess(getResourceTeamId: (req: RBACRequest) => Promise<string | null>) {
    return async (req: RBACRequest, res: Response, next: NextFunction): Promise<void> => {
        if (!req.user) {
            res.status(401).json({
                error: 'Authentication required',
                code: 'AUTH_REQUIRED',
            });
            return;
        }

        // Super admins always have access
        if (req.user.role === Role.SUPER_ADMIN) {
            next();
            return;
        }

        try {
            const teamId = await getResourceTeamId(req);

            if (!teamId) {
                next(); // No team restriction
                return;
            }

            const hasTeamAccess = req.user.teamId === teamId ||
                req.user.groups?.includes(teamId);

            if (!hasTeamAccess) {
                res.status(403).json({
                    error: 'Team access denied',
                    code: 'TEAM_ACCESS_DENIED',
                });
                return;
            }

            next();
        } catch (error) {
            logger.error(`RBAC team check failed: ${error}`);
            res.status(500).json({
                error: 'Team access check failed',
                code: 'RBAC_ERROR',
            });
        }
    };
}

/**
 * Get user's effective permissions (for UI/API responses)
 */
export function getEffectivePermissions(user: RBACUser): Permission[] {
    const rolePermissions = getPermissionsForRole(user.role);
    const explicitPermissions = user.permissions || [];

    // Combine and deduplicate
    return [...new Set([...rolePermissions, ...explicitPermissions])];
}

// Export for use in routes
export const rbac = {
    requireRoleLevel,
    requirePermission,
    requireAnyPermission,
    requireOwnerOrAdmin,
    requireTeamAccess,
    Role,
    Permission,
    hasPermission,
    hasRoleLevel,
    getEffectivePermissions,
};
