'use client';

import { useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import { formatDate } from '@/lib/utils';

interface SkillModerationCardProps {
  skill: {
    id: string;
    name: string;
    description: string | null;
    createdAt: string;
  };
}

export function SkillModerationCard({ skill }: SkillModerationCardProps) {
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleAction = async (action: 'approve' | 'reject') => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/admin/skills/${skill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      setDone(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  };

  if (done) {
    return (
      <div className="rounded border border-border bg-panel/30 p-6 opacity-50">
        <p className="text-sm text-text-secondary">Action completed — refresh to update.</p>
      </div>
    );
  }

  return (
    <div className="rounded border border-border bg-panel/30 p-6 space-y-4">
      <div>
        <h3 className="text-base font-semibold">{skill.name}</h3>
        <p className="text-sm text-text-secondary mt-1">{skill.description ?? 'No description'}</p>
      </div>
      <p className="text-xs text-text-dim">Submitted {formatDate(skill.createdAt)}</p>
      <div className="flex gap-2">
        <button
          onClick={() => handleAction('approve')}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-green-500/20 px-3 py-1.5 text-sm font-medium text-green-400 hover:bg-green-500/30 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
          Approve
        </button>
        <button
          onClick={() => handleAction('reject')}
          disabled={loading}
          className="flex items-center gap-1.5 rounded-lg bg-red-500/20 px-3 py-1.5 text-sm font-medium text-red-400 hover:bg-red-500/30 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <X className="h-3.5 w-3.5" />}
          Reject
        </button>
      </div>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
