import { useState, useEffect } from 'react';
import PageHeader from '../components/PageHeader';
import XPBar from '../components/XPBar';
import BadgeCard from '../components/BadgeCard';
import LeaderboardPanel from '../components/LeaderboardPanel';
import { BADGES, CATEGORIES } from './achievementsData';
import type { EarnedBadge, LeaderboardEntry } from './achievementsData';
import { fetchAchievements, fetchLeaderboard, triggerBadgeCheck } from './achievementsApi';

export default function AchievementsPage() {
  const [xp, setXp] = useState(0);
  const [earned, setEarned] = useState<EarnedBadge[]>([]);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [lbLoading, setLbLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  useEffect(() => {
    // Trigger server-side badge evaluation, then load current state.
    // Sequencing matters: a fresh login won't have badges awarded yet.
    (async () => {
      await triggerBadgeCheck();
      try {
        const data = await fetchAchievements();
        setXp(data.xp);
        setEarned(data.badges);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    })();

    fetchLeaderboard()
      .then(setLeaderboard)
      .catch(() => {})
      .finally(() => setLbLoading(false));
  }, []);

  const earnedMap = new Map(earned.map((b) => [b.badge_id, b]));
  const earnedCount = earned.length;
  const totalCount = BADGES.length;

  const recentIds = new Set(
    earned
      .slice()
      .sort((a, b) => new Date(b.earned_at).getTime() - new Date(a.earned_at).getTime())
      .slice(0, 3)
      .map((b) => b.badge_id)
  );

  const filteredBadges = activeCategory
    ? BADGES.filter((b) => b.category === activeCategory)
    : BADGES;

  return (
    <div className="animate-fade-in">
      <PageHeader
        title="Achievements"
        description={`${earnedCount}/${totalCount} badges earned. Keep pushing.`}
        action={
          <button
            onClick={() => setShowLeaderboard(!showLeaderboard)}
            className="lg:hidden px-3 py-2 rounded-lg text-sm font-medium border border-surface-border bg-surface-card text-zinc-300 hover:bg-surface-hover transition-colors"
          >
            {showLeaderboard ? 'Badges' : 'Leaderboard'}
          </button>
        }
      />

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <div className="flex gap-6">
        <div className={`flex-1 min-w-0 ${showLeaderboard ? 'hidden lg:block' : ''}`}>
          {loading ? (
            <div className="h-20 rounded-xl shimmer mb-6" />
          ) : (
            <div className="mb-6 stagger-1">
              <XPBar xp={xp} />
            </div>
          )}

          <div className="flex flex-wrap gap-2 mb-6 stagger-2">
            <button
              onClick={() => setActiveCategory(null)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                activeCategory === null
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-surface-card border border-surface-border text-zinc-400 hover:text-zinc-200'
              }`}
            >
              All
            </button>
            {CATEGORIES.map((cat) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(cat.key)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  activeCategory === cat.key
                    ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                    : 'bg-surface-card border border-surface-border text-zinc-400 hover:text-zinc-200'
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-28 rounded-xl shimmer" />
              ))}
            </div>
          ) : activeCategory ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredBadges.map((badge, idx) => (
                <div key={badge.id} className={`stagger-${Math.min(idx + 1, 8)}`}>
                  <BadgeCard
                    badge={badge}
                    earned={earnedMap.get(badge.id) ?? null}
                    isNew={recentIds.has(badge.id)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-8">
              {CATEGORIES.map((cat) => {
                const catBadges = BADGES.filter((b) => b.category === cat.key);
                return (
                  <section key={cat.key}>
                    <h2 className="text-sm font-semibold text-zinc-200 mb-3">{cat.label}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                      {catBadges.map((badge, idx) => (
                        <div key={badge.id} className={`stagger-${Math.min(idx + 1, 8)}`}>
                          <BadgeCard
                            badge={badge}
                            earned={earnedMap.get(badge.id) ?? null}
                            isNew={recentIds.has(badge.id)}
                          />
                        </div>
                      ))}
                    </div>
                  </section>
                );
              })}
            </div>
          )}
        </div>

        <aside className={`w-72 shrink-0 ${showLeaderboard ? 'block' : 'hidden lg:block'}`}>
          <div className="sticky top-4 rounded-xl border border-surface-border bg-surface-card p-4">
            <h2 className="text-sm font-semibold text-zinc-100 mb-4">Leaderboard</h2>
            <LeaderboardPanel entries={leaderboard} loading={lbLoading} />
          </div>
        </aside>
      </div>
    </div>
  );
}
