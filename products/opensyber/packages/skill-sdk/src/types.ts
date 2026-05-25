export type SkillTier = 'free' | 'pro' | 'premium';
export type SkillTarget = 'agent_session' | 'cloud_account' | 'organization';
export type SkillSchedule = 'on_demand' | 'hourly' | 'daily' | 'weekly';

export interface SkillProfile {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  tier: SkillTier;
  target: SkillTarget;
  schedule: SkillSchedule;
  permissions: string[];
  configSchema?: Record<string, unknown>;
}

export interface SkillContext {
  orgId: string;
  userId: string;
  config: Record<string, unknown>;
  logger: SkillLogger;
  http: SkillHttpClient;
  vault: SkillVaultClient;
  emit: SkillEmitter;
}

export interface SkillLogger {
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
}

export interface SkillHttpClient {
  get(url: string, options?: RequestInit): Promise<Response>;
  post(url: string, body: unknown, options?: RequestInit): Promise<Response>;
}

export interface SkillVaultClient {
  getSecret(key: string): Promise<string | null>;
}

export interface SkillEmitter {
  finding(finding: SkillFinding): void;
  metric(metric: SkillMetric): void;
  asset(asset: SkillAsset): void;
}

export interface SkillFinding {
  checkId: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  title: string;
  description: string;
  resourceId: string;
  resourceType: string;
}

export interface SkillMetric {
  name: string;
  value: number;
  unit?: string;
  tags?: Record<string, string>;
}

export interface SkillAsset {
  name: string;
  identifier: string;
  assetType: string;
  sensitivity: 'critical' | 'high' | 'medium' | 'low';
}

export interface SkillDefinition {
  profile: SkillProfile;
  execute: (ctx: SkillContext) => Promise<void>;
}
