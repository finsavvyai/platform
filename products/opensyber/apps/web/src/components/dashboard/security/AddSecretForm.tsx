'use client';

import { useState } from 'react';
import { Plus, ShieldCheck } from 'lucide-react';
import { useTokenForge } from '@opensyber/tokenforge/react';

interface AddSecretFormProps {
  instanceId: string;
}

/**
 * @returns {boolean} true when the device is bound and the global fetch
 * interceptor is injecting X-TF-* headers — i.e. sensitive writes will succeed.
 */
function useDeviceBound(): boolean {
  const { isBound } = useTokenForge();
  return isBound;
}

export function AddSecretForm({ instanceId }: AddSecretFormProps) {
  const [showForm, setShowForm] = useState(false);
  const [key, setKey] = useState('');
  const [value, setValue] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsVerification, setNeedsVerification] = useState(false);
  const deviceBound = useDeviceBound();

  async function handleSubmit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    if (!key.trim()) { setError('Secret key is required.'); return; }
    if (!value) { setError('Secret value is required.'); return; }

    setSaving(true);
    setError(null);
    setNeedsVerification(false);
    try {
      const res = await fetch(`/api/proxy/instances/${instanceId}/secrets`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: key.trim(), value }),
      });

      if (res.ok) {
        setKey('');
        setValue('');
        setShowForm(false);
        window.location.reload();
        return;
      }

      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: string;
        action?: string;
      };

      if (
        res.status === 403 &&
        (data.error === 'device_binding_required' || data.action === 'bind')
      ) {
        setNeedsVerification(true);
        setError(
          deviceBound
            ? 'Device verification is still syncing — try again in a moment.'
            : 'This device needs to be verified before you can store secrets. Reload the page to start verification.',
        );
      } else {
        setError(data.message ?? 'Failed to store secret.');
      }
    } catch {
      setError('Network error. Check your connection and try again.');
    } finally {
      setSaving(false);
    }
  }

  if (!showForm) {
    return (
      <button
        onClick={() => setShowForm(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition"
      >
        <Plus className="h-4 w-4" />
        Add Secret
      </button>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded border border-border bg-panel/30 p-6 space-y-4"
    >
      <h4 className="text-sm font-semibold text-white">Add New Secret</h4>
      <div>
        <label htmlFor="secret-key" className="block text-xs text-text-secondary mb-1">Key</label>
        <input
          id="secret-key"
          type="text"
          value={key}
          onChange={(e) => setKey(e.target.value.toUpperCase().replace(/[^A-Z0-9_]/g, '_'))}
          placeholder="GITHUB_TOKEN"
          className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white font-mono"
        />
      </div>
      <div>
        <label htmlFor="secret-value" className="block text-xs text-text-secondary mb-1">Value</label>
        <input
          id="secret-value"
          type="password"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter secret value..."
          className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white"
        />
      </div>
      {error && (
        <div role="alert" className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
          <div className="flex items-start gap-2">
            {needsVerification && <ShieldCheck className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />}
            <span>{error}</span>
          </div>
        </div>
      )}
      {!deviceBound && !error && (
        <div className="rounded-lg border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-xs text-amber-300 flex items-center gap-2">
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
          Verifying this device…
        </div>
      )}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving || !key.trim() || !value}
          className="flex-1 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition disabled:opacity-50"
        >
          {saving ? 'Storing...' : 'Store Secret'}
        </button>
        <button
          type="button"
          onClick={() => setShowForm(false)}
          disabled={saving}
          className="rounded-lg border border-wire px-4 py-2 text-sm text-text-secondary hover:bg-surface transition"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
