import { UserRole, RoleConfig } from '../types';

export const ROLE_HIERARCHY: Record<UserRole, UserRole[]> = {
  admin: [],
  user: ['guest'],
  guest: [],
};

export const ROLE_CONFIGS: Record<UserRole, RoleConfig> = {
  admin: {
    name: 'admin',
    permissions: new Set([
      'users:*',
      'roles:*',
      'permissions:*',
      'audit:*',
      'system:*',
      'reports:*',
    ]),
    inherits: [],
  },
  user: {
    name: 'user',
    permissions: new Set([
      'profile:read',
      'profile:write',
      'documents:read',
      'documents:write',
      'documents:create',
      'settings:read',
      'settings:write',
      'reports:read',
    ]),
    inherits: ['guest'],
  },
  guest: {
    name: 'guest',
    permissions: new Set([
      'documents:read',
      'profile:read',
      'public:read',
    ]),
    inherits: [],
  },
};

export function getRoleConfig(role: UserRole): RoleConfig {
  const config = ROLE_CONFIGS[role];
  if (!config) {
    throw new Error(`Unknown role: ${role}`);
  }
  return config;
}

export function getInheritedRoles(role: UserRole): UserRole[] {
  const config = getRoleConfig(role);
  const inherited: UserRole[] = [];

  if (config.inherits && config.inherits.length > 0) {
    config.inherits.forEach((parentRole) => {
      inherited.push(parentRole);
      inherited.push(...getInheritedRoles(parentRole));
    });
  }

  return [...new Set(inherited)];
}

export function getAllRolePermissions(role: UserRole): Set<string> {
  const config = getRoleConfig(role);
  const allPermissions = new Set(config.permissions);
  const inherited = getInheritedRoles(role);

  inherited.forEach((parentRole) => {
    const parentConfig = getRoleConfig(parentRole);
    parentConfig.permissions.forEach((perm) => {
      allPermissions.add(perm);
    });
  });

  return allPermissions;
}

export function isRoleHigherThan(
  role: UserRole,
  otherRole: UserRole
): boolean {
  if (role === otherRole) return false;
  if (role === 'admin') return true;
  if (role === 'user' && otherRole === 'guest') return true;
  return false;
}

export function getPermissionsForRole(role: UserRole): string[] {
  return Array.from(getAllRolePermissions(role));
}
