'use client';

import { AlertTriangle, Users } from 'lucide-react';
import type { RiskyUser } from './types';

interface Props {
  users: RiskyUser[];
}

const BUCKETS = [
  { label: '0-20', min: 0, max: 20, color: 'bg-green-500' },
  { label: '21-40', min: 21, max: 40, color: 'bg-info' },
  { label: '41-60', min: 41, max: 60, color: 'bg-amber-500' },
  { label: '61-80', min: 61, max: 80, color: 'bg-orange-500' },
  { label: '81-100', min: 81, max: 100, color: 'bg-red-500' },
];

export function RiskOverview({ users }: Props): React.ReactElement {
  const highRisk = users.filter((u) => u.riskScore >= 70).length;

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
      <div className="lg:col-span-2 rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
        <h2 className="text-lg font-semibold mb-4">
          Risk Score Distribution
        </h2>
        <div className="flex items-end gap-2 h-40">
          {BUCKETS.map((b) => {
            const count = users.filter(
              (u) => u.riskScore >= b.min && u.riskScore <= b.max
            ).length;
            const height = count > 0 ? Math.max(20, (count / users.length) * 100) : 4;
            return (
              <div key={b.label} className="flex-1 flex flex-col items-center gap-1">
                <span className="text-xs text-neutral-400">{count}</span>
                <div
                  className={`w-full rounded-t-md ${b.color} transition-all`}
                  style={{ height: `${height}%` }}
                />
                <span className="text-xs text-neutral-500">{b.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 flex flex-col items-center justify-center">
        <AlertTriangle className="h-8 w-8 text-red-400 mb-2" />
        <p className="text-4xl font-bold text-red-400">{highRisk}</p>
        <p className="text-sm text-neutral-400 mt-1">High-Risk Users</p>
        <p className="text-xs text-neutral-500 mt-2 flex items-center gap-1">
          <Users className="h-3 w-3" />
          {users.length} total users monitored
        </p>
      </div>
    </div>
  );
}
