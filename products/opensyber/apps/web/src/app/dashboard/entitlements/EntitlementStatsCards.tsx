'use client';

import { Users, ShieldAlert, KeyRound, Bot } from 'lucide-react';
import type { EntitlementStats } from './types';

interface EntitlementStatsCardsProps {
  stats: EntitlementStats;
}

const cards = [
  { key: 'total', label: 'Total Identities', icon: Users, color: 'text-info', bg: 'bg-info/10' },
  { key: 'overPriv', label: 'Over-Privileged', icon: ShieldAlert, color: 'text-red-400', bg: 'bg-red-500/10' },
  { key: 'unused', label: 'Unused Permissions', icon: KeyRound, color: 'text-amber-400', bg: 'bg-amber-500/10' },
  { key: 'nonHuman', label: 'Non-Human Identities', icon: Bot, color: 'text-purple-400', bg: 'bg-purple-500/10' },
] as const;

export function EntitlementStatsCards({ stats }: EntitlementStatsCardsProps): React.ReactElement {
  const values: Record<string, string> = {
    total: String(stats.totalIdentities),
    overPriv: String(stats.overPrivileged),
    unused: String(stats.unusedPermissions),
    nonHuman: String(stats.nonHumanIdentities),
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
