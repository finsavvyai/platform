'use client';

import { Shield, Clock, CalendarDays } from 'lucide-react';
import type { AccessSummary } from './types';

interface AccessSummaryCardsProps {
  summary: AccessSummary;
}

const cards = [
  { key: 'active', label: 'Active Elevated Sessions', icon: Shield, color: 'text-green-400', bg: 'bg-green-500/10' },
  { key: 'pending', label: 'Pending Requests', icon: Clock, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'today', label: 'Requests Today', icon: CalendarDays, color: 'text-info', bg: 'bg-info/10' },
] as const;

export function AccessSummaryCards({ summary }: AccessSummaryCardsProps): React.ReactElement {
  const values: Record<string, number> = {
    active: summary.activeSessions,
    pending: summary.pendingRequests,
    today: summary.requestsToday,
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
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
