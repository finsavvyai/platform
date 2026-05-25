export type RiskLevel = 'critical' | 'high' | 'medium' | 'low';

export interface ActivitySummary {
  totalEvents: number;
  criticalEvents: number;
  agentsMonitored: number;
  riskScore: number;
  riskBreakdown: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
}

export interface ActivityEvent {
  id: string;
  timestamp: string;
  agentName: string;
  eventType: string;
  riskLevel: RiskLevel;
  path: string;
  summary: string;
}

export function riskColor(level: RiskLevel): string {
  switch (level) {
    case 'critical': return 'text-red-500';
    case 'high': return 'text-orange-500';
    case 'medium': return 'text-amber-500';
    case 'low': return 'text-neutral-400';
  }
}

export function riskBgColor(level: RiskLevel): string {
  switch (level) {
    case 'critical': return 'bg-red-500';
    case 'high': return 'bg-orange-500';
    case 'medium': return 'bg-amber-500';
    case 'low': return 'bg-neutral-500';
  }
}

export function riskBadgeBg(level: RiskLevel): string {
  switch (level) {
    case 'critical': return 'bg-red-500/10 text-red-500';
    case 'high': return 'bg-orange-500/10 text-orange-500';
    case 'medium': return 'bg-amber-500/10 text-amber-500';
    case 'low': return 'bg-neutral-500/10 text-neutral-400';
  }
}

export function scoreColor(score: number): string {
  if (score >= 75) return 'text-red-500';
  if (score >= 50) return 'text-orange-500';
  if (score >= 25) return 'text-amber-500';
  return 'text-green-500';
}
