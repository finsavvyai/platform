'use client';

import { useEffect, useState, useCallback } from 'react';
import { ShieldCheck, Plus } from 'lucide-react';
import { ZtnaAppRow, type ZtnaApp } from '@/components/dashboard/ZtnaAppRow';
import { ZtnaCreateForm } from '@/components/dashboard/ZtnaCreateForm';

export default function ZtnaPage() {
  const [apps, setApps] = useState<ZtnaApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    fetch('/api/proxy/ztna/apps')
      .then((r) => r.json())
      .then((d: { data?: ZtnaApp[]; error?: string }) => {
        if (d.error) throw new Error(d.error);
        setApps(d.data ?? []);
      })
      .catch((e) => setError(e instanceof Error ? e.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- fetch-on-mount: load is a useCallback that fetches and updates state
    load();
  }, [load]);

  async function toggleStatus(app: ZtnaApp) {
    const newStatus = app.status === 'active' ? 'paused' : 'active';
    await fetch(`/api/proxy/ztna/apps/${encodeURIComponent(app.id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus }),
    });
    load();
  }

  async function deleteApp(app: ZtnaApp) {
    if (!confirm(`Stop gating ${app.hostname}? This is irreversible.`)) return;
    await fetch(`/api/proxy/ztna/apps/${encodeURIComponent(app.id)}`, {
      method: 'DELETE',
    });
    load();
  }

  return (
    <div className="space-y-6">
      <header className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <ShieldCheck className="h-6 w-6 text-signal" />
            ZTNA Gated Apps
          </h1>
          <p className="text-sm text-zinc-400 mt-1">
            Each app is fronted by the TokenForge proxy worker. Inbound requests
            are gated by Auth.js JWT + device-bound TF signature, and forwarded
            only when the trust score meets the per-app threshold.
          </p>
        </div>
        {!showCreate && (
          <button
            type="button"
            onClick={() => setShowCreate(true)}
            className="px-4 py-2 rounded-md bg-signal text-zinc-950 text-sm font-medium hover:opacity-90 flex items-center gap-2"
          >
            <Plus className="h-4 w-4" />
            Add app
          </button>
        )}
      </header>

      {showCreate && (
        <ZtnaCreateForm
          onCreated={() => {
            setShowCreate(false);
            load();
          }}
          onCancel={() => setShowCreate(false)}
        />
      )}

      {error && (
        <div className="rounded-md border border-red-500/30 bg-red-500/10 text-red-400 p-3 text-sm">
          {error}
        </div>
      )}

      {loading ? (
        <div className="text-zinc-400 text-sm">Loading…</div>
      ) : apps.length === 0 ? (
        <div className="rounded-md border border-zinc-800 bg-zinc-900/50 p-8 text-center text-zinc-400">
          No gated apps yet. Add one to start protecting an internal app behind
          TokenForge device verification.
        </div>
      ) : (
        <ul className="space-y-2">
          {apps.map((a) => (
            <ZtnaAppRow
              key={a.id}
              app={a}
              onToggleStatus={toggleStatus}
              onDelete={deleteApp}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
