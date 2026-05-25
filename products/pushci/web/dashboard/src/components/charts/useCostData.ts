import { useEffect, useState } from 'react';
import { api } from '../../hooks/useApi';

const GH_RATE = 0.008; // $/min — GitHub Actions Linux
const GH_SETUP_OVERHEAD_MIN = 0.75; // ~45s runner startup + checkout
const GH_MIN_BILLABLE_MIN = 1; // GitHub rounds up to nearest minute
const DAYS_IN_MONTH = 30;

export interface CostData {
  monthlyRuns: number;
  avgDurationMin: number;
  observedDays: number;
  totalRuns: number;
  ghMonthlyCost: number;
  pushciCost: number;
  saved: number;
}

export function useCostData(): CostData {
  const [state, setState] = useState({
    monthlyRuns: 0,
    avgDurationMin: 0,
    observedDays: 0,
    totalRuns: 0,
  });

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const runs = await api.getRuns();
        if (cancelled) return;
        const withDuration = runs.filter((r) => (r.duration_ms ?? 0) > 0);
        if (withDuration.length === 0) {
          setState({ monthlyRuns: 0, avgDurationMin: 0, observedDays: 0, totalRuns: 0 });
          return;
        }
        const avgMs = withDuration.reduce((s, r) => s + (r.duration_ms ?? 0), 0) / withDuration.length;
        const dates = runs.map((r) => new Date(r.created_at).getTime());
        const spanDays = Math.max((Math.max(...dates) - Math.min(...dates)) / 86_400_000, 1);
        const projected = Math.round((runs.length / spanDays) * DAYS_IN_MONTH);
        setState({
          totalRuns: runs.length,
          monthlyRuns: projected,
          avgDurationMin: avgMs / 60_000,
          observedDays: Math.round(spanDays),
        });
      } catch {
        if (!cancelled) setState({ monthlyRuns: 0, avgDurationMin: 0, observedDays: 0, totalRuns: 0 });
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  // GitHub Actions bills per-minute with 1-min minimum, plus ~45s
  // runner setup overhead (VM boot, checkout, tool install) that
  // PushCI skips entirely by running locally.
  const ghBillableMin = Math.max(state.avgDurationMin + GH_SETUP_OVERHEAD_MIN, GH_MIN_BILLABLE_MIN);
  const ghMonthlyCost = Math.round(state.monthlyRuns * ghBillableMin * GH_RATE * 100) / 100;
  return {
    ...state,
    ghMonthlyCost,
    pushciCost: 0,
    saved: ghMonthlyCost,
  };
}
