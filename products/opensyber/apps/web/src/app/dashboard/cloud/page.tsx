'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Cloud, Plus, RefreshCw, Wand2 } from 'lucide-react';
import { formatDate } from '@/lib/utils';
import { ConnectAccountModal } from './ConnectAccountModal';
import {
  type CloudAccount,
  STATUS_COLORS,
  PROVIDER_LABELS,
  PROVIDER_COLORS,
} from './types';
import { CloudSkeleton } from '@/components/dashboard/CloudSkeleton';

export default function CloudAccountsPage() {
  const router = useRouter();
  const [accounts, setAccounts] = useState<CloudAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [scanningId, setScanningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadAccounts() {
    setLoading(true);
    fetch('/api/proxy/cloud/accounts')
      .then((r) => r.json())
      .then((d) => setAccounts(d.data ?? []))
      .catch(() => setAccounts([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadAccounts(); }, []);

  async function scanAccount(id: string) {
    setScanningId(id);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/cloud/accounts/${id}/scan`, { method: 'POST' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    } finally {
      setScanningId(null);
    }
  }

  async function deleteAccount(id: string) {
    if (!confirm('Remove this cloud account? This cannot be undone.')) return;
    setError(null);
    try {
      const res = await fetch(`/api/proxy/cloud/accounts/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      loadAccounts();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  if (loading) {
    return <CloudSkeleton />;
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Cloud Security</h1>
          <p className="mt-1 text-sm text-text-secondary">
            Connected cloud accounts and CSPM posture scanning
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => router.push('/dashboard/cloud/setup')}
            className="flex items-center gap-2 rounded-lg border border-wire px-4 py-2 text-sm font-medium hover:bg-surface transition"
          >
            <Wand2 className="h-4 w-4" />
            Setup Wizard
          </button>
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition"
          >
            <Plus className="h-4 w-4" />
            Quick Connect
          </button>
        </div>
      </div>

      {error && <p className="text-sm text-red-400 mt-2 mb-4">{error}</p>}

      {accounts.length === 0 ? (
        <div className="rounded border border-border bg-panel/30 p-12 text-center">
          <Cloud className="mx-auto mb-4 h-12 w-12 text-text-dim" />
          <p className="text-lg font-medium text-text-secondary">No cloud accounts connected</p>
          <p className="mt-2 text-sm text-text-dim">
            Connect your first cloud account to start scanning for misconfigurations.
          </p>
          <button
            onClick={() => router.push('/dashboard/cloud/setup')}
            className="mt-4 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition"
          >
            Get Started
          </button>
        </div>
      ) : (
        <div className="overflow-x-auto rounded border border-border bg-panel/30">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-text-secondary">
                <th className="px-6 py-3 font-medium">Provider</th>
                <th className="px-6 py-3 font-medium">Name</th>
                <th className="px-6 py-3 font-medium">Status</th>
                <th className="px-6 py-3 font-medium">Last Scan</th>
                <th className="px-6 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-800">
              {accounts.map((a) => (
                <tr key={a.id} className="hover:bg-surface/30 transition">
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-md border px-2 py-0.5 text-xs font-medium ${PROVIDER_COLORS[a.provider] ?? ''}`}>
                      {PROVIDER_LABELS[a.provider] ?? a.provider}
                    </span>
                  </td>
                  <td className="px-6 py-3 font-medium">{a.name}</td>
                  <td className="px-6 py-3">
                    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[a.status] ?? ''}`}>
                      {a.status}
                    </span>
                  </td>
                  <td className="px-6 py-3 text-text-secondary">
                    {a.lastScanAt ? formatDate(a.lastScanAt) : 'Never'}
                  </td>
                  <td className="px-6 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => scanAccount(a.id)}
                        disabled={scanningId === a.id}
                        className="rounded-lg border border-wire px-3 py-1.5 text-xs hover:bg-surface transition disabled:opacity-50"
                      >
                        <RefreshCw className={`h-3.5 w-3.5 ${scanningId === a.id ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        onClick={() => deleteAccount(a.id)}
                        className="rounded-lg border border-red-500/30 px-3 py-1.5 text-xs text-red-400 hover:bg-red-500/10 transition"
                      >
                        Remove
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <ConnectAccountModal
          onClose={() => setShowModal(false)}
          onCreated={() => { setShowModal(false); loadAccounts(); }}
        />
      )}
    </div>
  );
}
