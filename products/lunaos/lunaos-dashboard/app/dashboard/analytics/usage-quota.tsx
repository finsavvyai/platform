'use client';

import type { Usage } from '@/lib/api';

interface UsageQuotaProps {
    usage: Usage;
}

export function UsageQuota({ usage }: UsageQuotaProps) {
    return (
        <div className="neon-card p-6 mb-8">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-base font-semibold text-white">Your Monthly Quota</h2>
                <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full border capitalize ${
                    usage.tier === 'pro'
                        ? 'text-violet-400 border-violet-500/30 bg-violet-500/5'
                        : usage.tier === 'team'
                          ? 'text-amber-400 border-amber-500/30 bg-amber-500/5'
                          : 'text-neutral-400 border-neutral-700 bg-neutral-800/50'
                }`}>
                    {usage.tier}
                </span>
            </div>
            <div className="flex items-baseline gap-2 mb-2">
                <span className="text-3xl font-bold text-white">
                    {usage.used.toLocaleString()}
                </span>
                <span className="text-neutral-500">
                    / {usage.limit.toLocaleString()}
                </span>
            </div>
            <div className="h-2 bg-neutral-800 rounded-full overflow-hidden">
                <div
                    className={`h-full rounded-full transition-all duration-500 ${
                        usage.percentUsed >= 90
                            ? 'bg-red-500'
                            : usage.percentUsed >= 75
                              ? 'bg-amber-500'
                              : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(usage.percentUsed, 100)}%` }}
                />
            </div>
            <div className="flex justify-between mt-1.5 text-xs text-neutral-500">
                <span>{usage.remaining.toLocaleString()} remaining</span>
                <span>{Math.round(usage.percentUsed)}%</span>
            </div>
        </div>
    );
}
