'use client';

import { useState } from 'react';
import { CheckCircle, SkipForward, Loader2 } from 'lucide-react';

interface RecommendationActionsProps {
  id: string;
}

export function RecommendationActions({ id }: RecommendationActionsProps) {
  const [status, setStatus] = useState<'pending' | 'applied' | 'skipped'>('pending');
  const [loading, setLoading] = useState<string | null>(null);

  async function updateStatus(newStatus: 'applied' | 'skipped') {
    setLoading(newStatus);
    try {
      const res = await fetch(`/api/proxy/ai/recommendations/${id}`, {
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

  if (status !== 'pending') {
    const colors = status === 'applied'
      ? 'bg-green-500/10 text-green-400'
      : 'bg-neutral-800 text-neutral-400';
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colors}`}>
        {status}
      </span>
    );
  }

  return (
    <div className="flex items-center gap-2 shrink-0">
      <button
        type="button"
        onClick={() => updateStatus('applied')}
        disabled={loading !== null}
        className="flex items-center gap-1.5 rounded-lg bg-info hover:bg-info px-3 py-1.5 text-xs font-medium text-white disabled:opacity-50 transition"
      >
        {loading === 'applied' ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle className="h-3 w-3" />}
        Apply
      </button>
      <button
        type="button"
        onClick={() => updateStatus('skipped')}
        disabled={loading !== null}
        className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800/50 px-3 py-1.5 text-xs font-medium text-neutral-300 hover:bg-neutral-800 disabled:opacity-50 transition"
      >
        {loading === 'skipped' ? <Loader2 className="h-3 w-3 animate-spin" /> : <SkipForward className="h-3 w-3" />}
        Skip
      </button>
    </div>
  );
}
