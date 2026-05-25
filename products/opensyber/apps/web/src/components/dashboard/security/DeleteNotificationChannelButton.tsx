'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export function DeleteNotificationChannelButton({ channelId }: { channelId: string }) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/security/user/notification-channels/${channelId}`,
        { method: 'DELETE' },
      );
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { message?: string }).message ?? 'Delete failed');
        setConfirming(false);
      }
    } catch {
      alert('Network error');
      setConfirming(false);
    } finally {
      setLoading(false);
    }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-red-400">Delete?</span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 transition disabled:opacity-50"
        >
          {loading ? '...' : 'Yes'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-lg border border-wire px-2 py-1 text-xs hover:bg-surface transition"
        >
          No
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="rounded-lg border border-red-500/30 p-2 text-red-400 hover:bg-red-500/10 transition"
    >
      <Trash2 className="h-4 w-4" />
    </button>
  );
}
