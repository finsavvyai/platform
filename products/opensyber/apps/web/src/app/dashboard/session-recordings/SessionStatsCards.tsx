'use client';

import { Monitor, Activity, AlertTriangle, Clock } from 'lucide-react';
import type { SessionStats } from './types';

interface SessionStatsCardsProps {
  stats: SessionStats;
}

const cards = [
  { key: 'total', label: 'Total Sessions (30d)', icon: Monitor, color: 'text-info', bg: 'bg-info/10' },
  { key: 'active', label: 'Active Now', icon: Activity, color: 'text-green-400', bg: 'bg-green-500/10' },
  { key: 'flagged', label: 'Flagged', icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10' },
  { key: 'avg', label: 'Avg Duration', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
] as const;

export function SessionStatsCards({ stats }: SessionStatsCardsProps): React.ReactElement {
  const values: Record<string, string> = {
    total: stats.totalSessions.toLocaleString(),
    active: String(stats.activeNow),
    flagged: String(stats.flagged),
    avg: `${stats.avgDuration}m`,
  };

  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
      {cards.map((card) => {
        const Icon = card.icon;
        return (
          <div key={card.key} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
            <div className="flex items-center gap-3 mb-2">
              <div className={`flex h-8 w-8 items-center justify-center rounded-lg ${card.bg}`}>
                <Icon className={`h-4 w-4 ${card.color}`} />
              </div>
              <span className="text-xs text-neutral-400 uppercase tracking-wide">{card.label}</span>
            </div>
            <p className={`text-2xl font-semibold ${card.color}`}>{values[card.key]}</p>
          </div>
        );
      })}
    </div>
  );
}
