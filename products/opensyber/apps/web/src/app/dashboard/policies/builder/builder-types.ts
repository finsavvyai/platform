export interface RuleCondition {
  field: string;
  operator: 'equals' | 'contains' | 'gt' | 'lt' | 'in' | 'matches';
  value: string | number | string[];
}

export interface RuleAction {
  type: 'alert' | 'notify' | 'block';
  config: {
    severity?: 'critical' | 'high' | 'medium' | 'low';
    channel?: string;
  };
}

export interface RuleDefinition {
  name: string;
  conditions: RuleCondition[];
  actions: RuleAction[];
}

export type RulePackCategory =
  | 'ai_security'
  | 'cloud_posture'
  | 'dev_environment'
  | 'compliance';

export interface RulePack {
  id: string;
  name: string;
  description: string | null;
  category: RulePackCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  rules: string;
  isBuiltIn: boolean;
  createdAt: string;
}

export interface InstalledPack {
  id: string;
  instanceId: string;
  packId: string;
  installedAt: string;
  isActive: boolean;
  pack: RulePack | null;
}

export const CATEGORY_LABELS: Record<RulePackCategory, string> = {
  ai_security: 'AI Security',
  cloud_posture: 'Cloud Posture',
  dev_environment: 'Dev Environment',
  compliance: 'Compliance',
};

export const CATEGORY_COLORS: Record<RulePackCategory, string> = {
  ai_security: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  cloud_posture: 'bg-info/10 text-info border-info/20',
  dev_environment: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  compliance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-amber-500/10 text-amber-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-info/10 text-info',
};

export const EVENT_TYPE_OPTIONS = [
  'prompt_injection',
  'secret_detected',
  'bedrock_invoke',
  'cspm_finding',
  'unauthorized_network',
  'file_modified',
  'auth_failure',
  'compliance_check_failed',
  'data_transfer',
  'anomaly_detected',
] as const;

export const OPERATOR_OPTIONS = [
  { value: 'equals', label: 'equals' },
  { value: 'contains', label: 'contains' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'in', label: 'in list' },
  { value: 'matches', label: 'matches pattern' },
] as const;

export const ACTION_OPTIONS = [
  { value: 'alert', label: 'Create Alert' },
  { value: 'notify', label: 'Send Notification' },
  { value: 'block', label: 'Block Activity' },
] as const;

export const CHANNEL_OPTIONS = [
  'email', 'slack', 'pagerduty', 'opsgenie', 'teams', 'discord', 'webhook',
] as const;
