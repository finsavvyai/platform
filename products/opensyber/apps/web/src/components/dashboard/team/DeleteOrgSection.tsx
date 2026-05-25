'use client';

import { useState } from 'react';
import { useSession } from 'next-auth/react';
import { clearActiveOrgId } from '@/lib/org-context';

interface DeleteOrgSectionProps {
  orgId: string;
  orgName: string;
}

export function DeleteOrgSection({ orgId, orgName }: DeleteOrgSectionProps) {
  const [confirmText, setConfirmText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  const confirmed = confirmText === orgName;

  async function handleDelete() {
    if (!confirmed) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/proxy/organizations/${orgId}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || 'Failed to delete');
      }
      clearActiveOrgId(userId);
      window.location.href = '/dashboard';
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded border border-red-500/30 bg-red-500/5 p-6 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-red-400">
        Danger Zone
      </h3>
      <p className="text-sm text-text-secondary">
        Permanently delete <strong className="text-white">{orgName}</strong> and remove all member associations.
        This action cannot be undone.
      </p>
      <div>
        <label htmlFor="confirm-delete" className="mb-1 block text-xs text-text-dim">
          Type &quot;{orgName}&quot; to confirm
        </label>
        <input
          id="confirm-delete"
          value={confirmText}
          onChange={(e) => setConfirmText(e.target.value)}
          className="w-full max-w-sm rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white focus:border-red-500 focus:outline-none"
          placeholder={orgName}
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <button
        onClick={handleDelete}
        disabled={!confirmed || loading}
        className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-500 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Deleting...' : 'Delete Organization'}
      </button>
    </div>
  );
}
