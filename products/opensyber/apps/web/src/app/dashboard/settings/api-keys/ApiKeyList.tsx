'use client';

import { useState } from 'react';
import { Key, Trash2, Plus } from 'lucide-react';
import { formatDate, formatRelativeTime } from '@/lib/utils';
import { GenerateKeyModal } from './GenerateKeyModal';
import type { ApiKeyInfo } from './api-key-types';

export function ApiKeyList({ initialKeys }: { initialKeys: ApiKeyInfo[] }) {
  const [keys, setKeys] = useState<ApiKeyInfo[]>(initialKeys);
  const [showModal, setShowModal] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function refreshKeys() {
    try {
      const res = await fetch('/api/proxy/keys');
      if (res.ok) {
        const data = await res.json() as { keys: ApiKeyInfo[] };
        setKeys(data.keys);
      }
    } catch { /* ignore */ }
  }

  async function handleRevoke(id: string) {
    if (!confirm('Revoke this API key? Any integrations using it will stop working.')) return;
    setRevoking(id);
    try {
      const res = await fetch(`/api/proxy/keys/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setKeys((prev) => prev.filter((k) => k.id !== id));
      }
    } catch { /* ignore */ }
    setRevoking(null);
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">API Keys</h1>
          <p className="text-sm text-text-secondary mt-1">
            Manage API keys for the public ingestion endpoint
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition"
        >
          <Plus className="h-4 w-4" /> Generate New Key
        </button>
      </div>

      {keys.length > 0 ? (
        <div className="space-y-3">
          {keys.map((key) => (
            <KeyRow
              key={key.id}
              apiKey={key}
              revoking={revoking === key.id}
              onRevoke={() => handleRevoke(key.id)}
            />
          ))}
        </div>
      ) : (
        <EmptyState onGenerate={() => setShowModal(true)} />
      )}

      {showModal && (
        <GenerateKeyModal
          onClose={() => setShowModal(false)}
          onCreated={refreshKeys}
        />
      )}
    </div>
  );
}

function KeyRow({
  apiKey, revoking, onRevoke,
}: {
  apiKey: ApiKeyInfo; revoking: boolean; onRevoke: () => void;
}) {
  const isExpired = apiKey.expiresAt && new Date(apiKey.expiresAt) < new Date();

  return (
    <div className="flex items-center justify-between rounded border border-border bg-panel/30 p-5">
      <div className="flex items-center gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-surface">
          <Key className="h-5 w-5 text-text-secondary" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <p className="text-sm font-medium">{apiKey.name}</p>
            {isExpired && (
              <span className="rounded-full bg-red-500/10 px-2 py-0.5 text-xs text-red-400">Expired</span>
            )}
            {apiKey.scopes.map((s) => (
              <span key={s} className="rounded-full bg-surface px-2 py-0.5 text-xs text-text-secondary">{s}</span>
            ))}
          </div>
          <p className="mt-0.5 font-mono text-xs text-text-dim">{apiKey.prefix}...</p>
          <div className="mt-0.5 flex gap-3 text-xs text-text-dim">
            <span>Created {formatDate(apiKey.createdAt)}</span>
            {apiKey.lastUsedAt && <span>Last used {formatRelativeTime(apiKey.lastUsedAt)}</span>}
          </div>
        </div>
      </div>
      <button
        onClick={onRevoke}
        disabled={revoking}
        className="flex items-center gap-1 rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition disabled:opacity-50"
      >
        <Trash2 className="h-3 w-3" /> {revoking ? 'Revoking...' : 'Revoke'}
      </button>
    </div>
  );
}

function EmptyState({ onGenerate }: { onGenerate: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center rounded border border-dashed border-wire bg-panel/20 py-12 text-center">
      <div className="flex h-12 w-12 items-center justify-center rounded bg-surface mb-4">
        <Key className="h-6 w-6 text-text-secondary" />
      </div>
      <h3 className="text-base font-semibold mb-1">No API keys</h3>
      <p className="text-sm text-text-secondary max-w-sm mb-4">
        Generate an API key to send events from custom scanners and integrations via the ingestion API.
      </p>
      <button
        onClick={onGenerate}
        className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition"
      >
        <Plus className="h-4 w-4" /> Generate API Key
      </button>
    </div>
  );
}
