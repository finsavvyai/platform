'use client';

import React from 'react';

const Pulse = ({ className }: { className?: string }) => (
    <div className={`animate-pulse rounded-md bg-white/10 ${className || ''}`} />
);

/** Skeleton for the main dashboard overview page */
export function DashboardSkeleton() {
    return (
        <div className="space-y-6 p-6">
            {/* Stat cards row */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                    <div key={i} className="glass-card rounded-xl p-5 space-y-3">
                        <Pulse className="h-4 w-24" />
                        <Pulse className="h-8 w-16" />
                        <Pulse className="h-3 w-32" />
                    </div>
                ))}
            </div>
            {/* Chart area */}
            <div className="glass-card rounded-xl p-6">
                <Pulse className="h-5 w-40 mb-4" />
                <Pulse className="h-48 w-full" />
            </div>
            {/* Recent executions */}
            <div className="glass-card rounded-xl p-6 space-y-4">
                <Pulse className="h-5 w-48" />
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-4">
                        <Pulse className="h-10 w-10 rounded-full" />
                        <div className="flex-1 space-y-2">
                            <Pulse className="h-4 w-3/4" />
                            <Pulse className="h-3 w-1/2" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Skeleton for the agent catalog grid */
export function AgentGridSkeleton() {
    return (
        <div className="p-6 space-y-6">
            <Pulse className="h-7 w-32" />
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {Array.from({ length: 6 }).map((_, i) => (
                    <div key={i} className="glass-card rounded-xl p-5 space-y-3">
                        <div className="flex items-center gap-3">
                            <Pulse className="h-10 w-10 rounded-lg" />
                            <Pulse className="h-5 w-32" />
                        </div>
                        <Pulse className="h-3 w-full" />
                        <Pulse className="h-3 w-2/3" />
                        <div className="flex gap-2 pt-2">
                            <Pulse className="h-6 w-16 rounded-full" />
                            <Pulse className="h-6 w-16 rounded-full" />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

/** Skeleton for execution history list */
export function HistorySkeleton() {
    return (
        <div className="p-6 space-y-4">
            <Pulse className="h-7 w-40" />
            {Array.from({ length: 5 }).map((_, i) => (
                <div key={i} className="glass-card rounded-xl p-4 flex items-center gap-4">
                    <Pulse className="h-8 w-8 rounded-full" />
                    <div className="flex-1 space-y-2">
                        <Pulse className="h-4 w-48" />
                        <Pulse className="h-3 w-24" />
                    </div>
                    <Pulse className="h-6 w-20 rounded-full" />
                </div>
            ))}
        </div>
    );
}

/** Skeleton for settings/billing pages */
export function FormSkeleton() {
    return (
        <div className="p-6 space-y-6 max-w-2xl">
            <Pulse className="h-7 w-32" />
            <div className="glass-card rounded-xl p-6 space-y-5">
                {Array.from({ length: 3 }).map((_, i) => (
                    <div key={i} className="space-y-2">
                        <Pulse className="h-4 w-20" />
                        <Pulse className="h-10 w-full rounded-lg" />
                    </div>
                ))}
                <Pulse className="h-10 w-32 rounded-lg" />
            </div>
        </div>
    );
}
