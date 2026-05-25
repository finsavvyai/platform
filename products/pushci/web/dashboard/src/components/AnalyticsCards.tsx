import { useEffect, useState } from 'react';
import { api } from '../hooks/useApi';

interface Stat {
  label: string;
  value: string;
  trend: number; // positive = up, negative = down
  trendGood: boolean;
}

function TrendArrow({ trend, good }: { trend: number; good: boolean }) {
  if (trend === 0) return <span className="text-xs text-zinc-500">—</span>;
  const up = trend > 0;
  const color = (up && good) || (!up && !good) ? 'text-emerald-400' : 'text-red-400';
  return (
    <span className={`text-xs font-medium ${color} flex items-center gap-0.5`}>
      <svg width="10" height="10" viewBox="0 0 10 10" className={up ? '' : 'rotate-180'}>
        <path d="M5 1L9 6H1Z" fill="currentColor" />
      </svg>
      {Math.abs(trend)}%
    </span>
  );
}

export default function AnalyticsCards() {
  const [stats, setStats] = useState<Stat[]>([
    { label: 'Total Runs', value: '0', trend: 0, trendGood: true },
    { label: 'Pass Rate', value: '0%', trend: 0, trendGood: true },
    { label: 'Avg Duration', value: '0s', trend: 0, trendGood: true },
    { label: 'Active Runners', value: '0', trend: 0, trendGood: true },
  ]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const [runs, runnerPool] = await Promise.all([
          api.getRuns(),
          api.getRunnerPool(),
        ]);
        if (cancelled) return;

        const passed = runs.filter((run) => run.status === 'passed').length;
        const durations = runs
          .map((run) => run.duration_ms ?? 0)
          .filter((duration) => duration > 0);
        const avgDurationMs = durations.length > 0
          ? durations.reduce((sum, duration) => sum + duration, 0) / durations.length
          : 0;

        setStats([
          { label: 'Total Runs', value: String(runs.length), trend: 0, trendGood: true },
          { label: 'Pass Rate', value: `${runs.length > 0 ? Math.round((passed / runs.length) * 100) : 0}%`, trend: 0, trendGood: true },
          { label: 'Avg Duration', value: avgDurationMs >= 60_000 ? `${(avgDurationMs / 60_000).toFixed(1)}m` : `${Math.round(avgDurationMs / 1000)}s`, trend: 0, trendGood: true },
          { label: 'Active Runners', value: String(runnerPool.pool.busy), trend: 0, trendGood: true },
        ]);
      } catch {
        // Keep zero state if analytics inputs are unavailable.
      }
    }

    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {stats.map((s) => (
        <div key={s.label}
          className="bg-surface-card border border-surface-border rounded-2xl p-5 flex flex-col gap-1">
          <span className="text-xs text-zinc-500 font-medium uppercase tracking-wider">{s.label}</span>
          <div className="flex items-end gap-2">
            <span className="text-2xl font-bold text-zinc-100 tracking-tight">{s.value}</span>
            <TrendArrow trend={s.trend} good={s.trendGood} />
          </div>
        </div>
      ))}
    </div>
  );
}
