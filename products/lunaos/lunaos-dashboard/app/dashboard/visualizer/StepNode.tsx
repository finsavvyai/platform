'use client';

import type { ThinkingStep } from './types';

/* ------------------------------------------------------------------
   StepNode — a single step in the reasoning chain timeline
   ------------------------------------------------------------------ */

interface StepNodeProps {
    step: ThinkingStep;
    index: number;
    isLast: boolean;
    expanded: boolean;
    onToggle: () => void;
}

export function StepNode({ step, index, isLast, expanded, onToggle }: StepNodeProps) {
    const statusColor =
        step.status === 'done' ? 'bg-emerald-500' :
            step.status === 'active' ? 'bg-violet-500 animate-pulse' :
                'bg-neutral-600';

    const statusGlow =
        step.status === 'done' ? 'shadow-emerald-500/30' :
            step.status === 'active' ? 'shadow-violet-500/40' :
                '';

    return (
        <div className="flex gap-4 animate-fade-in-up" style={{ animationDelay: `${index * 80}ms` }}>
            {/* Timeline connector */}
            <div className="flex flex-col items-center w-6 shrink-0">
                <div className={`w-3 h-3 rounded-full ${statusColor} shadow-lg ${statusGlow} mt-1.5`} />
                {!isLast && (
                    <div className="w-px flex-1 bg-gradient-to-b from-neutral-600 to-neutral-800 mt-1" />
                )}
            </div>

            {/* Step content */}
            <div
                className={`flex-1 mb-4 neon-card p-4 cursor-pointer transition-all ${expanded ? 'border-violet-500/30' : 'hover:border-neutral-700'
                    }`}
                onClick={onToggle}
            >
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-600 font-mono w-6">
                            {String(index + 1).padStart(2, '0')}
                        </span>
                        <span className="text-sm font-medium text-white">{step.label}</span>
                    </div>
                    <div className="flex items-center gap-3 text-xs text-neutral-500 font-mono tabular-nums">
                        {step.durationMs != null && <span>{step.durationMs}ms</span>}
                        {step.tokens != null && <span>{step.tokens} tok</span>}
                        <span className="text-neutral-600">{expanded ? '\u25B2' : '\u25BC'}</span>
                    </div>
                </div>
                {expanded && (
                    <div className="mt-3 pt-3 border-t border-neutral-800 text-sm text-neutral-400 leading-relaxed">
                        {step.detail}
                    </div>
                )}
            </div>
        </div>
    );
}
