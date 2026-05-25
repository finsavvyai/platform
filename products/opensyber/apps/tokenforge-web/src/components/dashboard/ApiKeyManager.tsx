'use client';

import { useState } from 'react';
import { Copy, Check, Plus } from 'lucide-react';
import { generateApiKey, revokeApiKey } from '@/lib/tokenforge-api';
import { useApiKey } from '@/lib/use-api';
import { KeyListItem } from './KeyListItem';
import type { ApiKey } from './types';

interface ApiKeyManagerProps {
  initialKeys: ApiKey[];
  onMutate?: () => void;
}

export function ApiKeyManager({ initialKeys, onMutate }: ApiKeyManagerProps): React.ReactElement {
  const token = useApiKey();
  const [keys, setKeys] = useState(initialKeys);
  const [showModal, setShowModal] = useState(false);
  const [newKeyName, setNewKeyName] = useState('');
  const [newKeyDomains, setNewKeyDomains] = useState('');
  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');
  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(new Set());

  async function handleGenerate(): Promise<void> {
    if (!newKeyName.trim() || generating) return;
    setGenerating(true);
    setGenerateError('');
    try {
      if (!token) {
        setGenerateError('No active session. Please sign in again.');
        return;
      }
      const domains = newKeyDomains.split(',').map((d) => d.trim().toLowerCase()).filter(Boolean);
      const result = await generateApiKey(token, newKeyName.trim(), domains.length > 0 ? domains : undefined);
      setKeys((prev) => [...prev, result.entry]);
      setGeneratedKey(result.key);
      onMutate?.();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to generate key';
      if (msg.includes('Invalid API key') || msg.includes('unauthorized')) {
        setGenerateError('Session expired. Please sign out and sign in again.');
      } else if (msg.includes('plan') || msg.includes('limit')) {
        setGenerateError(msg);
      } else {
        setGenerateError(`Failed to generate key. ${msg}`);
      }
    } finally {
      setGenerating(false);
    }
  }

  async function handleRevoke(id: string): Promise<void> {
    // Prevent deleting the key currently used for auth
    const keyToDelete = keys.find((k) => k.id === id);
    if (keyToDelete && token?.startsWith(keyToDelete.prefix.replace('...', ''))) {
      alert('You cannot delete the key you are currently using. Create a new key first, then delete this one.');
      return;
    }
    if (!window.confirm('Are you sure you want to delete this API key? This cannot be undone.')) return;
    if (!token) return;
    try {
      await revokeApiKey(token, id);
      setKeys((prev) => prev.filter((k) => k.id !== id));
      onMutate?.();
    } catch (err) {
      alert('Failed to delete key. Please try again.');
      console.error('Delete failed:', err);
    }
  }

  function handleDomainsUpdate(keyId: string, domains: string[]): void {
    setKeys((prev) => prev.map((k) => (k.id === keyId ? { ...k, allowedDomains: domains } : k)));
    onMutate?.();
  }

  function toggleVisibility(id: string): void {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function resetModal(): void {
    setShowModal(false);
    setNewKeyName('');
    setNewKeyDomains('');
    setGeneratedKey(null);
    setGenerateError('');
    setCopied(false);
  }

  async function handleCopy(): Promise<void> {
    if (!generatedKey) return;
    await navigator.clipboard.writeText(generatedKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <div className="mb-4 divide-y divide-border rounded-lg border border-border">
        {keys.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-text-muted">No API keys created yet.</p>
        ) : (
          keys.map((key) => (
            <KeyListItem
              key={key.id}
              apiKey={key}
              visible={visibleKeys.has(key.id)}
              onToggleVisibility={() => toggleVisibility(key.id)}
              isRevoking={revoking === key.id}
              onRevoke={() => handleRevoke(key.id)}
              onDomainsUpdate={handleDomainsUpdate}
            />
          ))
        )}
      </div>
      <button onClick={() => { setShowModal(true); setGenerateError(''); }} className="flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-void hover:brightness-110 transition">
        <Plus className="h-4 w-4" /> Generate New Key
      </button>
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60" role="dialog" aria-modal="true" aria-label="Generate API key">
          <div className="w-full max-w-md rounded-xl border border-border bg-panel p-6">
            <h3 className="mb-4 text-lg font-semibold">{generatedKey ? 'API Key Generated' : 'Generate New API Key'}</h3>
            {!generatedKey ? (
              <>
                <label htmlFor="key-name" className="mb-1 block text-sm text-text-secondary">Key Name</label>
                <input id="key-name" type="text" value={newKeyName} onChange={(e) => setNewKeyName(e.target.value)} placeholder="e.g., Production" className="mb-3 w-full rounded-lg border border-border bg-void px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none" />
                <label htmlFor="key-domains" className="mb-1 block text-sm text-text-secondary">Allowed Domains (optional)</label>
                <input id="key-domains" type="text" value={newKeyDomains} onChange={(e) => setNewKeyDomains(e.target.value)} placeholder="myapp.com, staging.myapp.com" className="mb-4 w-full rounded-lg border border-border bg-void px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none" />
                {generateError && <p className="mb-3 text-sm text-alert" role="alert">{generateError}</p>}
                <div className="flex gap-3">
                  <button onClick={resetModal} className="flex-1 rounded-lg border border-wire px-4 py-2 text-sm text-text-secondary hover:text-text-primary transition">Cancel</button>
                  <button onClick={handleGenerate} disabled={!newKeyName.trim() || generating} className="flex-1 rounded-lg bg-info px-4 py-2 text-sm font-medium text-void hover:brightness-110 disabled:opacity-50 disabled:cursor-not-allowed transition">{generating ? 'Generating...' : 'Generate'}</button>
                </div>
              </>
            ) : (
              <>
                <p className="mb-3 text-sm text-warn">Copy this key now. It will not be shown again.</p>
                <div className="mb-4 flex items-center gap-2 rounded-lg bg-void p-3">
                  <code className="flex-1 break-all font-mono text-xs text-ok">{generatedKey}</code>
                  <button onClick={handleCopy} className="rounded p-1 text-text-secondary hover:text-text-primary transition">{copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}</button>
                </div>
                <button onClick={resetModal} className="w-full rounded-lg bg-info px-4 py-2 text-sm font-medium text-void hover:brightness-110 transition">Done</button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
