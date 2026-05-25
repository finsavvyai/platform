'use client';

import type { Identity, IdentityType } from './types';

interface PermissionDistributionProps {
  identities: Identity[];
}

const permCategories = ['admin', 'write', 'read', 'execute'] as const;
const permColors: Record<string, string> = {
  admin: '#ef4444',
  write: '#f59e0b',
  read: '#3b82f6',
  execute: '#22c55e',
};

const typeLabels: Record<IdentityType, string> = {
  human: 'Human',
  service: 'Service Account',
  bot: 'Bot',
  automation: 'Automation',
};

function aggregateByType(identities: Identity[]): Record<IdentityType, Record<string, number>> {
  const result: Record<string, Record<string, number>> = {};
  for (const id of identities) {
    if (!result[id.type]) {
      result[id.type] = { admin: 0, write: 0, read: 0, execute: 0 };
    }
    for (const cat of permCategories) {
      result[id.type][cat] += id.grantedBreakdown[cat];
    }
  }
  return result as Record<IdentityType, Record<string, number>>;
}

export function PermissionDistribution({ identities }: PermissionDistributionProps): React.ReactElement {
  const byType = aggregateByType(identities);
  const types = Object.keys(byType) as IdentityType[];

  return (
    <div className="mb-8">
      <h2 className="text-2xl font-semibold mb-4">Permission Distribution</h2>
      <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
        <div className="flex flex-wrap gap-4 mb-4">
          {permCategories.map((cat) => (
            <div key={cat} className="flex items-center gap-2">
              <div className="h-3 w-3 rounded-full" style={{ backgroundColor: permColors[cat] }} />
              <span className="text-xs text-neutral-400 capitalize">{cat}</span>
            </div>
          ))}
        </div>
        <div className="space-y-4">
          {types.map((type) => {
            const total = Object.values(byType[type]).reduce((a, b) => a + b, 0);
            if (total === 0) return null;
            return (
              <div key={type}>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-neutral-300">{typeLabels[type]}</span>
                  <span className="text-xs text-neutral-500">{total} total</span>
                </div>
                <div className="flex h-6 w-full rounded-lg overflow-hidden bg-neutral-800">
                  {permCategories.map((cat) => {
                    const pct = (byType[type][cat] / total) * 100;
                    if (pct === 0) return null;
                    return (
                      <div
                        key={cat}
                        className="h-full transition-all"
                        style={{ width: `${pct}%`, backgroundColor: permColors[cat] }}
                        title={`${cat}: ${byType[type][cat]} (${Math.round(pct)}%)`}
                      />
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
