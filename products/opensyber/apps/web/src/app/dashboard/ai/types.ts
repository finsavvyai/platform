export interface AiInsight {
  id: string;
  title: string;
  description: string;
  category: 'threat' | 'compliance' | 'anomaly' | 'recommendation';
  severity: 'critical' | 'high' | 'medium' | 'low';
  source: string;
  status: 'new' | 'reviewed' | 'dismissed';
  createdAt: string;
  updatedAt: string;
}

export interface AiRecommendation {
  id: string;
  title: string;
  description: string;
  priority: 'P1' | 'P2' | 'P3' | 'P4';
  status: 'pending' | 'applied' | 'skipped';
  action: string;
  createdAt: string;
  updatedAt: string;
}

export interface AiQueryResult {
  query: string;
  results: Array<Record<string, unknown>>;
  summary: string;
  executedAt: string;
}

export interface AiQueryHistoryItem {
  id: string;
  query: string;
  resultCount: number;
  createdAt: string;
}

export const severityColors: Record<string, string> = {
  critical: 'bg-red-500/10 text-red-400',
  high: 'bg-orange-500/10 text-orange-400',
  medium: 'bg-yellow-500/10 text-yellow-400',
  low: 'bg-info/10 text-info',
};

export const statusColors: Record<string, string> = {
  new: 'bg-info/10 text-info',
  reviewed: 'bg-green-500/10 text-green-400',
  dismissed: 'bg-neutral-800 text-neutral-400',
  pending: 'bg-yellow-500/10 text-yellow-400',
  applied: 'bg-green-500/10 text-green-400',
  skipped: 'bg-neutral-800 text-neutral-400',
};

export const categoryColors: Record<string, string> = {
  threat: 'bg-red-500/10 text-red-400',
  compliance: 'bg-info/10 text-info',
  anomaly: 'bg-purple-500/10 text-purple-400',
  recommendation: 'bg-green-500/10 text-green-400',
};

export const priorityColors: Record<string, string> = {
  P1: 'bg-red-500/10 text-red-400',
  P2: 'bg-orange-500/10 text-orange-400',
  P3: 'bg-yellow-500/10 text-yellow-400',
  P4: 'bg-info/10 text-info',
};
