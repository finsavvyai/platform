'use client';

import { useState } from 'react';
import { CheckCircle, XCircle, Loader2 } from 'lucide-react';

interface InsightActionsProps {
  id: string;
  currentStatus: string;
}

export function InsightActions({ id, currentStatus }: InsightActionsProps) {
  const [status, setStatus] = useState(currentStatus);
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(newStatus: 'reviewed' | 'dismissed') {
    setLoading(newStatus);
    try {
      const res = await fetch(`/api/proxy/ai/insights/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        setStatus(newStatus);
      }
    } catch {
      // Failed silently
    } finally {
      setLoading(null);
    }
  }

  if (status !== 'new') {
    const colors = status === 'reviewed'
      ? 'bg-green-500/10 text-green-400'
      : 'bg-neutral-800 text-neutral-400';
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        onClick={() => updateStatus('reviewed')}
        disabled={loading !== null}
        className="flex items-center gap-1 rounded-lg border border-green-500/20 bg-green-500/5 px-2.5 py-1 text-xs text-green-400 hover:bg-green-500/10 disabled:opacity-50 transition"
      >
        {loading === 'reviewed' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
        Review
      </button>
      <button
        type="button"
        onClick={() => updateStatus('dismissed')}
        disabled={loading !== null}
        className="flex items-center gap-1 rounded-lg border border-neutral-700 bg-neutral-800/50 px-2.5 py-1 text-xs text-neutral-400 hover:bg-neutral-800 disabled:opacity-50 transition"
      >
        {loading === 'dismissed' ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
        Dismiss
      </button>
    </div>
  );
}
