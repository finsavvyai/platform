'use client';

import { ToggleRight } from 'lucide-react';

interface RulePack {
  id: string;
  name: string;
  version: string;
  ruleCount: number;
  active: boolean;
  lastUpdated: string;
}

interface RulePackListProps {
  packs: RulePack[];
}

export function RulePackList({ packs }: RulePackListProps) {
  return (
    <div>
      <h2 className="text-xl font-bold text-white mb-4">Installed Rule Packs</h2>
      <div className="space-y-3">
        {packs.map((pack) => (
          <div
            key={pack.id}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 flex items-center justify-between hover:border-gray-600"
          >
            <div className="flex-1">
              <h3 className="font-semibold text-white">{pack.name}</h3>
              <p className="text-sm text-gray-400 mt-1">
                v{pack.version} • {pack.ruleCount} rules
              </p>
              <p className="text-xs text-gray-500 mt-2">
                Updated {new Date(pack.lastUpdated).toLocaleDateString()}
              </p>
            </div>
            <div className="flex items-center gap-3 flex-shrink-0">
              <span
                className={`text-xs px-3 py-1 rounded font-semibold ${
                  pack.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                }`}
              >
                {pack.active ? 'ACTIVE' : 'INACTIVE'}
              </span>
              <button className="p-2 hover:bg-gray-700 rounded transition-colors">
                <ToggleRight className="h-5 w-5 text-gray-400 hover:text-white" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
