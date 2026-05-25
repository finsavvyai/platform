export type Category = 'vulnerability' | 'misconfiguration' | 'incident' | 'identity' | 'compliance' | 'agent';
export type Severity = 'critical' | 'high' | 'medium' | 'low';
export type Status = 'new' | 'in_progress' | 'snoozed';

export interface InboxItem {
  id: string;
  title: string;
  category: Category;
  severity: Severity;
  source: string;
  resource: string;
  firstSeen: string;
  status: Status;
  score: number;
}

export const CATEGORY_COLORS: Record<Category, string> = {
  vulnerability: 'bg-red-500/15 text-red-400',
  misconfiguration: 'bg-amber-500/15 text-amber-400',
  incident: 'bg-orange-500/15 text-orange-400',
  identity: 'bg-purple-500/15 text-purple-400',
  compliance: 'bg-info/15 text-info',
  agent: 'bg-cyan-500/15 text-cyan-400',
};

export const CATEGORY_LABELS: Record<Category, string> = {
  vulnerability: 'Vulnerability',
  misconfiguration: 'Misconfiguration',
  incident: 'Incident',
  identity: 'Identity',
  compliance: 'Compliance',
  agent: 'Agent',
};

export const SEVERITY_COLORS: Record<Severity, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  medium: 'bg-info/20 text-info border-info/30',
  low: 'bg-neutral-500/20 text-neutral-400 border-neutral-500/30',
};

export const SCORE_COLORS: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400',
  high: 'bg-amber-500/20 text-amber-400',
  medium: 'bg-info/20 text-info',
  low: 'bg-neutral-700 text-neutral-400',
};

export function scoreColor(score: number): string {
  if (score >= 90) return SCORE_COLORS.critical;
  if (score >= 70) return SCORE_COLORS.high;
  if (score >= 40) return SCORE_COLORS.medium;
  return SCORE_COLORS.low;
}

export const ALL_CATEGORIES: Category[] = [
  'vulnerability', 'misconfiguration', 'incident',
  'identity', 'compliance', 'agent',
];

export const ALL_SEVERITIES: Severity[] = ['critical', 'high', 'medium', 'low'];

export const ALL_STATUSES: Status[] = ['new', 'in_progress', 'snoozed'];

export const STATUS_LABELS: Record<Status, string> = {
  new: 'New',
  in_progress: 'In Progress',
  snoozed: 'Snoozed',
};
