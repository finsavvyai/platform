'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

const PROVIDER_PLACEHOLDERS: Record<string, string> = {
  aws: 'Production AWS',
  gcp: 'My GCP Project',
  azure: 'Azure Subscription',
};

export function ConnectAccountModal({ onClose, onCreated }: Props) {
  const [provider, setProvider] = useState('aws');
  const [name, setName] = useState('');
  const [roleArn, setRoleArn] = useState('');
  const [serviceAccountKey, setServiceAccountKey] = useState('');
  const [tenantId, setTenantId] = useState('');
  const [clientId, setClientId] = useState('');
  const [clientSecret, setClientSecret] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function buildCredentials(): Record<string, string> | undefined {
    if (provider === 'aws') {
      return roleArn ? { roleArn } : undefined;
    }
    if (provider === 'gcp') {
      return serviceAccountKey ? { serviceAccountKey } : undefined;
    }
    if (provider === 'azure') {
      if (!tenantId && !clientId && !clientSecret) return undefined;
      return { tenantId, clientId, clientSecret };
    }
    return undefined;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError('Account name is required.'); return; }

    setSaving(true);
    setError(null);
    try {
      const credentials = buildCredentials();
      const res = await fetch('/api/proxy/cloud/accounts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ provider, name, credentials }),
      });
      if (res.ok) {
        onCreated();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? 'Failed to connect account.');
      }
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
      <div className="w-full max-w-md rounded border border-border bg-panel p-6">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-lg font-semibold">Connect Cloud Account</h2>
          <button onClick={onClose} className="text-text-secondary hover:text-white transition">
            <X className="h-5 w-5" />
          </button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Provider</label>
            <select
              value={provider}
              onChange={(e) => setProvider(e.target.value)}
              className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm"
            >
              <option value="aws">AWS</option>
              <option value="gcp">Google Cloud</option>
              <option value="azure">Azure</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-sm text-text-secondary">Account Name</label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
              placeholder={PROVIDER_PLACEHOLDERS[provider] ?? 'Account name'}
              className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm"
            />
          </div>
          {provider === 'aws' && (
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Role ARN</label>
              <input
                type="text"
                value={roleArn}
                onChange={(e) => setRoleArn(e.target.value)}
                placeholder="arn:aws:iam::123456789:role/OpenSyberRole"
                className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm font-mono text-xs"
              />
            </div>
          )}
          {provider === 'gcp' && (
            <div>
              <label className="mb-1 block text-sm text-text-secondary">Service Account Key (JSON)</label>
              <textarea
                value={serviceAccountKey}
                onChange={(e) => setServiceAccountKey(e.target.value)}
                rows={5}
                placeholder='{"type":"service_account","project_id":"..."}'
                className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm font-mono text-xs"
              />
            </div>
          )}
          {provider === 'azure' && (
            <>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Tenant ID</label>
                <input
                  type="text"
                  value={tenantId}
                  onChange={(e) => setTenantId(e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Client ID</label>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="00000000-0000-0000-0000-000000000000"
                  className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm font-mono text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-sm text-text-secondary">Client Secret</label>
                <input
                  type="password"
                  value={clientSecret}
                  onChange={(e) => setClientSecret(e.target.value)}
                  placeholder="Application client secret"
                  className="w-full rounded-md border border-border bg-void px-3 py-2 text-sm font-mono text-xs"
                />
              </div>
            </>
          )}
          {error && (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
              {error}
            </div>
          )}
          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-white transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving || !name.trim()}
              className="rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? 'Connecting...' : 'Connect'}
            </button>
          </div>
        </form>
      </div>
    </div>
    </Portal>
  );
}
