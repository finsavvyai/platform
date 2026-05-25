'use client';

import { useState } from 'react';

interface DeleteOrgButtonProps {
  orgId: string;
  orgName: string;
}

export function DeleteOrgButton({ orgId, orgName }: DeleteOrgButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (input !== orgName) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/admin/organizations/${orgId}?confirm=true`, {
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
  };

  if (!confirming) {
    return (
      <button
        onClick={() => setConfirming(true)}
        className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors"
      >
        Delete
      </button>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <input
        value={input}
        onChange={(e) => setInput(e.target.value)}
        placeholder={`Type "${orgName}" to confirm`}
        className="px-2 py-1 rounded bg-white/5 border border-red-500/30 text-sm text-white
                   placeholder:text-gray-600 focus:outline-none w-48"
      />
      <button
        onClick={handleDelete}
        disabled={loading || input !== orgName}
        className="px-2 py-1 rounded text-xs bg-red-500/20 text-red-400
                   hover:bg-red-500/30 disabled:opacity-30 transition-colors"
      >
        {loading ? '...' : 'Confirm'}
      </button>
      <button
        onClick={() => { setConfirming(false); setInput(''); setError(null); }}
        className="px-2 py-1 rounded text-xs text-gray-500 hover:text-white"
      >
        Cancel
      </button>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
