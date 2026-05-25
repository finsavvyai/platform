/**
 * RBAC Role Definitions
 *
 * 5 roles ordered by privilege level. Owner is the highest
 * and cannot be assigned via the invite flow.
 */

export const ROLES = {
  owner: 'owner',
  admin: 'admin',
  security: 'security',
  developer: 'developer',
  viewer: 'viewer',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Numeric hierarchy — higher value = more privilege. */
export const ROLE_HIERARCHY: Record<Role, number> = {
  owner: 5,
  admin: 4,
  security: 3,
  developer: 2,
  viewer: 1,
} as const;

/** Human-readable labels for the UI. */
export const ROLE_LABELS: Record<Role, string> = {
  owner: 'Owner',
  admin: 'Admin',
  security: 'Security',
  developer: 'Developer',
  viewer: 'Viewer',
} as const;

/** Roles that can be assigned via invitation (owner is excluded). */
export const ASSIGNABLE_ROLES: readonly Role[] = [
  'admin',
  'security',
  'developer',
  'viewer',
] as const;

/** Returns true if role `a` outranks role `b`. */
export function isHigherRole(a: Role, b: Role): boolean {
  return ROLE_HIERARCHY[a] > ROLE_HIERARCHY[b];
}
