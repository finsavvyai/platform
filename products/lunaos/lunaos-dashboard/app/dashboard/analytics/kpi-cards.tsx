'use client';

import type { OverviewMetrics } from '@/lib/api';
import { formatDuration } from './analytics-utils';

interface KpiCardsProps {
    overview: OverviewMetrics | null;
}

export function KpiCards({ overview }: KpiCardsProps) {
    return (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
            <div className="neon-card p-5">
                <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
                    Total Executions
                </div>
                <div className="text-2xl font-bold text-white">
                    {(overview?.totalExecutions || 0).toLocaleString()}
                </div>
            </div>
            <div className="neon-card p-5">
                <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
                    Avg Latency
                </div>
                <div className="text-2xl font-bold text-white">
                    {formatDuration(overview?.avgDurationMs || 0)}
                </div>
            </div>
            <div className="neon-card p-5">
                <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
                    Error Rate
                </div>
                <div className={`text-2xl font-bold ${
                    (overview?.errorRate || 0) > 5
                        ? 'text-red-400'
                        : (overview?.errorRate || 0) > 2
                          ? 'text-amber-400'
                          : 'text-emerald-400'
                }`}>
                    {(overview?.errorRate || 0).toFixed(1)}%
                </div>
            </div>
            <div className="neon-card p-5">
                <div className="text-xs font-medium text-neutral-500 uppercase tracking-wider mb-1">
                    Active Users
                </div>
                <div className="text-2xl font-bold text-white">
                    {overview?.dailyActiveUsers || 0}
                    <span className="text-sm font-normal text-neutral-500 ml-1">DAU</span>
                </div>
                <div className="text-xs text-neutral-500 mt-0.5">
                    {overview?.weeklyActiveUsers || 0} WAU · {overview?.uniqueUsers || 0} total
                </div>
            </div>
        </div>
    );
}
