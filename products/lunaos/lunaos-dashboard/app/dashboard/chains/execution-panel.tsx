'use client';

import type { PresetChain } from '@/lib/api';
import { chainIcons } from './chain-constants';
import type { StreamEvent } from './use-chains-data';

interface ExecutionPanelProps {
    activeChain: string;
    presets: PresetChain[];
    context: string;
    executing: string | null;
    streamEvents: StreamEvent[];
    output: string;
    onContextChange: (value: string) => void;
    onExecute: (slug: string) => void;
    onClose: () => void;
}

export function ExecutionPanel({
    activeChain,
    presets,
    context,
    executing,
    streamEvents,
    output,
    onContextChange,
    onExecute,
    onClose,
}: ExecutionPanelProps) {
    const preset = presets.find(p => p.slug === activeChain);

    return (
        <div className="neon-card p-6 mb-8">
            <PanelHeader
                activeChain={activeChain}
                chainName={preset?.name || activeChain}
                onClose={onClose}
            />

            <textarea
                value={context}
                onChange={(e) => onContextChange(e.target.value)}
                placeholder="Paste your code, describe your feature, or provide context here..."
                rows={8}
                className="w-full px-4 py-3 bg-neutral-900/80 border border-neutral-800 rounded-xl text-neutral-200 placeholder-neutral-500 focus:outline-none focus:ring-2 focus:ring-violet-500/30 focus:border-violet-500/50 transition-all text-sm font-mono resize-y mb-4"
            />

            <div className="flex items-center justify-between">
                <p className="text-xs text-neutral-600">
                    {context.length} chars &middot; {preset?.nodeCount || 0} agents will execute sequentially
                </p>
                <button
                    onClick={() => onExecute(activeChain)}
                    disabled={!!executing || !context.trim()}
                    className="btn btn-primary text-sm px-6 inline-flex items-center gap-2"
                >
                    {executing ? (
                        <>
                            <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                            Running chain...
                        </>
                    ) : (
                        '\u25B6 Execute Chain'
                    )}
                </button>
            </div>

            <StreamEventBadges events={streamEvents} />
            <ChainOutput output={output} />
        </div>
    );
}

function PanelHeader({
    activeChain,
    chainName,
    onClose,
}: {
    activeChain: string;
    chainName: string;
    onClose: () => void;
}) {
    return (
        <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
                <span className="text-2xl">{chainIcons[activeChain] || '\u26D3\uFE0F'}</span>
                <div>
                    <h2 className="text-lg font-bold text-white">Run {chainName}</h2>
                    <p className="text-xs text-neutral-500">
                        Paste your code, describe your feature, or provide context below
                    </p>
                </div>
            </div>
            <button
                onClick={onClose}
                className="text-neutral-500 hover:text-neutral-300 transition-colors"
            >
                {'\u2715'}
            </button>
        </div>
    );
}

function StreamEventBadges({ events }: { events: StreamEvent[] }) {
    if (events.length === 0) return null;

    const filteredEvents = events.filter(e => {
        try {
            return JSON.parse(e.data).event;
        } catch {
            return false;
        }
    });

    return (
        <div className="mt-4 flex items-center gap-2 flex-wrap">
            {filteredEvents.map((e, i) => {
                let parsed;
                try {
                    parsed = JSON.parse(e.data);
                } catch {
                    return null;
                }
                const isActive = parsed.event === 'node_start';
                const isComplete = parsed.event === 'node_complete';
                const badgeClass = isActive
                    ? 'bg-violet-500/10 text-violet-300 border border-violet-500/20'
                    : isComplete
                        ? 'bg-emerald-500/10 text-emerald-300 border border-emerald-500/20'
                        : 'bg-neutral-800/50 text-neutral-400 border border-neutral-700/50';
                return (
                    <div
                        key={i}
                        className={`flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-lg ${badgeClass}`}
                    >
                        {isActive && (
                            <div className="w-2 h-2 border border-violet-300/50 border-t-violet-300 rounded-full animate-spin" />
                        )}
                        {isComplete && <span>{'\u2713'}</span>}
                        {parsed.label || parsed.nodeId || parsed.event}
                    </div>
                );
            })}
        </div>
    );
}

function ChainOutput({ output }: { output: string }) {
    if (!output) return null;

    async function handleCopy() {
        await navigator.clipboard.writeText(output);
    }

    return (
        <div className="mt-4 p-4 bg-neutral-900/80 rounded-xl border border-neutral-800 max-h-96 overflow-y-auto">
            <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
                    Chain Output
                </span>
                <button
                    onClick={handleCopy}
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                    Copy
                </button>
            </div>
            <div className="text-sm text-neutral-200 whitespace-pre-wrap font-mono leading-relaxed">
                {output}
            </div>
        </div>
    );
}
