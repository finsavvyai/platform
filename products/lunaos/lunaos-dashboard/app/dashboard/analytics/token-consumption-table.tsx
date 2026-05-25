'use client';

import type { ProviderStats } from '@/lib/api';
import { formatDuration, formatTokens } from './analytics-utils';

interface TokenConsumptionTableProps {
    providers: ProviderStats[];
}

export function TokenConsumptionTable({ providers }: TokenConsumptionTableProps) {
    const hasTokenData = providers.some(
        (p) => p.totalInputTokens > 0 || p.totalOutputTokens > 0,
    );

    if (!hasTokenData) return null;

    return (
        <div className="neon-card overflow-hidden">
            <div className="px-6 py-4 border-b border-neutral-800">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>🪙</span> Token Consumption
                </h2>
            </div>
            <table className="w-full">
                <thead>
                    <tr className="border-b border-neutral-800">
                        <th className="text-left text-xs text-neutral-500 font-medium px-6 py-3">Provider</th>
                        <th className="text-left text-xs text-neutral-500 font-medium px-6 py-3">Model</th>
                        <th className="text-right text-xs text-neutral-500 font-medium px-6 py-3">Calls</th>
                        <th className="text-right text-xs text-neutral-500 font-medium px-6 py-3">Input Tokens</th>
                        <th className="text-right text-xs text-neutral-500 font-medium px-6 py-3">Output Tokens</th>
                        <th className="text-right text-xs text-neutral-500 font-medium px-6 py-3">Avg Latency</th>
                    </tr>
                </thead>
                <tbody>
                    {providers.map((p) => (
                        <tr
                            key={`${p.provider}-${p.model}`}
                            className="border-b border-neutral-800/50 hover:bg-neutral-800/30 transition-colors"
                        >
                            <td className="px-6 py-3 text-sm text-white font-medium capitalize">
                                {p.provider}
                            </td>
                            <td className="px-6 py-3">
                                <code className="text-xs text-cyan-400 bg-cyan-500/10 px-2 py-0.5 rounded font-mono">
                                    {p.model}
                                </code>
                            </td>
                            <td className="px-6 py-3 text-sm text-neutral-300 text-right font-mono tabular-nums">
                                {p.totalCalls.toLocaleString()}
                            </td>
                            <td className="px-6 py-3 text-sm text-neutral-300 text-right font-mono tabular-nums">
                                {formatTokens(p.totalInputTokens)}
                            </td>
                            <td className="px-6 py-3 text-sm text-neutral-300 text-right font-mono tabular-nums">
                                {formatTokens(p.totalOutputTokens)}
                            </td>
                            <td className="px-6 py-3 text-sm text-neutral-300 text-right font-mono tabular-nums">
                                {formatDuration(p.avgDurationMs)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
