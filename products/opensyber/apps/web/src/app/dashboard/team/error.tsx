'use client';

import { AlertOctagon } from 'lucide-react';

export default function TeamError({ reset }: { reset: () => void }) {
  return (
    <div className="flex flex-col items-center gap-4 py-16 text-center">
      <div className="rounded-full bg-red-500/10 p-4">
        <AlertOctagon className="h-8 w-8 text-red-400" />
      </div>
      <div>
        <h3 className="text-lg font-medium">Something went wrong</h3>
        <p className="mt-1 text-sm text-text-secondary">Failed to load team data.</p>
      </div>
      <button
        onClick={reset}
        className="rounded-lg bg-surface px-4 py-2 text-sm text-white hover:bg-neutral-700"
      >
        Try Again
      </button>
    </div>
  );
}
