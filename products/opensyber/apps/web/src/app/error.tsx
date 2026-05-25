'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';
import { captureError } from '@/lib/error-reporting';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function GlobalError({ error, reset }: ErrorProps) {
  useEffect(() => {
    captureError(error, { boundary: 'global', digest: error.digest ?? '' });
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center px-4">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-alert mb-4" />
        <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
        <p className="text-sm text-text-secondary mb-6">
          We hit an unexpected error. Please try again or contact support if the problem persists.
        </p>
        <button
          onClick={reset}
          className="rounded bg-signal px-5 py-2.5 font-[family-name:var(--font-mono)] text-sm font-bold uppercase tracking-wider text-void hover:bg-signal-hover transition"
        >
          Try Again
        </button>
      </div>
    </div>
  );
}
