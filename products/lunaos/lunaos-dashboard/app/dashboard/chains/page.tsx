'use client';

import Link from 'next/link';
import { useChainsData } from './use-chains-data';
import { ChainCard } from './chain-card';
import { ExecutionPanel } from './execution-panel';
import { ExecutionHistory } from './execution-history';

export default function ChainsPage() {
    const {
        presets,
        history,
        loading,
        executing,
        activeChain,
        context,
        output,
        streamEvents,
        setActiveChain,
        setContext,
        setOutput,
        setStreamEvents,
        handleExecute,
    } = useChainsData();

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="flex flex-col items-center gap-4">
                    <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
                    <p className="text-neutral-400 text-sm">Loading chains...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            <PageHeader />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
                {presets.map(chain => (
                    <ChainCard
                        key={chain.slug}
                        chain={chain}
                        isActive={activeChain === chain.slug}
                        onToggle={() => {
                            setActiveChain(activeChain === chain.slug ? null : chain.slug);
                            setOutput('');
                            setStreamEvents([]);
                        }}
                    />
                ))}
            </div>

            {activeChain && (
                <ExecutionPanel
                    activeChain={activeChain}
                    presets={presets}
                    context={context}
                    executing={executing}
                    streamEvents={streamEvents}
                    output={output}
                    onContextChange={setContext}
                    onExecute={handleExecute}
                    onClose={() => setActiveChain(null)}
                />
            )}

            <ExecutionHistory history={history} />

            <CliBanner presets={presets} />
        </div>
    );
}

function PageHeader() {
    return (
        <div className="page-header flex justify-between items-center mb-6">
            <div>
                <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Agent Chains
                </h1>
                <p>Multi-agent workflows — run agents in sequence, each feeding the next</p>
            </div>
            <Link
                href="/dashboard/chains/builder"
                className="bg-neutral-800 hover:bg-neutral-700 text-white font-medium py-2 px-4 rounded-lg flex items-center gap-2 transition-colors border border-white/10"
            >
                <span className="text-lg">{'\u26A1'}</span> Visual Builder
            </Link>
        </div>
    );
}

function CliBanner({ presets }: { presets: { slug: string }[] }) {
    return (
        <div className="mt-8 neon-card p-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
                <div className="flex-1">
                    <h3 className="text-base font-semibold text-white mb-1">
                        Run chains from terminal
                    </h3>
                    <p className="text-sm text-neutral-400">
                        Execute multi-agent chains from your CLI with a single command.
                        Available presets: {presets.map(p => p.slug).join(', ')}
                    </p>
                </div>
                <code className="px-4 py-2.5 bg-black/40 rounded-xl border border-white/[0.06] text-sm text-violet-400 font-mono whitespace-nowrap">
                    luna chain full-review
                </code>
            </div>
        </div>
    );
}
