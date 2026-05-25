'use client';

import { Trash2 } from 'lucide-react';

interface CustomRule {
  id: string;
  name: string;
  conditions: string[];
  actions: string[];
  active: boolean;
}

interface CustomRulesListProps {
  rules: CustomRule[];
}

export function CustomRulesList({ rules }: CustomRulesListProps) {
  return (
    <div className="space-y-3">
      {rules.length > 0 ? (
        rules.map((rule) => (
          <div
            key={rule.id}
            className="bg-gray-800/50 border border-gray-700 rounded-lg p-4 space-y-3"
          >
            <div className="flex items-start justify-between">
              <h3 className="font-semibold text-white">{rule.name}</h3>
              <span
                className={`text-xs px-3 py-1 rounded font-semibold ${
                  rule.active ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'
                }`}
              >
                {rule.active ? 'ACTIVE' : 'INACTIVE'}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2">Conditions</p>
                <div className="space-y-1">
                  {rule.conditions.map((cond, idx) => (
                    <div
                      key={idx}
                      className="text-sm px-2 py-1 bg-signal/10 text-info rounded border border-info/30"
                    >
                      {cond}
                    </div>
                  ))}
                </div>
              </div>

              <div>
                <p className="text-xs text-gray-400 font-semibold mb-2">Actions</p>
                <div className="space-y-1">
                  {rule.actions.map((action, idx) => (
                    <div
                      key={idx}
                      className="text-sm px-2 py-1 bg-orange-500/10 text-orange-300 rounded border border-orange-500/30"
                    >
                      {action}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex gap-2 justify-end pt-2 border-t border-gray-700">
              <button className="px-3 py-1 text-sm text-gray-400 hover:text-white hover:bg-gray-700 rounded transition-colors">
                Edit
              </button>
              <button className="p-1.5 text-gray-400 hover:text-red-400 hover:bg-red-500/10 rounded transition-colors">
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          </div>
        ))
      ) : (
        <p className="text-gray-400 text-center py-8">No custom rules created yet</p>
      )}
    </div>
  );
}
