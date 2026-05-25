'use client';

import type { PresetChain } from '@/lib/api';
import { chainIcons, chainGradients, chainBorderColors } from './chain-constants';

interface ChainCardProps {
    chain: PresetChain;
    isActive: boolean;
    onToggle: () => void;
}

export function ChainCard({ chain, isActive, onToggle }: ChainCardProps) {
    const icon = chainIcons[chain.slug] || '\u26D3\uFE0F';
    const gradient = chainGradients[chain.slug] || 'from-neutral-700/50 to-neutral-800/50';
    const border = chainBorderColors[chain.slug] || 'border-neutral-700/50 hover:border-neutral-600';

    return (
        <button
            onClick={onToggle}
            className={`neon-card p-5 text-left transition-all duration-200 ${border} ${
                isActive ? 'ring-1 ring-violet-500/30' : ''
            }`}
        >
            <div className="flex items-center gap-3 mb-3">
                <div
                    className={`w-10 h-10 rounded-xl bg-gradient-to-br ${gradient} flex items-center justify-center text-xl`}
                >
                    {icon}
                </div>
                <div>
                    <h3 className="text-sm font-bold text-white">{chain.name}</h3>
                    <span className="text-[10px] text-neutral-500 font-medium">
                        {chain.nodeCount} agents
                    </span>
                </div>
            </div>

            <p className="text-xs text-neutral-400 leading-relaxed mb-4">
                {chain.description}
            </p>

            <div className="flex items-center gap-1 flex-wrap">
                {chain.agents.map((agent, i) => (
                    <span key={agent} className="flex items-center gap-1">
                        <code className="text-[10px] px-2 py-0.5 rounded-md bg-white/[0.04] border border-white/[0.06] text-neutral-300 font-mono">
                            {agent}
                        </code>
                        {i < chain.agents.length - 1 && (
                            <span className="text-neutral-600 text-xs">
                                {'\u2192'}
                            </span>
                        )}
                    </span>
                ))}
            </div>
        </button>
    );
}
