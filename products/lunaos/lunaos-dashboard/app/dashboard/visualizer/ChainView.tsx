'use client';

import { useState } from 'react';
import type { ReasoningChain } from './types';
import { StepNode } from './StepNode';

/* ------------------------------------------------------------------
   ChainView — renders the full reasoning chain with expandable steps
   ------------------------------------------------------------------ */

export function ChainView({ chain }: { chain: ReasoningChain }) {
    const [expandedStep, setExpandedStep] = useState<string | null>(null);

    const statusBadge =
        chain.status === 'complete' ? 'text-emerald-400 border-emerald-500/30 bg-emerald-500/10' :
            chain.status === 'running' ? 'text-violet-400 border-violet-500/30 bg-violet-500/10' :
                'text-red-400 border-red-500/30 bg-red-500/10';

    return (
        <div>
            {/* Chain header */}
            <div className="neon-card p-5 mb-6">
                <div className="flex items-center justify-between mb-2">
                    <h2 className="text-lg font-bold text-white capitalize">
                        {'\uD83E\uDDE0'} {chain.agentName.replace(/-/g, ' ')}
                    </h2>
                    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border capitalize ${statusBadge}`}>
                        {chain.status}
                    </span>
                </div>
                <div className="flex gap-6 text-xs text-neutral-500">
                    <span>{chain.steps.length} reasoning steps</span>
                    <span>{(chain.totalDurationMs / 1000).toFixed(1)}s total</span>
                    <span>{chain.totalTokens.toLocaleString()} tokens</span>
                    <span>{new Date(chain.startedAt).toLocaleString()}</span>
                </div>
            </div>

            {/* Steps timeline */}
            <div className="pl-2">
                {chain.steps.map((step, i) => (
                    <StepNode
                        key={step.id}
                        step={step}
                        index={i}
                        isLast={i === chain.steps.length - 1}
                        expanded={expandedStep === step.id}
                        onToggle={() =>
                            setExpandedStep(expandedStep === step.id ? null : step.id)
                        }
                    />
                ))}
            </div>
        </div>
    );
}
