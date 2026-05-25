'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { billingApi, type Usage } from '@/lib/api';

export default function UsageWidget() {
    const [usage, setUsage] = useState<Usage | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        async function fetchUsage() {
            try {
                const data = await billingApi.usage();
                setUsage(data);
            } catch {
                // Silently fail — widget is non-critical
            } finally {
                setLoading(false);
            }
        }
        fetchUsage();
    }, []);

    if (loading) {
        return (
            <div className="neon-card p-5 animate-pulse">
                <div className="h-4 bg-neutral-800 rounded w-24 mb-3" />
                <div className="h-8 bg-neutral-800 rounded w-32 mb-3" />
                <div className="h-2 bg-neutral-800 rounded w-full" />
            </div>
        );
    }

    if (!usage) return null;

    const pct = Math.min(usage.percentUsed, 100);
    const barColor =
        pct >= 90 ? 'bg-red-500' :
            pct >= 75 ? 'bg-amber-500' :
                'bg-emerald-500';

    const glowColor =
        pct >= 90 ? 'shadow-red-500/20' :
            pct >= 75 ? 'shadow-amber-500/20' :
                'shadow-emerald-500/20';

    return (
        <div className="neon-card p-5">
            <div className="flex items-center justify-between mb-1">
                <h3 className="text-sm font-medium text-neutral-400">Monthly Usage</h3>
                <Link
                    href="/dashboard/billing"
                    className="text-xs text-violet-400 hover:text-violet-300 transition-colors"
                >
                    Details →
                </Link>
            </div>

            {/* Count */}
            <div className="flex items-baseline gap-1.5 mb-3">
                <span className="text-2xl font-bold text-white">{usage.used.toLocaleString()}</span>
                <span className="text-sm text-neutral-500">/ {usage.limit.toLocaleString()} runs</span>
            </div>

            {/* Progress bar */}
            <div className={`h-2 bg-neutral-800 rounded-full overflow-hidden shadow-sm ${glowColor}`}>
                <div
                    className={`h-full rounded-full transition-all duration-700 ease-out ${barColor}`}
                    style={{ width: `${pct}%` }}
                />
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between mt-2">
                <span className="text-xs text-neutral-500">
                    {usage.remaining.toLocaleString()} remaining
                </span>
                <span className={`text-xs font-medium ${pct >= 90 ? 'text-red-400' :
                        pct >= 75 ? 'text-amber-400' :
                            'text-neutral-500'
                    }`}>
                    {pct}%
                </span>
            </div>

            {/* Warning */}
            {pct >= 80 && (
                <div className={`mt-3 px-3 py-2 rounded-lg text-xs ${pct >= 90
                        ? 'bg-red-500/10 border border-red-500/20 text-red-300'
                        : 'bg-amber-500/10 border border-amber-500/20 text-amber-300'
                    }`}>
                    {pct >= 100 ? (
                        <>Monthly limit reached · <Link href="/dashboard/billing" className="underline">Upgrade</Link></>
                    ) : (
                        <>{pct}% used · Approaching limit</>
                    )}
                </div>
            )}
        </div>
    );
}
