/**
 * Enterprise RBAC Roles - Phase 2 & 3
 *
 * 3 enterprise roles with fine-grained permissions for SOC, integrations, and admin.
 */

export const ENTERPRISE_PERMISSIONS = {
  // Alerts
  'alert.read': 'alert.read',
  'alert.acknowledge': 'alert.acknowledge',
  // Integrations
  'integration.read': 'integration.read',
  'integration.create': 'integration.create',
  'integration.delete': 'integration.delete',
  'integration.configure': 'integration.configure',
  // Credentials
  'credential.manage': 'credential.manage',
  // Rule packs
  'rule-pack.manage': 'rule-pack.manage',
  // Health dashboard
  'health.read': 'health.read',
  // Events and logs
  'event.read': 'event.read',
  // Billing
  'billing.manage': 'billing.manage',
  // RBAC and users
  'rbac.manage': 'rbac.manage',
  'user.manage': 'user.manage',
  // Organization
  'org.settings': 'org.settings',
  // SSO
  'sso.manage': 'sso.manage',
  // Compliance
  'compliance.export': 'compliance.export',
} as const;

export type EnterprisePermission = (typeof ENTERPRISE_PERMISSIONS)[keyof typeof ENTERPRISE_PERMISSIONS];

export const ENTERPRISE_ROLES = {
  soc_analyst: 'soc_analyst',
  integration_engineer: 'integration_engineer',
  admin: 'admin',
} as const;

export type EnterpriseRole = (typeof ENTERPRISE_ROLES)[keyof typeof ENTERPRISE_ROLES];

export const ROLE_DESCRIPTIONS: Record<EnterpriseRole, string> = {
  soc_analyst: 'Security Operations Center analyst - read alerts, acknowledge issues, view integrations and events',
  integration_engineer: 'Integration engineer - configure integrations, manage credentials, install rule packs',
  admin: 'Organization admin - full access including billing, RBAC, and org settings',
};

const ALL_ENTERPRISE_PERMISSIONS = new Set<EnterprisePermission>(
  Object.values(ENTERPRISE_PERMISSIONS) as EnterprisePermission[],
);

const SOC_ANALYST_PERMISSIONS = new Set<EnterprisePermission>([
  'alert.read',
  'alert.acknowledge',
  'integration.read',
  'health.read',
  'event.read',
]);

const INTEGRATION_ENGINEER_PERMISSIONS = new Set<EnterprisePermission>([
  ...SOC_ANALYST_PERMISSIONS,
  'integration.create',
  'integration.delete',
  'integration.configure',
  'credential.manage',
  'rule-pack.manage',
]);

export const ENTERPRISE_ROLE_PERMISSIONS: Record<EnterpriseRole, Set<EnterprisePermission>> = {
  soc_analyst: SOC_ANALYST_PERMISSIONS,
  integration_engineer: INTEGRATION_ENGINEER_PERMISSIONS,
  admin: ALL_ENTERPRISE_PERMISSIONS,
};

export function enterpriseHasPermission(role: EnterpriseRole, permission: EnterprisePermission): boolean {
  return ENTERPRISE_ROLE_PERMISSIONS[role].has(permission);
}
