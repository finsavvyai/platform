'use client';

import { type Usage } from '@/lib/api';

interface UsageSectionProps {
    usage: Usage;
}

export default function UsageSection({ usage }: UsageSectionProps) {
    const usagePercentage = Math.min(usage.percentUsed, 100);
    const usageBarColor = usagePercentage >= 90
        ? 'bg-red-500'
        : usagePercentage >= 75
            ? 'bg-amber-500'
            : 'bg-emerald-500';

    return (
        <div className="neon-card p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Monthly Usage</h2>

            <div className="mb-4">
                <div className="flex justify-between items-end mb-2">
                    <div>
                        <span className="text-3xl font-bold text-white">{usage.used.toLocaleString()}</span>
                        <span className="text-neutral-500 ml-1">/ {usage.limit.toLocaleString()}</span>
                    </div>
                    <span className="text-sm text-neutral-400">{usagePercentage}% used</span>
                </div>

                <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                    <div
                        className={`h-full rounded-full transition-all duration-500 ${usageBarColor}`}
                        style={{ width: `${usagePercentage}%` }}
                    />
                </div>
            </div>

            <div className="grid grid-cols-3 gap-4 text-sm">
                <div>
                    <span className="text-neutral-500">Remaining</span>
                    <p className="text-white font-medium">{usage.remaining.toLocaleString()}</p>
                </div>
                <div>
                    <span className="text-neutral-500">Period Start</span>
                    <p className="text-white">{new Date(usage.period.start).toLocaleDateString()}</p>
                </div>
                <div>
                    <span className="text-neutral-500">Period End</span>
                    <p className="text-white">{new Date(usage.period.end).toLocaleDateString()}</p>
                </div>
            </div>
        </div>
    );
}
