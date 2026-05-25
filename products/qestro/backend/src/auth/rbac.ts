/**
 * Role-Based Access Control (RBAC) for Qestro
 *
 * Roles: admin, manager, developer, tester, user, viewer
 * Resources: projects, tests, runs, analytics, settings, billing, team
 * Actions: create, read, update, delete, execute, export
 */

export type Role = 'admin' | 'manager' | 'developer' | 'tester' | 'user' | 'viewer';

export type Resource =
  | 'projects'
  | 'tests'
  | 'runs'
  | 'analytics'
  | 'settings'
  | 'billing'
  | 'team'
  | 'ai'
  | 'integrations';

export type Action = 'create' | 'read' | 'update' | 'delete' | 'execute' | 'export';

export type Permission = `${Resource}:${Action}`;

/**
 * Permission matrix — defines what each role can do
 */
const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin: [
    'projects:create', 'projects:read', 'projects:update', 'projects:delete',
    'tests:create', 'tests:read', 'tests:update', 'tests:delete', 'tests:execute',
    'runs:create', 'runs:read', 'runs:delete', 'runs:export',
    'analytics:read', 'analytics:export',
    'settings:read', 'settings:update',
    'billing:read', 'billing:update',
    'team:create', 'team:read', 'team:update', 'team:delete',
    'ai:create', 'ai:read', 'ai:execute',
    'integrations:create', 'integrations:read', 'integrations:update', 'integrations:delete',
  ],
  manager: [
    'projects:create', 'projects:read', 'projects:update',
    'tests:create', 'tests:read', 'tests:update', 'tests:delete', 'tests:execute',
    'runs:create', 'runs:read', 'runs:export',
    'analytics:read', 'analytics:export',
    'settings:read',
    'billing:read',
    'team:create', 'team:read', 'team:update',
    'ai:create', 'ai:read', 'ai:execute',
    'integrations:read', 'integrations:update',
  ],
  developer: [
    'projects:read', 'projects:update',
    'tests:create', 'tests:read', 'tests:update', 'tests:execute',
    'runs:create', 'runs:read', 'runs:export',
    'analytics:read',
    'ai:create', 'ai:read', 'ai:execute',
    'integrations:read',
  ],
  tester: [
    'projects:read',
    'tests:create', 'tests:read', 'tests:update', 'tests:execute',
    'runs:create', 'runs:read', 'runs:export',
    'analytics:read',
    'ai:read', 'ai:execute',
  ],
  user: [
    'projects:read',
    'tests:read', 'tests:execute',
    'runs:read',
    'analytics:read',
    'ai:read',
  ],
  viewer: [
    'projects:read',
    'tests:read',
    'runs:read',
    'analytics:read',
  ],
};

/**
 * Role hierarchy — higher roles inherit lower role permissions
 */
const ROLE_HIERARCHY: Record<Role, number> = {
  admin: 100,
  manager: 80,
  developer: 60,
  tester: 50,
  user: 30,
  viewer: 10,
};

export function hasPermission(role: Role, permission: Permission): boolean {
  const permissions = ROLE_PERMISSIONS[role];
  return permissions?.includes(permission) ?? false;
}

export function hasAnyPermission(role: Role, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function hasAllPermissions(role: Role, permissions: Permission[]): boolean {
  return permissions.every((p) => hasPermission(role, p));
}

export function getRoleLevel(role: Role): number {
  return ROLE_HIERARCHY[role] ?? 0;
}

export function isRoleAtLeast(userRole: Role, minimumRole: Role): boolean {
  return getRoleLevel(userRole) >= getRoleLevel(minimumRole);
}

export function getPermissionsForRole(role: Role): Permission[] {
  return [...(ROLE_PERMISSIONS[role] || [])];
}

export function getAllRoles(): Role[] {
  return Object.keys(ROLE_HIERARCHY)
    .sort((a, b) => ROLE_HIERARCHY[b as Role] - ROLE_HIERARCHY[a as Role]) as Role[];
}

/**
 * Express/Hono middleware factory — require specific permission
 */
export function requirePermission(...permissions: Permission[]) {
  return (req: { user?: { role: string } }, res: { status: (n: number) => { json: (o: unknown) => void } }, next: () => void) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    const role = req.user.role as Role;
    if (!hasAnyPermission(role, permissions)) {
      res.status(403).json({
        error: 'Insufficient permissions',
        required: permissions,
        userRole: role,
      });
      return;
    }
    next();
  };
}

/**
 * Express/Hono middleware factory — require minimum role level
 */
export function requireMinRole(minimumRole: Role) {
  return (req: { user?: { role: string } }, res: { status: (n: number) => { json: (o: unknown) => void } }, next: () => void) => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required' });
      return;
    }
    if (!isRoleAtLeast(req.user.role as Role, minimumRole)) {
      res.status(403).json({
        error: 'Insufficient role level',
        required: minimumRole,
        userRole: req.user.role,
      });
      return;
    }
    next();
  };
}
