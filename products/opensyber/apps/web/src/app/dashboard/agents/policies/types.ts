export interface AgentPolicy {
  id: string;
  name: string;
  ruleType: 'file_pattern' | 'command_pattern' | 'risk_threshold' | 'secrets_threshold';
  config: Record<string, unknown>;
  severity: 'critical' | 'high' | 'medium' | 'low';
  isActive: boolean;
  violationCount: number;
  createdAt: string;
}

export const RULE_TYPE_LABELS: Record<string, string> = {
  file_pattern: 'File Pattern',
  command_pattern: 'Command Pattern',
  risk_threshold: 'Risk Threshold',
  secrets_threshold: 'Secrets Threshold',
};

export const RULE_TYPE_COLORS: Record<string, string> = {
  file_pattern: 'bg-info/10 text-info',
  command_pattern: 'bg-orange-500/10 text-orange-400',
  risk_threshold: 'bg-amber-500/10 text-amber-400',
  secrets_threshold: 'bg-red-500/10 text-red-400',
};

export const SEV_COLORS: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-amber-500/10 text-amber-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-info/10 text-info',
};
