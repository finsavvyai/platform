'use client';

import { useState } from 'react';
import { Play, Loader2 } from 'lucide-react';

interface RunPlaybookButtonProps {
  playbookId: string;
}

export function RunPlaybookButton({ playbookId }: RunPlaybookButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleRun(): Promise<void> {
    setRunning(true);
    setError(null);
    try {
      const res = await fetch('/api/proxy/remediation/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ playbookId }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({ message: 'Failed' }));
        throw new Error((body as { message: string }).message);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to run playbook');
      setRunning(false);
      setConfirming(false);
    }
  }

  if (error) {
    return (
      <div className="text-sm text-red-400 bg-red-500/10 rounded-lg px-3 py-2">
        {error}
        <button onClick={() => setError(null)} className="ml-2 underline text-xs">
          Dismiss
        </button>
      </div>
    );
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-sm text-neutral-400">Run this playbook?</span>
        <button onClick={handleRun} disabled={running}
          className="bg-info hover:bg-info disabled:opacity-50 text-white rounded-lg px-3 py-1.5 text-sm font-medium transition inline-flex items-center gap-1.5">
          {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
          {running ? 'Running...' : 'Confirm'}
        </button>
        <button onClick={() => setConfirming(false)} disabled={running}
          className="px-3 py-1.5 text-sm rounded-lg border border-neutral-700 text-neutral-300 hover:text-white transition">
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button onClick={() => setConfirming(true)}
      className="inline-flex items-center gap-2 bg-info hover:bg-info text-white rounded-lg px-4 py-2 text-sm font-medium transition">
      <Play className="h-4 w-4" />
      Run Playbook
    </button>
  );
}
