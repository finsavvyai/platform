interface Props {
  used: number;
  total: number;
}

export default function TeamSeatBar({ used, total }: Props) {
  const pct = Math.min((used / total) * 100, 100);

  return (
    <div className="bg-surface-card border border-surface-border rounded-xl p-5">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-zinc-200">Seat Usage</span>
        <span className="text-sm text-zinc-400">
          {used}/{total} seats used
        </span>
      </div>
      <div className="w-full h-2 rounded-full bg-surface-hover overflow-hidden">
        <div
          className="h-full rounded-full bg-emerald-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
