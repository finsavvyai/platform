'use client';

import { useState } from 'react';

export function AlertActionButtons({
  alertId,
  instanceId,
  currentStatus,
}: {
  alertId: string;
  instanceId: string;
  currentStatus: string;
}) {
  const [loading, setLoading] = useState(false);

  async function handleAction(newStatus: string) {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/alerts/${alertId}`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: newStatus }),
        },
      );
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { message?: string }).message ?? 'Action failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (currentStatus === 'resolved') {
    return null;
  }

  return (
    <div className="flex items-center gap-2">
      {currentStatus === 'open' && (
        <button
          onClick={() => handleAction('acknowledged')}
          disabled={loading}
          className="rounded-lg border border-wire px-3 py-1 text-xs text-text-primary hover:bg-surface transition disabled:opacity-50"
        >
          {loading ? '...' : 'Acknowledge'}
        </button>
      )}
      <button
        onClick={() => handleAction('resolved')}
        disabled={loading}
        className="rounded-lg border border-wire px-3 py-1 text-xs text-text-primary hover:bg-surface transition disabled:opacity-50"
      >
        {loading ? '...' : 'Resolve'}
      </button>
    </div>
  );
}
