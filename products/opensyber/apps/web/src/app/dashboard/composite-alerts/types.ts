export interface CorrelatedEvent {
  id: string;
  timestamp: string;
  source: string;
  type: string;
  severity: 'Critical' | 'High' | 'Medium' | 'Low';
  detail: string;
}

export interface CompositeAlert {
  id: string;
  title: string;
  confidence: number;
  narrative: string;
  mitreTactics: string[];
  timeSpan: string;
  status: 'Active' | 'Acknowledged' | 'Dismissed';
  events: CorrelatedEvent[];
}

export const SEVERITY_COLORS: Record<string, string> = {
  Critical: 'bg-red-500/20 text-red-400',
  High: 'bg-amber-500/20 text-amber-400',
  Medium: 'bg-info/20 text-info',
  Low: 'bg-neutral-500/20 text-neutral-400',
};

export const STATUS_COLORS: Record<string, string> = {
  Active: 'bg-red-500/20 text-red-400',
  Acknowledged: 'bg-amber-500/20 text-amber-400',
  Dismissed: 'bg-neutral-500/20 text-neutral-400',
};

export const SOURCE_COLORS: Record<string, string> = {
  'Agent Monitor': '#3b82f6',
  'CSPM Scanner': '#22c55e',
  'Policy Engine': '#f59e0b',
  'SIEM': '#a855f7',
  'Vault Audit': '#ef4444',
  'Network Monitor': '#06b6d4',
};
