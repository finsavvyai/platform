interface Props {
  xp: number;
  compact?: boolean;
}

export default function XPBar({ xp, compact }: Props) {
  const level = Math.floor(xp / 100);
  const progress = xp % 100;

  if (compact) {
    return (
      <div className="px-1">
        <div className="flex items-center justify-between text-[11px] mb-1">
          <span className="text-zinc-400">
            Lvl <span className="text-emerald-400 font-semibold">{level}</span>
          </span>
          <span className="text-zinc-500">{progress}/100 XP</span>
        </div>
        <div className="h-1.5 rounded-full bg-surface-hover overflow-hidden">
          <div
            className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-surface-border bg-surface-card p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-lg font-bold text-emerald-400">
            {level}
          </div>
          <div>
            <p className="text-sm font-semibold text-zinc-100">Level {level}</p>
            <p className="text-xs text-zinc-500">{xp} total XP</p>
          </div>
        </div>
        <span className="text-xs text-zinc-400">{progress}/100 to next level</span>
      </div>
      <div className="h-2.5 rounded-full bg-surface-hover overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-emerald-600 via-emerald-500 to-emerald-400 transition-all duration-700 ease-out animate-shimmer"
          style={{
            width: `${progress}%`,
            backgroundSize: '200% 100%',
          }}
        />
      </div>
    </div>
  );
}
