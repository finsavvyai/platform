import { useEffect, useState } from 'react';
import { api, type RunSummary } from '../../hooks/useApi';

export interface FlakyTestPoint {
  x: string;
  y: number;
  label: string;
}

function buildFlakyData(runs: RunSummary[]): FlakyTestPoint[] {
  const byBranch = new Map<string, { total: number; failed: number }>();

  for (const run of runs) {
    const key = run.branch.length > 16
      ? `${run.branch.slice(0, 14)}..`
      : run.branch;
    const entry = byBranch.get(key) ?? { total: 0, failed: 0 };
    entry.total++;
    if (run.status === 'failed') entry.failed++;
    byBranch.set(key, entry);
  }

  return Array.from(byBranch.entries())
    .filter(([, v]) => v.total >= 2)
    .map(([branch, v]) => {
      const rate = Math.round((v.failed / v.total) * 100);
      return {
        x: branch,
        y: rate,
        label: `${branch}: ${rate}% failure (${v.failed}/${v.total})`,
      };
    })
    .sort((a, b) => b.y - a.y)
    .slice(0, 8);
}

export function useFlakeyTestData() {
  const [data, setData] = useState<FlakyTestPoint[]>([]);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const runs = await api.getRuns();
        if (cancelled) return;
        setData(buildFlakyData(runs));
      } catch {
        if (!cancelled) setData([]);
      }
    }
    void load();
    return () => { cancelled = true; };
  }, []);

  return data;
}
