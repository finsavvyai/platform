'use client';

import { useState } from 'react';
import { Globe, X, Check, Pencil } from 'lucide-react';
import { updateKeyDomains } from '@/lib/tokenforge-api';
import { useApiKey } from '@/lib/use-api';

interface DomainEditorProps {
  keyId: string;
  initialDomains: string[];
  onSave: (keyId: string, domains: string[]) => void;
}

/**
 * Inline domain editor for an API key.
 * Shows domain badges with an edit button that opens a form.
 */
export function DomainEditor({ keyId, initialDomains, onSave }: DomainEditorProps): React.ReactElement {
  const token = useApiKey();
  const [editing, setEditing] = useState(false);
  const [input, setInput] = useState(initialDomains.join(', '));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  async function handleSave(): Promise<void> {
    setSaving(true);
    setError('');
    const domains = input
      .split(',')
      .map((d) => d.trim().toLowerCase())
      .filter(Boolean);
    try {
      if (!token) return;
      await updateKeyDomains(token, keyId, domains);
      onSave(keyId, domains);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update domains');
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="mt-2 space-y-2">
        <label htmlFor={`domain-editor-${keyId}`} className="block text-xs text-text-secondary">
          Allowed domains (comma-separated)
        </label>
        <input
          id={`domain-editor-${keyId}`}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="myapp.com, *.staging.myapp.com"
          className="w-full rounded-lg border border-wire bg-void px-3 py-1.5 text-xs text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
        />
        {error && <p className="text-xs text-alert">{error}</p>}
        <div className="flex gap-2">
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-1 rounded bg-info px-2.5 py-1 text-xs font-medium text-text-primary hover:brightness-110 disabled:opacity-50 transition"
          >
            <Check className="h-3 w-3" />
            {saving ? 'Saving...' : 'Save'}
          </button>
          <button
            onClick={() => { setEditing(false); setInput(initialDomains.join(', ')); setError(''); }}
            className="rounded border border-wire px-2.5 py-1 text-xs text-text-secondary hover:text-text-primary transition"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
      {initialDomains.length > 0 ? (
        <>
          <Globe className="h-3 w-3 text-text-muted" />
          {initialDomains.map((d) => (
            <span
              key={d}
              className="rounded-full bg-surface px-2 py-0.5 text-[10px] text-text-secondary"
            >
              {d}
            </span>
          ))}
        </>
      ) : (
        <span className="text-[10px] text-text-muted">All domains allowed</span>
      )}
      <button
        onClick={() => setEditing(true)}
        className="ml-1 rounded p-0.5 text-text-muted hover:text-text-secondary transition"
        title="Edit allowed domains"
      >
        <Pencil className="h-3 w-3" />
      </button>
    </div>
  );
}
