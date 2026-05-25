'use client';

import type { ServiceExposure } from './types';

interface Props {
  services: ServiceExposure[];
}

export function ServiceBarChart({ services }: Props): React.ReactElement {
  const maxCount = Math.max(...services.map((s) => s.count));

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6">
      <h2 className="text-lg font-semibold mb-4">Exposure by Service</h2>
      <div className="space-y-4">
        {services.map((s) => {
          const width = Math.max(8, (s.count / maxCount) * 100);
          return (
            <div key={s.id}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium">{s.service}</span>
                <span className="text-xs text-neutral-400">
                  {s.count} exposed
                </span>
              </div>
              <div className="h-6 w-full rounded-lg bg-neutral-800/50 overflow-hidden">
                <div
                  className={`h-full rounded-lg ${s.color} transition-all`}
                  style={{ width: `${width}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
