'use client';

import { useState } from 'react';

interface ToggleAdminButtonProps {
  userId: string;
  isAdmin: boolean;
}

export function ToggleAdminButton({ userId, isAdmin }: ToggleAdminButtonProps) {
  const [admin, setAdmin] = useState(isAdmin);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleToggle = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isAdmin: !admin }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      setAdmin(!admin);
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
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50
          ${admin
            ? 'bg-amber-500/20 text-amber-400 hover:bg-amber-500/30'
            : 'bg-white/5 text-gray-400 hover:bg-white/10'}`}
      >
        {loading ? '...' : admin ? 'Revoke Admin' : 'Grant Admin'}
      </button>
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
    </div>
  );
}
