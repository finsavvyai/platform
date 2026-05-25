'use client';

import { ArrowRight } from 'lucide-react';
import type { Workflow } from './types';

const STATUS_STYLES: Record<string, string> = {
  active: 'bg-green-500/20 text-green-400',
  inactive: 'bg-neutral-500/20 text-neutral-400',
  draft: 'bg-amber-500/20 text-amber-400',
};

const STEP_TYPE_COLORS: Record<string, string> = {
  condition: 'border-purple-500/40 bg-purple-500/10 text-purple-400',
  action: 'border-info/40 bg-info/10 text-info',
  notification: 'border-amber-500/40 bg-amber-500/10 text-amber-400',
  enrichment: 'border-green-500/40 bg-green-500/10 text-green-400',
};

interface Props {
  workflow: Workflow;
  onToggle: (id: string) => void;
  onRun: (id: string) => void;
  onEdit: (id: string) => void;
}

export function WorkflowCard({ workflow: w, onToggle, onRun, onEdit }: Props): React.ReactElement {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/30 p-6 space-y-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <h3 className="text-lg font-medium truncate">{w.name}</h3>
            <span className={`px-2 py-0.5 rounded-full text-xs ${STATUS_STYLES[w.status]}`}>
              {w.status}
            </span>
            <span className="px-2 py-0.5 rounded-full text-xs bg-info/20 text-info">
              {w.trigger}
            </span>
          </div>
          <p className="mt-1 text-sm text-neutral-400">{w.description}</p>
        </div>
        <div className="flex gap-1 shrink-0">
          <button onClick={() => onToggle(w.id)} className="rounded px-2 py-1 text-xs text-neutral-400 hover:bg-neutral-700/50 transition">
            {w.status === 'active' ? 'Disable' : 'Enable'}
          </button>
          <button onClick={() => onRun(w.id)} className="rounded px-2 py-1 text-xs text-green-400 hover:bg-green-500/10 transition">
            Run Now
          </button>
          <button onClick={() => onEdit(w.id)} className="rounded px-2 py-1 text-xs text-info hover:bg-info/10 transition">
            Edit
          </button>
        </div>
      </div>

      {/* Meta badges */}
      <div className="flex gap-4 text-xs text-neutral-500">
        <span>{w.steps.length} steps</span>
        <span>{w.runCount} runs</span>
        <span>avg {w.avgDuration}</span>
        <span>
          {w.lastRun
            ? `Last run ${new Date(w.lastRun).toLocaleDateString()}`
            : 'Never run'}
        </span>
      </div>

      {/* Visual Step Flow */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1" data-testid="step-flow">
        {w.steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-1 shrink-0">
            {i > 0 && <ArrowRight className="h-3 w-3 text-neutral-600 shrink-0" />}
            <div
              className={`rounded-lg border px-3 py-1.5 text-xs flex items-center gap-1.5 ${STEP_TYPE_COLORS[step.type]}`}
            >
              <span className="font-medium">{step.name}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
