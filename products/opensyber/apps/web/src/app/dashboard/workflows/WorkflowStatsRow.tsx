'use client';

import { Zap, Play, Timer, CheckCircle } from 'lucide-react';

interface Props {
  activeCount: number;
  totalRuns: number;
  avgDuration: string;
  successRate: number;
}

export function WorkflowStatsRow({ activeCount, totalRuns, avgDuration, successRate }: Props): React.ReactElement {
  const cards = [
    { label: 'Active Workflows', value: activeCount.toString(), icon: Zap, color: 'text-green-400' },
    { label: 'Total Runs', value: totalRuns.toLocaleString(), icon: Play, color: 'text-info' },
    { label: 'Avg Duration', value: avgDuration, icon: Timer, color: 'text-amber-400' },
    { label: 'Success Rate', value: `${successRate}%`, icon: CheckCircle, color: 'text-emerald-400' },
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
