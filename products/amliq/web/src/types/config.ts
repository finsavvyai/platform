export interface TenantScreeningConfig {
  fuzzyThreshold: number;
  nameThreshold: number;
  idThreshold: number;
  addressThreshold: number;
  dateThreshold: number;
  enabledLayers: string[];
  matchingStrategy: 'strict' | 'balanced' | 'loose';
  alertOnHighConfidence: boolean;
  highConfidenceThreshold: number;
}

export interface TenantConfig {
  tenantId: string;
  name: string;
  screening: TenantScreeningConfig;
  createdAt: string;
  updatedAt: string;
}
