'use client';

import React from 'react';
import type { AgentStats } from '@/lib/api';
import { formatDuration } from './analytics-utils';

interface AgentPerformanceTableProps {
    agents: AgentStats[];
}

export function AgentPerformanceTable({ agents }: AgentPerformanceTableProps) {
    if (agents.length === 0) return null;

    return (
        <div className="neon-card overflow-hidden mb-8">
            <div className="px-6 py-4 border-b border-neutral-800">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>📊</span> Agent Performance
                </h2>
            </div>
            <table className="w-full">
                <thead>
                    <tr className="border-b border-neutral-800">
                        <th className="text-left text-xs text-neutral-500 font-medium px-6 py-3">Agent</th>
                        <th className="text-right text-xs text-neutral-500 font-medium px-6 py-3">Runs</th>
                        <th className="text-right text-xs text-neutral-500 font-medium px-6 py-3">Avg Duration</th>
                        <th className="text-right text-xs text-neutral-500 font-medium px-6 py-3">Error Rate</th>
                        <th className="text-right text-xs text-neutral-500 font-medium px-6 py-3">Last Used</th>
                    </tr>
                </thead>
                <tbody>
                    {agents.map((a) => (
                        <React.Fragment key={a.agent}>
                            <tr className={`border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors ${
                                a.variants && a.variants.length > 0 ? 'bg-neutral-900/40' : ''
                            }`}>
                                <td className="px-6 py-3 text-sm text-white font-medium capitalize">
                                    {a.agent.replace(/-/g, ' ')}
                                    {a.variants && a.variants.length > 0 && (
                                        <span className="ml-2 text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-400 font-mono">
                                            A/B Test Active
                                        </span>
                                    )}
                                </td>
                                <td className="px-6 py-3 text-sm text-neutral-300 text-right font-mono tabular-nums">
                                    {a.totalExecutions.toLocaleString()}
                                </td>
                                <td className="px-6 py-3 text-sm text-neutral-300 text-right font-mono tabular-nums">
                                    {formatDuration(a.avgDurationMs)}
                                </td>
                                <td className="px-6 py-3 text-right">
                                    <span className={`text-sm font-mono tabular-nums ${
                                        a.errorRate > 5
                                            ? 'text-red-400'
                                            : a.errorRate > 2
                                              ? 'text-amber-400'
                                              : 'text-emerald-400'
                                    }`}>
                                        {a.errorRate.toFixed(1)}%
                                    </span>
                                </td>
                                <td className="px-6 py-3 text-sm text-neutral-500 text-right">
                                    {a.lastUsed ? new Date(a.lastUsed).toLocaleDateString() : '--'}
                                </td>
                            </tr>
                            {a.variants && a.variants.length > 0 && a.variants.map((v) => (
                                <tr
                                    key={`${a.agent}-${v.variantId}`}
                                    className="border-b border-neutral-800/50 bg-neutral-900/20 hover:bg-neutral-800/40 transition-colors"
                                >
                                    <td className="px-6 py-2 pl-10 text-xs text-neutral-400 font-mono">
                                        ↳ Variant: {v.variantId}
                                    </td>
                                    <td className="px-6 py-2 text-xs text-neutral-400 text-right font-mono tabular-nums">
                                        {v.totalExecutions.toLocaleString()}
                                    </td>
                                    <td className="px-6 py-2 text-xs text-neutral-400 text-right font-mono tabular-nums">
                                        {formatDuration(v.avgDurationMs)}
                                    </td>
                                    <td className="px-6 py-2 text-right">
                                        <span className={`text-xs font-mono tabular-nums ${
                                            v.errorRate > 5
                                                ? 'text-red-500'
                                                : v.errorRate > 2
                                                  ? 'text-amber-500'
                                                  : 'text-emerald-500'
                                        }`}>
                                            {v.errorRate.toFixed(1)}%
                                        </span>
                                    </td>
                                    <td className="px-6 py-2"></td>
                                </tr>
                            ))}
                        </React.Fragment>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
