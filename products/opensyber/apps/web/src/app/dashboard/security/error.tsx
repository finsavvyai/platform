'use client';

import { useEffect } from 'react';
import { ShieldAlert } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SecurityError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[SecurityError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md text-center">
        <ShieldAlert className="mx-auto h-10 w-10 text-red-500 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Security Dashboard Error</h2>
        <p className="text-sm text-text-secondary mb-6">
          {error.message || 'Failed to load security data.'}
        </p>
        <button
          onClick={reset}
          className="rounded-lg bg-signal px-5 py-2.5 text-sm font-medium text-white hover:bg-signal-hover transition"
        >
          Retry
        </button>
      </div>
    </div>
  );
}
