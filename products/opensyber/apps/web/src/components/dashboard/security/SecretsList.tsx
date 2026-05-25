'use client';

import { useState } from 'react';
import { Trash2, Key } from 'lucide-react';

interface Secret {
  id: string;
  key: string;
  createdAt: string;
}

interface SecretsListProps {
  instanceId: string;
  initialSecrets: Secret[];
}

export function SecretsList({ instanceId, initialSecrets }: SecretsListProps) {
  const [secrets, setSecrets] = useState<Secret[]>(initialSecrets);
  const [deleting, setDeleting] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete(key: string): Promise<void> {
    if (!confirm(`Delete secret "${key}"? This cannot be undone.`)) return;

    setDeleting(key);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/instances/${instanceId}/secrets/${key}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      setSecrets((prev) => prev.filter((s) => s.key !== key));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setDeleting(null);
    }
  }

  if (secrets.length === 0) {
    return (
      <div className="rounded border border-border bg-panel/30 p-8 text-center">
        <Key className="mx-auto h-8 w-8 text-text-dim mb-3" />
        <p className="text-sm text-text-secondary">No secrets stored yet.</p>
        <p className="text-xs text-text-dim mt-1">
          Add secrets to inject environment variables into your agent.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {error && <p className="text-sm text-red-400 mt-2">{error}</p>}
      {secrets.map((secret) => (
        <div
          key={secret.id}
          className="flex items-center justify-between rounded-lg border border-border bg-panel/30 px-4 py-3"
        >
          <div className="flex items-center gap-3">
            <Key className="h-4 w-4 text-text-dim" />
            <div>
              <p className="text-sm font-medium text-white">{secret.key}</p>
              <p className="text-xs text-text-dim">
                Added {new Date(secret.createdAt).toLocaleDateString()}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-xs text-text-dim font-mono">{'••••••••'}</span>
            <button
              onClick={() => handleDelete(secret.key)}
              disabled={deleting === secret.key}
              className="rounded-md p-1.5 text-text-dim hover:text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ))}
    </div>
  );
}
