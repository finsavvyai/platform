'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';

interface SuspendUserButtonProps {
  userId: string;
  isSuspended: boolean;
}

export function SuspendUserButton({ userId, isSuspended }: SuspendUserButtonProps) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isSuspended: !isSuspended }),
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
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        onClick={handleToggle}
        disabled={loading}
        className={`flex items-center gap-1 rounded-lg px-3 py-1.5 text-xs font-medium transition disabled:opacity-50 ${
          isSuspended
            ? 'bg-green-500/20 text-green-400 hover:bg-green-500/30'
            : 'bg-red-500/20 text-red-400 hover:bg-red-500/30'
        }`}
      >
        {loading && <Loader2 className="h-3 w-3 animate-spin" />}
        {isSuspended ? 'Unsuspend' : 'Suspend'}
      </button>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
