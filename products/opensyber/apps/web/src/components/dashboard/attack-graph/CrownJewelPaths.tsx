'use client';

import { Crown, ArrowRight } from 'lucide-react';
import type { AttackPath } from '@/app/dashboard/attack-paths/types';

const SENSITIVITY_BADGE: Record<string, string> = {
  critical: 'bg-red-500/20 text-red-400 border-red-500/30',
  high: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
  medium: 'bg-signal/20 text-signal border-info/30',
  low: 'bg-neutral-500/20 text-text-secondary border-neutral-500/30',
};

export function CrownJewelPaths({ paths, total }: { paths: AttackPath[]; total: number }) {
  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="text-lg font-medium mb-4 flex items-center gap-2">
        <Crown className="h-5 w-5 text-amber-400" />
        Crown Jewel Paths
        {total > 0 && <span className="text-xs text-text-dim">({total} total)</span>}
      </h3>

      {paths.length === 0 ? (
        <p className="text-sm text-text-dim">No crown jewels are reachable from this session.</p>
      ) : (
        <div className="space-y-3">
          {paths.map((p, i) => (
            <div key={i} className="rounded-lg border border-border p-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium truncate">{p.targetName}</span>
                <span className={`text-xs px-2 py-0.5 rounded-full border ${SENSITIVITY_BADGE[p.targetSensitivity] ?? ''}`}>
                  {p.targetSensitivity}
                </span>
              </div>
              <div className="flex items-center gap-1 text-xs text-text-dim overflow-x-auto">
                {p.path.map((step, j) => (
                  <span key={j} className="flex items-center gap-1 shrink-0">
                    <span className="text-text-primary">{step.slice(0, 12)}{step.length > 12 ? '...' : ''}</span>
                    {j < p.path.length - 1 && <ArrowRight className="h-3 w-3 text-text-dim" />}
                  </span>
                ))}
              </div>
              <p className="text-xs text-text-dim mt-1">{p.hops} hop{p.hops !== 1 ? 's' : ''}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
