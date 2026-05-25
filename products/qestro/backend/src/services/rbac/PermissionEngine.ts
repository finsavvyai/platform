/**
 * Permission Engine
 * Manages role-to-permission mappings and enforces access control
 */

import { db } from '../../lib/db.js';
import { users, teamMembers } from '../../schema/index.js';
import { eq, and } from 'drizzle-orm';
import { logger } from '../../utils/logger.js';
import {
  Permission,
  Role,
  RBACPolicy,
  UserPermissionContext,
  AccessLevel,
  PermissionCheckResult,
} from './types.js';

/**
 * Built-in role-to-permission mapping hierarchy
 * Roles are ordered by privilege level (ascending)
 */
const ROLE_PERMISSION_MAP: Record<Role, RBACPolicy> = {
  viewer: {
    role: 'viewer',
    description: 'Read-only access to shared resources',
    permissions: ['project:read', 'test:read', 'analytics:read', 'team:read'],
  },
  tester: {
    role: 'tester',
    description: 'Can create and run tests',
    permissions: [
      'project:read',
      'test:create',
      'test:read',
      'test:update',
      'test:run',
      'analytics:read',
      'team:read',
    ],
  },
  developer: {
    role: 'developer',
    description: 'Full test management access',
    permissions: [
      'project:create',
      'project:read',
      'project:update',
      'test:create',
      'test:read',
      'test:update',
      'test:delete',
      'test:run',
      'analytics:read',
      'analytics:export',
      'settings:read',
      'team:read',
    ],
  },
  team_lead: {
    role: 'team_lead',
    description: 'Team and project management',
    permissions: [
      'project:create',
      'project:read',
      'project:update',
      'project:delete',
      'test:create',
      'test:read',
      'test:update',
      'test:delete',
      'test:run',
      'analytics:read',
      'analytics:export',
      'settings:read',
      'settings:manage',
      'team:read',
      'team:manage',
      'team:invite',
      'team:remove',
      'billing:read',
    ],
  },
  admin: {
    role: 'admin',
    description: 'Organization-level administration',
    permissions: [
      'project:create',
      'project:read',
      'project:update',
      'project:delete',
      'test:create',
      'test:read',
      'test:update',
      'test:delete',
      'test:run',
      'analytics:read',
      'analytics:export',
      'settings:read',
      'settings:manage',
      'team:read',
      'team:manage',
      'team:invite',
      'team:remove',
      'billing:read',
      'billing:manage',
    ],
  },
  owner: {
    role: 'owner',
    description: 'Full access including billing and organization settings',
    permissions: [
      'project:create',
      'project:read',
      'project:update',
      'project:delete',
      'test:create',
      'test:read',
      'test:update',
      'test:delete',
      'test:run',
      'analytics:read',
      'analytics:export',
      'settings:read',
      'settings:manage',
      'team:read',
      'team:manage',
      'team:invite',
      'team:remove',
      'billing:read',
      'billing:manage',
      'admin:all',
    ],
  },
};

/**
 * Permission hierarchy - lower index means lower privilege
 */
const ROLE_HIERARCHY: Role[] = [
  'viewer',
  'tester',
  'developer',
  'team_lead',
  'admin',
  'owner',
];

export class PermissionEngine {
  /**
   * Check if user has a specific permission
   */
  async hasPermission(
    userId: string,
    permission: Permission,
    resourceId?: string,
  ): Promise<boolean> {
    try {
      const context = await this.getUserPermissionContext(userId, resourceId);
      return context.globalPermissions.includes(permission);
    } catch (error) {
      logger.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Check multiple permissions (any match returns true)
   */
  async hasAnyPermission(
    userId: string,
    permissions: Permission[],
    resourceId?: string,
  ): Promise<boolean> {
    try {
      const context = await this.getUserPermissionContext(userId, resourceId);
      return permissions.some((p) => context.globalPermissions.includes(p));
    } catch (error) {
      logger.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Check multiple permissions (all must match)
   */
  async hasAllPermissions(
    userId: string,
    permissions: Permission[],
    resourceId?: string,
  ): Promise<boolean> {
    try {
      const context = await this.getUserPermissionContext(userId, resourceId);
      return permissions.every((p) => context.globalPermissions.includes(p));
    } catch (error) {
      logger.error('Permission check error:', error);
      return false;
    }
  }

  /**
   * Get all permissions for a user
   */
  async getUserPermissions(userId: string): Promise<Permission[]> {
    try {
      const context = await this.getUserPermissionContext(userId);
      return context.globalPermissions;
    } catch (error) {
      logger.error('Get user permissions error:', error);
      return [];
    }
  }

  /**
   * Get permissions for a specific role
   */
  getRolePermissions(role: Role): Permission[] {
    return ROLE_PERMISSION_MAP[role]?.permissions ?? [];
  }

  /**
   * Get all available roles
   */
  getAllRoles(): RBACPolicy[] {
    return ROLE_HIERARCHY.map((role) => ROLE_PERMISSION_MAP[role]);
  }

  /**
   * Get role hierarchy information
   */
  getRoleHierarchy(): Role[] {
    return [...ROLE_HIERARCHY];
  }

  /**
   * Check if one role is superior to another
   */
  isRoleSuperior(role1: Role, role2: Role): boolean {
    const idx1 = ROLE_HIERARCHY.indexOf(role1);
    const idx2 = ROLE_HIERARCHY.indexOf(role2);
    return idx1 > idx2;
  }

  /**
   * Get the highest role between two roles
   */
  getHighestRole(role1: Role, role2: Role): Role {
    return this.isRoleSuperior(role1, role2) ? role1 : role2;
  }

  /**
   * Build user permission context
   */
  private async getUserPermissionContext(
    userId: string,
    resourceId?: string,
  ): Promise<UserPermissionContext> {
    const [user] = await db
      .select({ role: users.role })
      .from(users)
      .where(eq(users.id, userId))
      .limit(1);

    if (!user) {
      throw new Error(`User ${userId} not found`);
    }

    const role = user.role as Role;
    const permissions = this.getRolePermissions(role);

    // Get team memberships for additional context
    const teamMemberships = await db
      .select({ role: teamMembers.role, teamId: teamMembers.teamId })
      .from(teamMembers)
      .where(eq(teamMembers.userId, userId));

    return {
      userId,
      role,
      globalPermissions: permissions,
      resourcePermissions: new Map(),
      teamId: teamMemberships[0]?.teamId,
    };
  }

  /**
   * Detailed permission check with reason
   */
  async checkPermission(
    userId: string,
    permission: Permission,
  ): Promise<PermissionCheckResult> {
    try {
      const allowed = await this.hasPermission(userId, permission);
      if (allowed) {
        return { allowed: true };
      }

      const [user] = await db
        .select({ role: users.role })
        .from(users)
        .where(eq(users.id, userId))
        .limit(1);

      const currentRole = user?.role as Role;
      return {
        allowed: false,
        reason: `Permission '${permission}' not available for role '${currentRole}'`,
        requiredRole: this.getMinimumRoleForPermission(permission),
      };
    } catch (error) {
      logger.error('Permission check error:', error);
      return {
        allowed: false,
        reason: 'Permission check failed',
      };
    }
  }

  /**
   * Find the minimum role required for a permission
   */
  private getMinimumRoleForPermission(permission: Permission): Role | undefined {
    for (const role of ROLE_HIERARCHY) {
      if (ROLE_PERMISSION_MAP[role].permissions.includes(permission)) {
        return role;
      }
    }
    return undefined;
  }
}

// Export singleton instance
export const permissionEngine = new PermissionEngine();
