'use client';

import { useCallback } from 'react';
import { Globe, Trash2, Lock } from 'lucide-react';
import { useApi, useApiKey } from '@/lib/use-api';
import ProxyHowItWorks from '@/components/dashboard/ProxyHowItWorks';
import { AddDomainForm } from './AddDomainForm';

interface ProxyConfig {
  hostname: string;
  origin: string;
  status: string;
}

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8787';

export default function ProxyPage(): React.ReactElement {
  const token = useApiKey();

  const fetcher = useCallback(
    async (token: string, signal: AbortSignal) => {
      const res = await fetch(`${API_BASE}/v1/proxy/config`, {
        headers: { Authorization: `Bearer ${token}` },
        signal,
      });
      if (!res.ok) return [];
      const json = await res.json();
      return (json as { data: ProxyConfig[] }).data;
    },
    [],
  );

  const { data: configs, loading, refetch } = useApi<ProxyConfig[]>(fetcher);

  async function handleDelete(h: string): Promise<void> {
    if (!token) return;
    await fetch(`${API_BASE}/v1/proxy/config/${h}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    refetch();
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Zero-Code Proxy</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Protect any website with a DNS change. No script tags, no code.
        </p>
        <div className="mt-2 flex items-center gap-2">
          <Lock className="h-3 w-3 text-warn" />
          <span className="text-xs text-warn">Available on Team and Enterprise plans</span>
        </div>
      </div>

      <ProxyHowItWorks />

      <AddDomainForm token={token} onSaved={refetch} />

      <div className="rounded-2xl border border-border/50 bg-panel p-6">
        <h2 className="mb-4 text-lg font-semibold">Active Domains</h2>
        {loading ? (
          <div className="h-20 animate-pulse rounded-lg bg-surface/30" />
        ) : !configs || configs.length === 0 ? (
          <div className="flex items-center gap-3 py-6 text-sm text-text-muted">
            <Globe className="h-5 w-5" />
            No domains configured yet.
          </div>
        ) : (
          <div className="divide-y divide-border/50">
            {configs.map((c) => (
              <div key={c.hostname} className="flex items-center justify-between py-3">
                <div>
                  <p className="text-sm font-medium">{c.hostname}</p>
                  <p className="text-xs text-text-muted">{c.origin}</p>
                </div>
                <button
                  onClick={() => handleDelete(c.hostname)}
                  className="rounded-lg bg-alert/10 p-2 text-alert hover:bg-alert/20 transition"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
