'use client';

import { useEffect } from 'react';
import { AlertTriangle } from 'lucide-react';

interface ErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function SettingsError({ error, reset }: ErrorProps) {
  useEffect(() => {
    console.error('[SettingsError]', error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] items-center justify-center">
      <div className="max-w-md text-center">
        <AlertTriangle className="mx-auto h-10 w-10 text-amber-500 mb-4" />
        <h2 className="text-xl font-semibold text-white mb-2">Settings Error</h2>
        <p className="text-sm text-text-secondary mb-6">
          {error.message || 'Failed to load settings.'}
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
