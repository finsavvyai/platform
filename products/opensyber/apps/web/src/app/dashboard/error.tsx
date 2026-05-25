'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function DashboardError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[DashboardError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Dashboard Error</h2>
        <p className="text-sm text-text-secondary mb-6">
          {error.message || 'Failed to load dashboard data. Please try again.'}
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-signal px-5 py-2.5 text-sm font-medium text-white hover:bg-signal-hover transition"
          >
            Retry
          </button>
          <a
            href="/dashboard"
            className="rounded-lg border border-wire px-5 py-2.5 text-sm text-text-secondary hover:bg-surface transition"
          >
            Reload Page
          </a>
        </div>
      </div>
    </div>
  );
}
