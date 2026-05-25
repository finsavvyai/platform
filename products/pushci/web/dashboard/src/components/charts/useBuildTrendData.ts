import { useEffect, useState } from 'react';
import { api } from '../../hooks/useApi';

export interface BuildPoint {
  x: number;
  y: number;
  passed: boolean;
  label: string;
}

export function useBuildTrendData() {
  const [data, setData] = useState<BuildPoint[]>([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const runs = await api.getRuns();
        if (cancelled) return;
        const points = runs
          .filter((r) => (r.duration_ms ?? 0) > 0)
          .slice(0, 30)
          .reverse()
          .map((r, i) => {
            const secs = Math.max(1, Math.round((r.duration_ms ?? 0) / 1000));
            return {
              x: i + 1,
              y: secs,
              passed: r.status === 'passed',
              label: `Run #${i + 1}: ${secs}s (${r.status})`,
            };
          });
        setData(points);
      } catch {
        if (!cancelled) setData([]);
      }
    }

    void load();
    return () => { cancelled = true; };
  }, []);

  return data;
}
