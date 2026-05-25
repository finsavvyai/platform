'use client';

import { useEffect, useState } from 'react';
import { agentsApi, type Execution } from '../../../lib/api';

export default function HistoryPage() {
    const [executions, setExecutions] = useState<Execution[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchHistory() {
            try {
                const data = await agentsApi.executions();
                setExecutions(data.executions || []);
            } catch (err) {
                // Error loading history - will display empty state
            } finally {
                setLoading(false);
            }
        }
        fetchHistory();
    }, []);

    if (loading) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="w-8 h-8 border-2 border-violet-500 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto">
            <div className="page-header">
                <h1 className="bg-gradient-to-r from-white to-neutral-400 bg-clip-text text-transparent">
                    Execution History
                </h1>
                <p>All your agent runs in one place</p>
            </div>

            {executions.length === 0 ? (
                <div className="neon-card p-12 text-center">
                    <div className="text-4xl mb-4">🐱</div>
                    <p className="text-neutral-400 text-lg">No executions yet</p>
                    <p className="text-neutral-600 text-sm mt-2">
                        Luna is waiting for you to run your first agent
                    </p>
                </div>
            ) : (
                <div className="neon-card overflow-hidden">
                    {/* Table Header */}
                    <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/[0.06] text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        <div className="col-span-3">Agent</div>
                        <div className="col-span-2">Provider</div>
                        <div className="col-span-2">Model</div>
                        <div className="col-span-2">Duration</div>
                        <div className="col-span-3">Date</div>
                    </div>

                    {/* Rows */}
                    {executions.map((exec) => (
                        <div
                            key={exec.id}
                            className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center"
                        >
                            <div className="col-span-3 flex items-center gap-2">
                                <span className="text-sm">🤖</span>
                                <span className="text-sm font-medium text-neutral-200">{exec.agent}</span>
                            </div>
                            <div className="col-span-2 text-sm text-neutral-400">{exec.provider}</div>
                            <div className="col-span-2">
                                <code className="text-xs text-neutral-500 bg-neutral-800/50 px-2 py-0.5 rounded">
                                    {exec.model}
                                </code>
                            </div>
                            <div className="col-span-2 text-sm text-neutral-400">
                                {exec.duration_ms ? `${(exec.duration_ms / 1000).toFixed(1)}s` : '--'}
                            </div>
                            <div className="col-span-3 text-sm text-neutral-500">
                                {new Date(exec.created_at).toLocaleString()}
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
