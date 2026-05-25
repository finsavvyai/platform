import type { BadgeDef, EarnedBadge } from '../pages/achievementsData';
import { cardGesture } from '../styles/gestures';

export default function BadgeCard({
  badge,
  earned,
  isNew,
}: {
  badge: BadgeDef;
  earned: EarnedBadge | null;
  isNew: boolean;
}) {
  const unlocked = !!earned;

  return (
    <div
      className={`relative rounded-xl border p-4 transition-all duration-200 ${cardGesture} ${
        unlocked
          ? 'border-emerald-500/30 bg-surface-card'
          : 'border-surface-border bg-surface-card/50 opacity-60'
      } ${isNew ? 'animate-pulse-glow' : ''}`}
    >
      {unlocked && (
        <div className="absolute inset-0 rounded-xl ring-1 ring-emerald-500/20 pointer-events-none" />
      )}

      <div className="flex items-start gap-3">
        <div
          className={`relative w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 ${
            unlocked
              ? 'bg-emerald-500/15 shadow-lg shadow-emerald-500/10'
              : 'bg-zinc-800 grayscale'
          }`}
        >
          {badge.icon}
          {!unlocked && (
            <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-black/40">
              <svg className="w-4 h-4 text-zinc-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeWidth={2}
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                />
              </svg>
            </div>
          )}
        </div>
        <div className="flex-1 min-w-0">
          <p className={`text-sm font-semibold ${unlocked ? 'text-zinc-100' : 'text-zinc-500'}`}>
            {badge.name}
          </p>
          <p className="text-xs text-zinc-500 mt-0.5">{badge.desc}</p>
          <div className="flex items-center justify-between mt-2">
            <span className={`text-xs font-medium ${unlocked ? 'text-emerald-400' : 'text-zinc-600'}`}>
              +{badge.xp} XP
            </span>
            {earned && (
              <span className="text-[11px] text-zinc-500">
                {new Date(earned.earned_at).toLocaleDateString()}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
