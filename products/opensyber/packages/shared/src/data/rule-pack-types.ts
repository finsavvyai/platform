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
  description: string;
  category: RulePackCategory;
  severity: 'critical' | 'high' | 'medium' | 'low';
  rules: RuleDefinition[];
}

export const CATEGORY_LABELS: Record<RulePackCategory, string> = {
  ai_security: 'AI Security',
  cloud_posture: 'Cloud Posture',
  dev_environment: 'Dev Environment',
  compliance: 'Compliance',
};

export const CATEGORY_COLORS: Record<RulePackCategory, string> = {
  ai_security: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
  cloud_posture: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
  dev_environment: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  compliance: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
};

export const SEVERITY_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-amber-500/10 text-amber-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-blue-500/10 text-blue-400',
};
