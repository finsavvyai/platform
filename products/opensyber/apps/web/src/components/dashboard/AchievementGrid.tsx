'use client';

import { AchievementCard } from './AchievementCard';

interface AchievementData {
  slug: string;
  title: string;
  description: string;
  icon: string;
  category: string;
  earned: boolean;
}

interface AchievementGridProps {
  achievements: AchievementData[];
  instanceId: string;
}

export function AchievementGrid({ achievements, instanceId }: AchievementGridProps) {
  const earned = achievements.filter((a) => a.earned);
  const locked = achievements.filter((a) => !a.earned);

  return (
    <div className="space-y-8">
      {/* Progress */}
      <div className="rounded border border-border bg-panel/30 p-6">
        <div className="flex items-center justify-between mb-2">
          <span className="text-sm text-text-secondary">Progress</span>
          <span className="text-sm font-medium">
            {earned.length}/{achievements.length}
          </span>
        </div>
        <div className="h-2 rounded-full bg-surface overflow-hidden">
          <div
            className="h-full rounded-full bg-amber-500 transition-all"
            style={{ width: `${(earned.length / Math.max(achievements.length, 1)) * 100}%` }}
          />
        </div>
      </div>

      {/* Earned */}
      {earned.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Earned</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {earned.map((a) => (
              <AchievementCard key={a.slug} {...a} instanceId={instanceId} />
            ))}
          </div>
        </div>
      )}

      {/* Locked */}
      {locked.length > 0 && (
        <div>
          <h3 className="text-lg font-semibold mb-4">Locked</h3>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {locked.map((a) => (
              <AchievementCard key={a.slug} {...a} instanceId={instanceId} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
