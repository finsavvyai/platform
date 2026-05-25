'use client';

import { useState } from 'react';
import { X } from 'lucide-react';

interface CancelInvitationButtonProps {
  orgId: string;
  invitationId: string;
}

export function CancelInvitationButton({ orgId, invitationId }: CancelInvitationButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCancel() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/organizations/${orgId}/invitations/${invitationId}`, {
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

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleCancel}
        disabled={loading}
        className="rounded p-1 text-text-dim hover:bg-red-500/10 hover:text-red-400 disabled:opacity-50"
        title="Cancel invitation"
        aria-label="Cancel invitation"
      >
        <X className="h-4 w-4" aria-hidden="true" />
      </button>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
