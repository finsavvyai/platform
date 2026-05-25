'use client';

import { useState } from 'react';
import { Trash2 } from 'lucide-react';

export function PolicyActions({
  policyId,
  instanceId,
  isActive,
}: {
  policyId: string;
  instanceId: string;
  isActive: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [confirming, setConfirming] = useState(false);

  async function handleToggle() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/policies/${policyId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ isActive: !isActive }),
        },
      );
      if (res.ok) window.location.reload();
      else {
        const data = await res.json().catch(() => ({}));
        alert((data as { message?: string }).message ?? 'Toggle failed');
      }
    } catch { alert('Network error'); }
    finally { setLoading(false); }
  }

  async function handleDelete() {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/policies/${policyId}`,
        { method: 'DELETE' },
      );
      if (res.ok) window.location.reload();
      else {
        const data = await res.json().catch(() => ({}));
        alert((data as { message?: string }).message ?? 'Delete failed');
        setConfirming(false);
      }
    } catch { alert('Network error'); setConfirming(false); }
    finally { setLoading(false); }
  }

  if (confirming) {
    return (
      <div className="flex items-center gap-2 pt-3 border-t border-border">
        <span className="text-xs text-red-400">Delete this policy?</span>
        <button onClick={handleDelete} disabled={loading} className="rounded-lg bg-red-600 px-2 py-1 text-xs font-medium text-white hover:bg-red-500 transition disabled:opacity-50">
          {loading ? '...' : 'Yes'}
        </button>
        <button onClick={() => setConfirming(false)} disabled={loading} className="rounded-lg border border-wire px-2 py-1 text-xs hover:bg-surface transition">
          No
        </button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 pt-3 border-t border-border">
      <button
        onClick={handleToggle}
        disabled={loading}
        className="rounded-lg border border-wire px-3 py-1 text-xs text-text-primary hover:bg-surface transition disabled:opacity-50"
      >
        {loading ? '...' : isActive ? 'Pause' : 'Activate'}
      </button>
      <button
        onClick={() => setConfirming(true)}
        className="rounded-lg border border-red-500/30 p-1 text-red-400 hover:bg-red-500/10 transition"
      >
        <Trash2 className="h-3.5 w-3.5" />
      </button>
    </div>
  );
}
