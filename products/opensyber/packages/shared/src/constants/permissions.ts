/**
 * RBAC Permission Definitions
 *
 * 34 granular permissions mapped to 5 roles via static Sets
 * for O(1) lookup at runtime.
 */

import type { Role } from './roles.js';

export const PERMISSIONS = {
  // Instance management
  'instance.create': 'instance.create',
  'instance.view': 'instance.view',
  'instance.delete': 'instance.delete',
  'instance.restart': 'instance.restart',
  'instance.update': 'instance.update',

  // Skill management
  'skill.install': 'skill.install',
  'skill.uninstall': 'skill.uninstall',
  'skill.view': 'skill.view',

  // Security policy management
  'policy.create': 'policy.create',
  'policy.update': 'policy.update',
  'policy.delete': 'policy.delete',
  'policy.view': 'policy.view',

  // Incident management
  'incident.create': 'incident.create',
  'incident.update': 'incident.update',
  'incident.assign': 'incident.assign',
  'incident.view': 'incident.view',

  // Alert rule management
  'alert.create': 'alert.create',
  'alert.update': 'alert.update',
  'alert.delete': 'alert.delete',
  'alert.view': 'alert.view',

  // Credential vault
  'vault.read': 'vault.read',
  'vault.write': 'vault.write',
  'vault.delete': 'vault.delete',

  // Member management
  'member.invite': 'member.invite',
  'member.remove': 'member.remove',
  'member.changeRole': 'member.changeRole',
  'member.view': 'member.view',

  // Billing
  'billing.view': 'billing.view',
  'billing.manage': 'billing.manage',

  // Audit log
  'audit.view': 'audit.view',
  'audit.export': 'audit.export',
  'audit.write': 'audit.write',

  // Compliance
  'compliance.view': 'compliance.view',
  'compliance.generate': 'compliance.generate',

  // Organization management
  'org.update': 'org.update',
  'org.delete': 'org.delete',

  // Cloud security (CSPM)
  'cloud.read': 'cloud.read',
  'cloud.write': 'cloud.write',
  'cloud.admin': 'cloud.admin',

  // Agent policy management
  'agent.policy.read': 'agent.policy.read',
  'agent.policy.write': 'agent.policy.write',

  // Marketplace
  'marketplace.browse': 'marketplace.browse',
  'marketplace.install': 'marketplace.install',
  'marketplace.publish': 'marketplace.publish',
  'marketplace.admin': 'marketplace.admin',

  // SCIM provisioning
  'scim.read': 'scim.read',
  'scim.write': 'scim.write',

  // SLA monitoring
  'sla.view': 'sla.view',
  'sla.export': 'sla.export',

  // Data room (investor metrics)
  'dataroom.view': 'dataroom.view',

  // SaaS posture
  'saas.read': 'saas.read',
  'saas.write': 'saas.write',
} as const;

export type Permission = (typeof PERMISSIONS)[keyof typeof PERMISSIONS];

const ALL_PERMISSIONS = new Set<Permission>(
  Object.values(PERMISSIONS) as Permission[],
);

/** View-only permissions granted to every role. */
const VIEW_PERMISSIONS = new Set<Permission>([
  'instance.view',
  'skill.view',
  'policy.view',
  'incident.view',
  'alert.view',
  'compliance.view',
  'member.view',
  'billing.view',
  'audit.view',
  'cloud.read',
  'agent.policy.read',
  'marketplace.browse',
  'sla.view',
  'saas.read',
]);

/** Static role → permission map. Evaluated once at module load. */
export const ROLE_PERMISSIONS: Record<Role, Set<Permission>> = {
  owner: ALL_PERMISSIONS,

  admin: new Set<Permission>([
    ...VIEW_PERMISSIONS,
    'instance.create', 'instance.delete', 'instance.restart', 'instance.update',
    'skill.install', 'skill.uninstall',
    'policy.create', 'policy.update', 'policy.delete',
    'incident.create', 'incident.update', 'incident.assign',
    'alert.create', 'alert.update', 'alert.delete',
    'vault.read', 'vault.write', 'vault.delete',
    'member.invite', 'member.remove', 'member.changeRole',
    'compliance.generate',
    'audit.export',
    'audit.write',
    'org.update',
    'cloud.write', 'cloud.admin',
    'agent.policy.write',
    'marketplace.install', 'marketplace.publish', 'marketplace.admin',
    'scim.read', 'scim.write',
    'sla.export',
    'saas.write',
  ]),

  security: new Set<Permission>([
    ...VIEW_PERMISSIONS,
    'policy.create', 'policy.update', 'policy.delete',
    'incident.create', 'incident.update', 'incident.assign',
    'alert.create', 'alert.update', 'alert.delete',
    'vault.read',
    'compliance.generate',
    'audit.export',
    'audit.write',
    'cloud.write',
    'agent.policy.write',
    'sla.export',
    'saas.write',
  ]),

  developer: new Set<Permission>([
    ...VIEW_PERMISSIONS,
    'instance.create', 'instance.restart', 'instance.update',
    'skill.install', 'skill.uninstall',
    'vault.read', 'vault.write',
    'marketplace.install',
  ]),

  viewer: new Set<Permission>([...VIEW_PERMISSIONS]),
};

/** All permissions as a flat array for UI consumption (role builder). */
export const PERMISSION_LIST: Permission[] = Object.values(PERMISSIONS);

/** Build permission categories by splitting on the first dot. */
export const PERMISSION_CATEGORIES: Record<string, Permission[]> = (() => {
  const cats: Record<string, Permission[]> = {};
  for (const p of PERMISSION_LIST) {
    const key = p.split('.')[0] ?? p;
    const label = key.charAt(0).toUpperCase() + key.slice(1);
    (cats[label] ??= []).push(p);
  }
  return cats;
})();

/** O(1) check: does this role have this permission? */
export function hasPermission(role: Role, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false;
}

/** Check if a role string is a built-in static role. */
export function isBuiltInRole(role: string): role is Role {
  return role in ROLE_PERMISSIONS;
}
