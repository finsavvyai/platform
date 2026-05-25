import { useMemo } from 'react';
import type { Alert } from '../types';

const RISK_WEIGHT: Record<string, number> = { critical: 40, high: 25, medium: 10, low: 2 };
const PRIORITY_WEIGHT: Record<string, number> = { critical: 30, high: 20, medium: 8, low: 1 };

export type SortMode = 'default' | 'smart' | 'oldest';

export type UrgencyTier = 'needs-attention' | 'in-progress' | 'actionable';

export interface ScoredAlert extends Alert {
  urgencyScore: number;
  urgencyTier: UrgencyTier;
}

function scoreAlert(alert: Alert): number {
  const ageHours = (Date.now() - new Date(alert.createdAt).getTime()) / 36e5;
  const ageFactor = Math.min(ageHours / 24, 10); // caps at 10 days

  return (
    (RISK_WEIGHT[alert.riskLevel] ?? 0) +
    (PRIORITY_WEIGHT[alert.priority] ?? 0) +
    Math.min(alert.matchedCount * 2, 20) +
    Math.min(alert.evidenceCount, 10) +
    ageFactor
  );
}

function tier(alert: Alert): UrgencyTier {
  if (alert.status === 'investigating') return 'in-progress';
  if (alert.riskLevel === 'critical' || alert.riskLevel === 'high') return 'needs-attention';
  return 'actionable';
}

export function useSmartSort(alerts: Alert[], mode: SortMode): ScoredAlert[] {
  return useMemo(() => {
    const scored: ScoredAlert[] = alerts.map((a) => ({
      ...a,
      urgencyScore: scoreAlert(a),
      urgencyTier: tier(a),
    }));

    if (mode === 'default') return scored;

    if (mode === 'oldest') {
      return [...scored].sort(
        (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
      );
    }

    // smart: tier order then score descending
    const tierOrder: Record<UrgencyTier, number> = {
      'needs-attention': 0,
      'in-progress': 1,
      'actionable': 2,
    };
    return [...scored].sort((a, b) => {
      const td = tierOrder[a.urgencyTier] - tierOrder[b.urgencyTier];
      return td !== 0 ? td : b.urgencyScore - a.urgencyScore;
    });
  }, [alerts, mode]);
}

export function groupByTier(alerts: ScoredAlert[]): Record<UrgencyTier, ScoredAlert[]> {
  return {
    'needs-attention': alerts.filter((a) => a.urgencyTier === 'needs-attention'),
    'in-progress': alerts.filter((a) => a.urgencyTier === 'in-progress'),
    'actionable': alerts.filter((a) => a.urgencyTier === 'actionable'),
  };
}
