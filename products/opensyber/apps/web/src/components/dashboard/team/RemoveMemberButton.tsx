'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

interface RemoveMemberButtonProps {
  orgId: string;
  memberId: string;
  memberName: string;
  isOwner: boolean;
}

export function RemoveMemberButton({ orgId, memberId, memberName, isOwner }: RemoveMemberButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (isOwner) return null;

  async function handleRemove() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/organizations/${orgId}/members/${memberId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <span className="text-xs text-text-secondary">Remove {memberName}?</span>
          <button
            onClick={handleRemove}
            disabled={loading}
            className="rounded px-2 py-1 text-xs font-medium text-red-400 hover:bg-red-500/10 disabled:opacity-50"
          >
            {loading ? '...' : 'Yes'}
          </button>
          <button
            onClick={() => { setConfirming(false); setError(null); }}
            className="rounded px-2 py-1 text-xs text-text-secondary hover:text-white"
          >
            No
          </button>
        </div>
        {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded p-1 text-text-dim hover:bg-red-500/10 hover:text-red-400"
      title="Remove member"
      aria-label={`Remove ${memberName}`}
    >
      <Trash2 className="h-4 w-4" aria-hidden="true" />
    </button>
  );
}
