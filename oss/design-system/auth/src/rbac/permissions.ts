import { AuthUser, UserRole, PermissionCheckRequest } from '../types';

export type PermissionAction = 'create' | 'read' | 'write' | 'delete' | 'admin' | 'any';

export const PERMISSION_MAP: Record<string, PermissionAction[]> = {
  'admin': ['create', 'read', 'write', 'delete', 'admin'],
  'user': ['read', 'write'],
  'guest': ['read'],
};

export interface ResourcePermission {
  resource: string;
  actions: PermissionAction[];
}

export const DEFAULT_PERMISSIONS: Record<UserRole, ResourcePermission[]> = {
  admin: [
    { resource: '*', actions: ['create', 'read', 'write', 'delete', 'admin'] },
  ],
  user: [
    { resource: 'profile', actions: ['read', 'write'] },
    { resource: 'documents', actions: ['read', 'write', 'create'] },
    { resource: 'settings', actions: ['read', 'write'] },
  ],
  guest: [
    { resource: 'documents', actions: ['read'] },
    { resource: 'profile', actions: ['read'] },
  ],
};

export function hasPermission(
  user: AuthUser,
  resource: string,
  action: string
): boolean {
  if (!user || !user.role) {
    return false;
  }

  const userPermissions = user.permissions || [];
  const permissionString = `${resource}:${action}`;

  if (userPermissions.includes(permissionString)) {
    return true;
  }

  if (userPermissions.includes(`${resource}:*`)) {
    return true;
  }

  if (userPermissions.includes('*:*')) {
    return true;
  }

  const rolePermissions = DEFAULT_PERMISSIONS[user.role] || [];
  const matchingResource = rolePermissions.find(
    (perm) => perm.resource === resource || perm.resource === '*'
  );

  if (matchingResource) {
    const actions = matchingResource.actions;
    // If 'any' action or if the action is in the list
    if (action === 'any' && matchingResource.resource === '*') {
      return true;
    }
    return actions.includes(action as PermissionAction);
  }

  return false;
}

export function buildPermissionString(
  resource: string,
  action: string
): string {
  return `${resource}:${action}`;
}

export function parsePermissionString(
  permission: string
): { resource: string; action: string } {
  const [resource, action] = permission.split(':');
  return { resource, action };
}

export function filterResourcesByPermission(
  user: AuthUser,
  resources: string[],
  action: string
): string[] {
  return resources.filter((resource) =>
    hasPermission(user, resource, action)
  );
}

export function getEffectivePermissions(user: AuthUser): Set<string> {
  const permissions = new Set<string>(user.permissions || []);
  const rolePermissions = DEFAULT_PERMISSIONS[user.role] || [];

  rolePermissions.forEach((perm) => {
    perm.actions.forEach((action) => {
      permissions.add(buildPermissionString(perm.resource, action));
    });
  });

  return permissions;
}
