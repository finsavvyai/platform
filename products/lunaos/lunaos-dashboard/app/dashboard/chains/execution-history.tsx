'use client';

import type { ChainExecution } from '@/lib/api';
import { chainIcons, statusColors } from './chain-constants';

interface ExecutionHistoryProps {
    history: ChainExecution[];
}

export function ExecutionHistory({ history }: ExecutionHistoryProps) {
    return (
        <div className="neon-card overflow-hidden">
            <div className="px-6 py-4 border-b border-white/[0.06]">
                <h2 className="text-base font-semibold text-white flex items-center gap-2">
                    <span>{'\uD83D\uDCCB'}</span> Chain Execution History
                </h2>
            </div>

            {history.length === 0 ? (
                <EmptyState />
            ) : (
                <HistoryTable history={history} />
            )}
        </div>
    );
}

function EmptyState() {
    return (
        <div className="text-center py-12">
            <div className="text-4xl mb-4">{'\u26D3\uFE0F'}</div>
            <p className="text-neutral-400">No chain executions yet</p>
            <p className="text-neutral-600 text-sm mt-1">
                Select a chain above and run it to see execution history
            </p>
        </div>
    );
}

function HistoryTable({ history }: { history: ChainExecution[] }) {
    return (
        <>
            <div className="grid grid-cols-12 gap-4 px-6 py-3 border-b border-white/[0.06] text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                <div className="col-span-4">Chain</div>
                <div className="col-span-2">Status</div>
                <div className="col-span-2">Duration</div>
                <div className="col-span-4">Date</div>
            </div>

            {history.map((exec) => (
                <HistoryRow key={exec.id} execution={exec} />
            ))}
        </>
    );
}

function HistoryRow({ execution }: { execution: ChainExecution }) {
    const status = statusColors[execution.status] || statusColors.completed;
    const slug = execution.chain_name?.toLowerCase().replace(/\s+/g, '-');
    const icon = chainIcons[slug] || '\u26D3\uFE0F';
    const duration = execution.duration_ms
        ? `${(execution.duration_ms / 1000).toFixed(1)}s`
        : '--';

    return (
        <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-white/[0.03] hover:bg-white/[0.02] transition-colors items-center">
            <div className="col-span-4 flex items-center gap-2">
                <span className="text-sm">{icon}</span>
                <span className="text-sm font-medium text-neutral-200">
                    {execution.chain_name}
                </span>
            </div>
            <div className="col-span-2">
                <span
                    className={`inline-flex items-center gap-1.5 text-xs px-2 py-0.5 rounded-full ${status.bg} ${status.text}`}
                >
                    <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />
                    {execution.status}
                </span>
            </div>
            <div className="col-span-2 text-sm text-neutral-400">{duration}</div>
            <div className="col-span-4 text-sm text-neutral-500">
                {new Date(execution.created_at).toLocaleString()}
            </div>
        </div>
    );
}
