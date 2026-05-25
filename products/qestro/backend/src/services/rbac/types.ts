/**
 * RBAC (Role-Based Access Control) Type Definitions
 * Defines permissions, roles, resource types, and access control policies
 */

export type Permission =
  | 'project:create'
  | 'project:read'
  | 'project:update'
  | 'project:delete'
  | 'test:create'
  | 'test:read'
  | 'test:update'
  | 'test:delete'
  | 'test:run'
  | 'analytics:read'
  | 'analytics:export'
  | 'settings:read'
  | 'settings:manage'
  | 'team:read'
  | 'team:manage'
  | 'team:invite'
  | 'team:remove'
  | 'billing:read'
  | 'billing:manage'
  | 'admin:all';

export type Role =
  | 'viewer'
  | 'tester'
  | 'developer'
  | 'team_lead'
  | 'admin'
  | 'owner';

export type ResourceType =
  | 'project'
  | 'test'
  | 'team'
  | 'organization'
  | 'analytics';

export type AccessLevel = 'none' | 'read' | 'write' | 'admin' | 'owner';

/**
 * RBAC Policy definition
 */
export interface RBACPolicy {
  role: Role;
  permissions: Permission[];
  description: string;
}

/**
 * Resource access for a user
 */
export interface ResourceAccess {
  resourceId: string;
  resourceType: ResourceType;
  userId: string;
  accessLevel: AccessLevel;
  grantedAt: Date;
  grantedBy?: string;
}

/**
 * User permission context
 */
export interface UserPermissionContext {
  userId: string;
  role: Role;
  globalPermissions: Permission[];
  resourcePermissions: Map<string, AccessLevel>;
  organizationId?: string;
  teamId?: string;
}

/**
 * Permission check result
 */
export interface PermissionCheckResult {
  allowed: boolean;
  reason?: string;
  requiredRole?: Role;
}
