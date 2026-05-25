export interface Factor {
  name: string;
  score: number;
  weight: number;
  trend: 'up' | 'down' | 'stable';
}

export interface ThreatLevel {
  score: number;
  level: 'critical' | 'high' | 'medium' | 'low' | 'minimal';
  delta: number;
  factors: Factor[];
}

export interface ThreatEvent {
  id: string;
  type: string;
  severity: string;
  source: string;
  timestamp: string;
  description: string;
}

export const LEVEL_COLORS: Record<string, string> = {
  critical: 'red-500',
  high: 'orange-500',
  medium: 'amber-500',
  low: 'blue-500',
  minimal: 'green-500',
};

export function getLevel(score: number): ThreatLevel['level'] {
  if (score >= 81) return 'critical';
  if (score >= 61) return 'high';
  if (score >= 41) return 'medium';
  if (score >= 21) return 'low';
  return 'minimal';
}

export function getLevelColor(score: number): string {
  const level = getLevel(score);
  return LEVEL_COLORS[level];
}
