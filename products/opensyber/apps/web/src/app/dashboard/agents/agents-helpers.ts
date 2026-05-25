export interface Summary {
  total: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
  secretsDetected: number;
}

export const RISK_COLORS: Record<string, string> = {
  critical: 'text-red-400',
  high: 'text-orange-400',
  medium: 'text-amber-400',
  low: 'text-neutral-500',
};

export const RISK_BG: Record<string, string> = {
  critical: 'bg-red-500/10 border-red-500/20',
  high: 'bg-orange-500/10 border-orange-500/20',
  medium: 'bg-amber-500/10 border-amber-500/20',
  low: 'bg-neutral-800 border-neutral-700',
};

export function computeScore(s: Summary): number {
  const raw = 100 - s.critical * 20 - s.high * 8 - s.medium * 2 - s.secretsDetected * 5;
  return Math.max(0, Math.min(100, raw));
}

export function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-400';
  if (score >= 60) return 'text-amber-400';
  if (score >= 40) return 'text-orange-400';
  return 'text-red-400';
}

export function scoreLabel(score: number): string {
  if (score >= 80) return 'Good';
  if (score >= 60) return 'Moderate Risk';
  if (score >= 40) return 'High Risk';
  return 'Critical Risk';
}
