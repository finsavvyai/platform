'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { agentsApi, type Agent, type Execution } from '@/lib/api';
import type { ExtendedExecution, ReasoningChain } from './types';
import { buildChain } from './build-chain';
import { ChainView } from './ChainView';

/* ------------------------------------------------------------------
   Main Visualizer Page
   ------------------------------------------------------------------ */

export default function VisualizerPage() {
    const [agents, setAgents] = useState<Agent[]>([]);
    const [executions, setExecutions] = useState<ExtendedExecution[]>([]);
    const [selectedExec, setSelectedExec] = useState<ExtendedExecution | null>(null);
    const [chain, setChain] = useState<ReasoningChain | null>(null);
    const [loading, setLoading] = useState(true);
    const sidebarRef = useRef<HTMLDivElement>(null);

    const selectExecution = useCallback((exec: ExtendedExecution, agentList: Agent[]) => {
        setSelectedExec(exec);
        const agent = agentList.find(a => a.slug === exec.agent) || {
            slug: exec.agent,
            name: exec.agent,
            description: '',
            category: '',
            tier: 'free' as const,
            hasSystemPrompt: false,
        };
        setChain(buildChain(exec, agent));
    }, []);

    useEffect(() => {
        async function load() {
            try {
                const [agResult, execResult] = await Promise.all([
                    agentsApi.list().catch(() => ({ agents: [] as Agent[], total: 0, free: 0, pro: 0 })),
                    agentsApi.executions().catch(() => ({ executions: [] as Execution[], count: 0 })),
                ]);
                const ag = agResult.agents || [];
                const exec = (execResult.executions || []) as ExtendedExecution[];
                setAgents(ag);
                setExecutions(exec);

                if (exec.length > 0) {
                    selectExecution(exec[0], ag);
                }
            } catch {
                // best effort
            } finally {
                setLoading(false);
            }
        }
        load();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto">
            <div className="page-header mb-6">
                <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Agent Visualizer
                </h1>
                <p>Explore agent reasoning chains step-by-step</p>
            </div>

            {executions.length === 0 ? (
                <EmptyState />
            ) : (
                <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
                    <ExecutionSidebar
                        sidebarRef={sidebarRef}
                        executions={executions}
                        agents={agents}
                        selectedExec={selectedExec}
                        onSelect={selectExecution}
                    />
                    <div className="lg:col-span-3">
                        {chain ? (
                            <ChainView chain={chain} />
                        ) : (
                            <div className="neon-card p-12 text-center">
                                <p className="text-neutral-500">Select an execution to visualize</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

/* ------------------------------------------------------------------
   Sub-components kept in page.tsx for layout-level concerns
   ------------------------------------------------------------------ */

function EmptyState() {
    return (
        <div className="neon-card p-12 text-center">
            <div className="text-4xl mb-4">{'\uD83E\uDDE0'}</div>
            <p className="text-neutral-400 text-lg mb-2">No executions yet</p>
            <p className="text-neutral-600 text-sm">
                Run an agent from the Agents page or CLI, then come back to visualize the reasoning chain.
            </p>
        </div>
    );
}

function ExecutionSidebar({
    sidebarRef,
    executions,
    agents,
    selectedExec,
    onSelect,
}: {
    sidebarRef: React.RefObject<HTMLDivElement>;
    executions: ExtendedExecution[];
    agents: Agent[];
    selectedExec: ExtendedExecution | null;
    onSelect: (exec: ExtendedExecution, agents: Agent[]) => void;
}) {
    return (
        <div
            ref={sidebarRef}
            className="lg:col-span-1 space-y-2 max-h-[calc(100vh-12rem)] overflow-y-auto pr-1"
        >
            <div className="text-xs text-neutral-500 font-medium uppercase tracking-wider mb-2 px-1">
                Recent Executions ({executions.length})
            </div>
            {executions.slice(0, 50).map((exec) => {
                const isActive = selectedExec?.id === exec.id;
                const agent = agents.find(a => a.slug === exec.agent);
                return (
                    <button
                        key={exec.id}
                        onClick={() => onSelect(exec, agents)}
                        className={`w-full text-left p-3 rounded-xl border transition-all ${isActive
                                ? 'bg-violet-500/10 border-violet-500/30'
                                : 'bg-neutral-900/80 border-neutral-800 hover:border-neutral-700'
                            }`}
                    >
                        <div className="text-sm font-medium text-white capitalize truncate">
                            {(agent?.name || exec.agent).replace(/-/g, ' ')}
                        </div>
                        <div className="flex items-center justify-between mt-1">
                            <span className="text-xs text-neutral-500">
                                {exec.created_at
                                    ? new Date(exec.created_at).toLocaleDateString()
                                    : '--'}
                            </span>
                            <span className={`text-xs font-medium ${exec.status === 'completed' || !exec.status ? 'text-emerald-400' :
                                    exec.status === 'error' ? 'text-red-400' :
                                        'text-amber-400'
                                }`}>
                                {exec.status || 'completed'}
                            </span>
                        </div>
                    </button>
                );
            })}
        </div>
    );
}
