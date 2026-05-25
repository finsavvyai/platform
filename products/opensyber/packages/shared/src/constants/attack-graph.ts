export const ASSET_TYPES = [
  'file', 'env_var', 'cloud_resource', 'secret',
  'saas_app', 'database', 'agent_session',
] as const;
export type AssetType = (typeof ASSET_TYPES)[number];

export const SENSITIVITY_LEVELS = [
  'critical', 'high', 'medium', 'low', 'info',
] as const;
export type SensitivityLevel = (typeof SENSITIVITY_LEVELS)[number];

export const RELATION_TYPES = [
  'read_access', 'write_access', 'execute_access',
  'secret_access', 'network_access', 'inherits_from',
  'contains', 'authenticates_to',
] as const;
export type RelationType = (typeof RELATION_TYPES)[number];

export const DISCOVERY_SOURCES = [
  'agent_activity', 'cspm_scan', 'manual',
  'cloud_config', 'iam_policy', 'inferred',
] as const;
export type DiscoverySource = (typeof DISCOVERY_SOURCES)[number];

export const ASSET_STATUS = ['active', 'stale', 'removed'] as const;
export type AssetStatus = (typeof ASSET_STATUS)[number];

/** Sensitivity weights for blast radius scoring */
export const SENSITIVITY_WEIGHTS: Record<SensitivityLevel, number> = {
  critical: 25,
  high: 10,
  medium: 3,
  low: 1,
  info: 0,
};

export const CROWN_JEWEL_BONUS = 15;
