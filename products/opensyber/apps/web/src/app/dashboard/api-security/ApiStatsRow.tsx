'use client';

import { Globe, AlertTriangle, ShieldOff, KeyRound } from 'lucide-react';
import type { ApiStats } from './types';

interface Props {
  stats: ApiStats;
}

export function ApiStatsRow({ stats }: Props): React.ReactElement {
  const cards = [
    { label: 'Total Endpoints Discovered', value: stats.totalEndpoints.toLocaleString(), icon: Globe, color: 'text-info' },
    { label: 'High-Risk Endpoints', value: stats.highRiskEndpoints.toLocaleString(), icon: AlertTriangle, color: 'text-red-400' },
    { label: 'Attack Attempts (24h)', value: stats.attacks24h.toLocaleString(), icon: ShieldOff, color: 'text-amber-400' },
    { label: 'Auth Issues', value: stats.authIssues.toLocaleString(), icon: KeyRound, color: 'text-red-400' },
  ];

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
          <div className="flex items-center justify-between">
            <p className="text-xs text-neutral-400">{c.label}</p>
            <c.icon className={`h-5 w-5 ${c.color}`} />
          </div>
          <p className={`mt-2 text-3xl font-bold ${c.color}`}>{c.value}</p>
        </div>
      ))}
    </div>
  );
}
