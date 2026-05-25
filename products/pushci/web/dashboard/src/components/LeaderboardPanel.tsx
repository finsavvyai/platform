import type { LeaderboardEntry } from '../pages/achievementsData';

export default function LeaderboardPanel({
  entries,
  loading,
}: {
  entries: LeaderboardEntry[];
  loading: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-12 rounded-lg shimmer" />
        ))}
      </div>
    );
  }

  if (entries.length === 0) {
    return <p className="text-sm text-zinc-500 text-center py-8">No leaderboard data yet.</p>;
  }

  return (
    <div className="space-y-1">
      {entries.map((entry) => (
        <div
          key={entry.rank}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors hover:bg-surface-hover/50 ${
            entry.rank <= 3 ? 'bg-surface-hover/30' : ''
          }`}
        >
          <span
            className={`w-6 text-center text-xs font-bold ${
              entry.rank === 1
                ? 'text-amber-400'
                : entry.rank === 2
                ? 'text-zinc-300'
                : entry.rank === 3
                ? 'text-amber-600'
                : 'text-zinc-500'
            }`}
          >
            {entry.rank}
          </span>
          <img
            src={entry.avatar_url}
            alt={entry.login}
            className="w-7 h-7 rounded-full border border-surface-border"
          />
          <span className="flex-1 text-sm text-zinc-200 truncate">{entry.login}</span>
          <span className="text-xs font-medium text-emerald-400">{entry.xp} XP</span>
        </div>
      ))}
    </div>
  );
}
