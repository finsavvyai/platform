'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import type { Framework, Category, CellData, ControlDetail } from './types';
import { CATEGORIES } from './types';

interface Props {
  framework: Framework;
  cells: Record<Category, CellData>;
}

const STATUS_ICONS = {
  pass: { icon: CheckCircle, color: 'text-green-400' },
  fail: { icon: XCircle, color: 'text-red-400' },
  partial: { icon: AlertTriangle, color: 'text-amber-400' },
} as const;

export function FrameworkRow({ framework, cells }: Props) {
  const [expanded, setExpanded] = useState(false);

  const allControls: (ControlDetail & { category: Category })[] = [];
  for (const cat of CATEGORIES) {
    if (cells[cat].applicable) {
      for (const ctrl of cells[cat].controls) {
        allControls.push({ ...ctrl, category: cat });
      }
    }
  }

  return (
    <>
      <tr
        className="cursor-pointer hover:bg-neutral-800/30 transition"
        onClick={() => setExpanded(!expanded)}
      >
        <td className="p-3 text-sm font-medium whitespace-nowrap">
          <div className="flex items-center gap-2">
            {expanded
              ? <ChevronDown className="h-3.5 w-3.5 text-neutral-500" />
              : <ChevronRight className="h-3.5 w-3.5 text-neutral-500" />}
            {framework}
          </div>
        </td>
      </tr>

      {expanded && (
        <tr>
          <td colSpan={1} className="p-0">
            <div className="border-t border-neutral-800 bg-neutral-950/50 px-6 py-4">
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {allControls.map((ctrl) => {
                  const cfg = STATUS_ICONS[ctrl.status];
                  const Icon = cfg.icon;
                  return (
                    <div key={ctrl.name} className="flex items-center gap-3 text-sm">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                      <span className="text-neutral-300 min-w-0 truncate flex-1">{ctrl.name}</span>
                      <span className="text-xs text-neutral-500 shrink-0">{ctrl.category}</span>
                      <span className="text-xs text-neutral-600 shrink-0">{ctrl.evidenceCount} ev.</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}
