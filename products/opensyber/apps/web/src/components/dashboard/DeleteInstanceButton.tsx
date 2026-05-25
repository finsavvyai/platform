'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export function DeleteInstanceButton({ instanceId }: { instanceId: string }) {
  const [confirming, setConfirming] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleDelete() {
    setLoading(true);

    try {
      const res = await fetch(`/api/proxy/instances/${instanceId}`, {
        method: 'DELETE',
      });

      if (res.ok) {
        // Redirect to dashboard after deletion
        window.location.href = '/dashboard';
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
      <div className="flex items-center gap-3">
        <span className="text-sm text-red-400">
          Are you sure? This cannot be undone.
        </span>
        <button
          onClick={handleDelete}
          disabled={loading}
          className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 transition disabled:opacity-50"
        >
          {loading ? 'Deleting...' : 'Yes, delete'}
        </button>
        <button
          onClick={() => setConfirming(false)}
          disabled={loading}
          className="rounded-lg border border-wire px-4 py-2 text-sm hover:bg-surface transition"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setConfirming(true)}
      className="flex items-center gap-2 rounded-lg border border-red-500/30 px-4 py-2 text-sm text-red-400 hover:bg-red-500/10 transition"
    >
      <Trash2 className="h-4 w-4" />
      Delete Instance
    </button>
  );
}
