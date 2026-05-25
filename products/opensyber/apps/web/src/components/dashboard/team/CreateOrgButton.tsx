'use client';

import { useState } from 'react';
import { Users } from 'lucide-react';
import { useSession } from 'next-auth/react';
import { writeActiveOrgId } from '@/lib/org-context';

export function CreateOrgButton() {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { data: session } = useSession();
  const userId = (session?.user as { id?: string } | undefined)?.id ?? null;

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/proxy/organizations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: name.trim() }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || 'Failed to create organization');
      }

      const data = await res.json() as { data: { id: string } };
      writeActiveOrgId(userId, data.data.id);
      window.location.reload();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  }

  if (!showForm) {
    return (
      <div className="flex flex-col items-center gap-4 py-16 text-center">
        <div className="rounded-full bg-surface p-4">
          <Users className="h-8 w-8 text-text-secondary" />
        </div>
        <div>
          <h3 className="text-lg font-medium">No team yet</h3>
          <p className="mt-1 text-sm text-text-secondary">
            Create an organization to collaborate with your team.
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover"
        >
          Create Your Team
        </button>
      </div>
    );
  }

  return (
    <form onSubmit={handleCreate} className="mx-auto max-w-sm space-y-4 py-12">
      <h3 className="text-lg font-medium">Create Organization</h3>
      <div>
        <label htmlFor="org-name" className="mb-1 block text-sm text-text-primary">
          Organization Name
        </label>
        <input
          id="org-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Acme Corp"
          className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white placeholder:text-text-dim focus:border-signal focus:outline-none"
          required
        />
      </div>
      {error && <p className="text-sm text-red-400">{error}</p>}
      <div className="flex gap-3">
        <button type="button" onClick={() => setShowForm(false)} className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-white">
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover disabled:opacity-50"
        >
          {loading ? 'Creating...' : 'Create'}
        </button>
      </div>
    </form>
  );
}
