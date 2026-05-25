interface Stat {
  label: string;
  value: string;
  trend: number; // positive = up, negative = down
  trendGood: boolean;
}

// Placeholder stats shown before API data loads.
const placeholderStats: Stat[] = [
  { label: 'Total Runs', value: '--', trend: 0, trendGood: true },
  { label: 'Pass Rate', value: '--', trend: 0, trendGood: true },
  { label: 'Avg Duration', value: '--', trend: 0, trendGood: true },
  { label: 'Active Runners', value: '--', trend: 0, trendGood: true },
];

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
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      {placeholderStats.map((s) => (
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
