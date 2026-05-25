'use client';

import { useEffect } from 'react';

export default function DashboardError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // Dashboard error logged - error is displayed to user
    }, [error]);

    return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
            <div className="glass-card rounded-2xl p-8 max-w-md text-center">
                <div className="w-16 h-16 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor"
                        strokeWidth="2" className="text-red-400">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="8" x2="12" y2="12" />
                        <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                </div>
                <h2 className="text-lg font-semibold text-neutral-100 mb-2">
                    Something went wrong
                </h2>
                <p className="text-sm text-neutral-400 mb-6">
                    {error.message || 'An unexpected error occurred.'}
                </p>
                <button onClick={reset} className="btn btn-primary">
                    Try Again
                </button>
            </div>
        </div>
    );
}
