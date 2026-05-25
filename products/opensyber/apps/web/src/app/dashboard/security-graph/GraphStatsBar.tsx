'use client';

import { Network, GitBranch, AlertTriangle, Unplug } from 'lucide-react';

interface Props {
  total: number;
  edgeCount: number;
  critical: number;
  isolated: number;
}

const stats = [
  { key: 'total', label: 'Total Nodes', icon: Network, color: 'text-info' },
  { key: 'edgeCount', label: 'Total Edges', icon: GitBranch, color: 'text-purple-400' },
  { key: 'critical', label: 'Critical Risk', icon: AlertTriangle, color: 'text-red-400' },
  { key: 'isolated', label: 'Isolated Nodes', icon: Unplug, color: 'text-amber-400' },
] as const;

export function GraphStatsBar({ total, edgeCount, critical, isolated }: Props) {
  const values: Record<string, number> = { total, edgeCount, critical, isolated };

  return (
    <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
      {stats.map(({ key, label, icon: Icon, color }) => (
        <div
          key={key}
          className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/30 px-4 py-3"
        >
          <Icon className={`h-5 w-5 ${color}`} />
          <div>
            <p className="text-2xl font-semibold">{values[key]}</p>
            <p className="text-xs text-neutral-400">{label}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
