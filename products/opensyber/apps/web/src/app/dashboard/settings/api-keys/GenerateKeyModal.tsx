'use client';

import { useState } from 'react';
import { Copy, Check, AlertTriangle } from 'lucide-react';

interface GenerateKeyModalProps {
  onClose: () => void;
  onCreated: () => void;
}

export function GenerateKeyModal({ onClose, onCreated }: GenerateKeyModalProps) {
  const [name, setName] = useState('');
  const [expiresAt, setExpiresAt] = useState('');
  const [scopes, setScopes] = useState<string[]>(['ingest']);
  const [loading, setLoading] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/proxy/keys', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          scopes,
          ...(expiresAt ? { expiresAt: new Date(expiresAt).toISOString() } : {}),
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message ?? 'Failed to create key');
      }

      const data = await res.json() as { key: string };
      setGeneratedKey(data.key);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  }

  async function handleCopy() {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="w-full max-w-md rounded border border-border bg-panel p-6">
        {generatedKey ? (
          <KeyCreatedView
            generatedKey={generatedKey}
            copied={copied}
            onCopy={handleCopy}
            onClose={onClose}
          />
        ) : (
          <KeyFormView
            name={name}
            setName={setName}
            expiresAt={expiresAt}
            setExpiresAt={setExpiresAt}
            scopes={scopes}
            toggleScope={toggleScope}
            loading={loading}
            error={error}
            onSubmit={handleSubmit}
            onClose={onClose}
          />
        )}
      </div>
    </div>
  );
}

function KeyCreatedView({
  generatedKey, copied, onCopy, onClose,
}: {
  generatedKey: string; copied: boolean; onCopy: () => void; onClose: () => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">API Key Created</h2>
      <div className="mb-4 flex items-center gap-2 rounded-lg bg-yellow-500/10 border border-yellow-500/20 p-3">
        <AlertTriangle className="h-4 w-4 text-yellow-400 shrink-0" />
        <p className="text-xs text-yellow-300">
          Copy this key now. It will not be shown again.
        </p>
      </div>
      <div className="mb-6 flex items-center gap-2">
        <code className="flex-1 rounded-lg bg-surface px-3 py-2 text-xs font-mono text-neutral-200 break-all">
          {generatedKey}
        </code>
        <button onClick={onCopy} className="rounded-lg bg-surface p-2 hover:bg-neutral-700 transition">
          {copied ? <Check className="h-4 w-4 text-green-400" /> : <Copy className="h-4 w-4 text-text-secondary" />}
        </button>
      </div>
      <button
        onClick={onClose}
        className="w-full rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition"
      >
        Done
      </button>
    </div>
  );
}

function KeyFormView({
  name, setName, expiresAt, setExpiresAt, scopes, toggleScope,
  loading, error, onSubmit, onClose,
}: {
  name: string; setName: (v: string) => void;
  expiresAt: string; setExpiresAt: (v: string) => void;
  scopes: string[]; toggleScope: (s: string) => void;
  loading: boolean; error: string | null;
  onSubmit: (e: React.FormEvent) => void; onClose: () => void;
}) {
  const scopeOptions = [
    { key: 'ingest', label: 'Ingest Events', desc: 'Send events to ingestion API' },
    { key: 'read', label: 'Read', desc: 'Read integration data' },
    { key: 'write', label: 'Write', desc: 'Modify integration settings' },
  ];

  return (
    <form onSubmit={onSubmit}>
      <h2 className="text-lg font-semibold mb-4">Generate API Key</h2>
      {error && <p className="mb-3 text-sm text-red-400">{error}</p>}
      <div className="mb-4">
        <label className="block text-sm text-text-secondary mb-1">Name</label>
        <input
          type="text" value={name} onChange={(e) => setName(e.target.value)}
          placeholder="e.g. CI Scanner Key" required maxLength={64}
          className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm focus:border-signal focus:outline-none"
        />
      </div>
      <div className="mb-4">
        <label className="block text-sm text-text-secondary mb-1">Expiry (optional)</label>
        <input
          type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)}
          className="w-full rounded-lg border border-wire bg-surface px-3 py-2 text-sm focus:border-signal focus:outline-none"
        />
      </div>
      <div className="mb-6">
        <label className="block text-sm text-text-secondary mb-2">Scopes</label>
        <div className="space-y-2">
          {scopeOptions.map((opt) => (
            <label key={opt.key} className="flex items-center gap-2 text-sm cursor-pointer">
              <input
                type="checkbox" checked={scopes.includes(opt.key)}
                onChange={() => toggleScope(opt.key)}
                className="rounded border-neutral-600"
              />
              <span className="font-medium">{opt.label}</span>
              <span className="text-text-dim">- {opt.desc}</span>
            </label>
          ))}
        </div>
      </div>
      <div className="flex gap-3">
        <button type="button" onClick={onClose} className="flex-1 rounded-lg border border-wire px-4 py-2 text-sm hover:bg-surface transition">
          Cancel
        </button>
        <button type="submit" disabled={loading || !name.trim()} className="flex-1 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition disabled:opacity-50">
          {loading ? 'Creating...' : 'Generate Key'}
        </button>
      </div>
    </form>
  );
}
