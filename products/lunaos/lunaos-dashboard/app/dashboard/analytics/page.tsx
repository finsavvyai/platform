'use client';

import type { TimeRange } from './analytics-utils';
import { useAnalyticsData } from './use-analytics-data';
import { BarRow } from './bar-row';
import { KpiCards } from './kpi-cards';
import { UsageQuota } from './usage-quota';
import { AgentPerformanceTable } from './agent-performance-table';
import { TokenConsumptionTable } from './token-consumption-table';

export default function AnalyticsPage() {
    const {
        overview,
        agents,
        providers,
        usage,
        range,
        setRange,
        loading,
    } = useAnalyticsData();

    const maxAgentExec = agents.length > 0 ? agents[0].totalExecutions : 1;
    const maxProviderCalls = providers.length > 0 ? providers[0].totalCalls : 1;

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-6xl mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between mb-8">
                <div className="page-header mb-0">
                    <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                        Analytics
                    </h1>
                    <p>Agent usage and performance metrics</p>
                </div>

                {/* Time Range Picker */}
                <div className="flex gap-1 bg-neutral-900/80 rounded-xl p-1 border border-neutral-800">
                    {(['24h', '7d', '30d'] as TimeRange[]).map((r) => (
                        <button
                            key={r}
                            onClick={() => setRange(r)}
                            className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                                range === r
                                    ? 'bg-violet-500/20 text-violet-300 border border-violet-500/30'
                                    : 'text-neutral-500 hover:text-neutral-300'
                            }`}
                        >
                            {r}
                        </button>
                    ))}
                </div>
            </div>

            <KpiCards overview={overview} />

            {usage && <UsageQuota usage={usage} />}

            {/* Two-Column Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                {/* Agent Popularity */}
                <div className="neon-card p-6">
                    <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                        <span>🤖</span> Agent Popularity
                    </h2>
                    {agents.length === 0 ? (
                        <p className="text-neutral-500 text-sm py-8 text-center">No execution data yet</p>
                    ) : (
                        <div className="space-y-0.5">
                            {agents.slice(0, 10).map((a) => (
                                <BarRow
                                    key={a.agent}
                                    label={a.agent.replace(/-/g, ' ')}
                                    value={a.totalExecutions}
                                    maxValue={maxAgentExec}
                                    color="bg-violet-500"
                                />
                            ))}
                        </div>
                    )}
                </div>

                {/* Provider & Model Usage */}
                <div className="neon-card p-6">
                    <h2 className="text-base font-semibold text-white mb-4 flex items-center gap-2">
                        <span>⚡</span> Provider & Model Usage
                    </h2>
                    {providers.length === 0 ? (
                        <p className="text-neutral-500 text-sm py-8 text-center">No provider data yet</p>
                    ) : (
                        <div className="space-y-0.5">
                            {providers.slice(0, 8).map((p) => (
                                <BarRow
                                    key={`${p.provider}-${p.model}`}
                                    label={`${p.provider} / ${p.model}`}
                                    value={p.totalCalls}
                                    maxValue={maxProviderCalls}
                                    color="bg-cyan-500"
                                />
                            ))}
                        </div>
                    )}
                </div>
            </div>

            <AgentPerformanceTable agents={agents} />

            <TokenConsumptionTable providers={providers} />
        </div>
    );
}
