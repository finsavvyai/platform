export type Role = 'ADMIN' | 'USER' | 'VIEWER'

export enum Permission {
  READ = 'READ',
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  MANAGE_USERS = 'MANAGE_USERS',
  MANAGE_BILLING = 'MANAGE_BILLING',
  MANAGE_POLICIES = 'MANAGE_POLICIES',
  VIEW_ANALYTICS = 'VIEW_ANALYTICS',
  VIEW_AUDIT_LOGS = 'VIEW_AUDIT_LOGS',
  MANAGE_API_KEYS = 'MANAGE_API_KEYS',
  MANAGE_DOCUMENTS = 'MANAGE_DOCUMENTS',
  MANAGE_LLM_CONFIG = 'MANAGE_LLM_CONFIG',
}

const rolePermissions: Record<Role, Permission[]> = {
  VIEWER: [Permission.READ],
  USER: [
    Permission.READ,
    Permission.CREATE,
    Permission.UPDATE,
    Permission.MANAGE_DOCUMENTS,
    Permission.MANAGE_API_KEYS,
  ],
  ADMIN: Object.values(Permission),
}

/** Check if a role has a specific permission. */
export function can(role: Role, permission: Permission): boolean {
  return rolePermissions[role]?.includes(permission) ?? false
}

/** Check if a role has ALL listed permissions. */
export function canAll(role: Role, perms: Permission[]): boolean {
  return perms.every((p) => can(role, p))
}

/** Check if a role has ANY of the listed permissions. */
export function canAny(role: Role, perms: Permission[]): boolean {
  return perms.some((p) => can(role, p))
}

/** Get all permissions for a role. */
export function getPermissions(role: Role): Permission[] {
  return rolePermissions[role] ?? []
}

/** All available roles for UI selectors. */
export const ROLES: { value: Role; label: string; description: string }[] = [
  {
    value: 'ADMIN',
    label: 'Admin',
    description: 'Full access to all platform features',
  },
  {
    value: 'USER',
    label: 'User',
    description: 'Create, read, and update resources',
  },
  {
    value: 'VIEWER',
    label: 'Viewer',
    description: 'Read-only access to resources',
  },
]
