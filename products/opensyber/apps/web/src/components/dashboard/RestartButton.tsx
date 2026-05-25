'use client';

import { useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { readActiveOrgId } from '@/lib/org-context';

export function RestartButton({ instanceId }: { instanceId: string }) {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  async function handleRestart() {
    setLoading(true);
    setMessage(null);

    try {
      const orgId = readActiveOrgId(userId);

      const res = await fetch(`/api/proxy/instances/${instanceId}/restart`, {
        method: 'POST',
        headers: {
          ...(orgId ? { 'X-Org-Id': orgId } : {}),
        },
      });

      if (res.ok) {
        setMessage('Restart initiated');
      } else {
        const data = await res.json().catch(() => ({}));
        setMessage((data as { message?: string }).message ?? 'Restart failed');
      }
    } catch {
      setMessage('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <button
        onClick={handleRestart}
        disabled={loading}
        className="flex items-center gap-2 rounded-lg border border-wire px-4 py-2 text-sm hover:bg-surface transition disabled:opacity-50"
      >
        <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Restarting...' : 'Restart'}
      </button>
      {message && (
        <span className="text-sm text-text-secondary">{message}</span>
      )}
    </div>
  );
}
