'use client';

import { MITRE_STAGES } from './types';

interface KillChainBarProps {
  activeStages: string[];
}

export function KillChainBar({ activeStages }: KillChainBarProps): React.ReactElement {
  return (
    <div className="space-y-2">
      <p className="text-xs text-neutral-400 font-medium">Kill Chain Progress</p>
      <div className="flex gap-1 overflow-x-auto">
        {MITRE_STAGES.map((stage) => {
          const active = activeStages.includes(stage);
          return (
            <div
              key={stage}
              className={`flex-shrink-0 rounded-md px-2 py-1 text-[10px] font-medium transition ${
                active
                  ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                  : 'bg-neutral-800/50 text-neutral-600 border border-neutral-800'
              }`}
              title={stage}
            >
              {stage.length > 12 ? stage.slice(0, 10) + '..' : stage}
            </div>
          );
        })}
      </div>
    </div>
  );
}
