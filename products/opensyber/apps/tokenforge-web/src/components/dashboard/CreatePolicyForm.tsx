'use client';

import { useState } from 'react';
import { createPolicy } from '@/lib/tokenforge-api-workforce';

export function CreatePolicyForm({
  apiKey,
  onDone,
  onCancel,
}: {
  apiKey: string;
  onDone: () => void;
  onCancel: () => void;
}): React.ReactElement {
  const [name, setName] = useState('');
  const [rules, setRules] = useState(
    JSON.stringify({ if_any: [{ geo_country_in: ['RU', 'KP'] }], then: 'block' }, null, 2),
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent): Promise<void> {
    e.preventDefault();
    setError(null);
    try {
      JSON.parse(rules);
    } catch {
      setError('Rules must be valid JSON');
      return;
    }
    setSaving(true);
    try {
      await createPolicy(apiKey, { name, rules });
      onDone();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form onSubmit={submit} className="mb-6 rounded-xl border border-border/50 bg-panel p-5">
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="e.g. Block sanctioned countries"
          className="w-full rounded-lg border border-border/50 bg-surface px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-info"
        />
      </div>
      <div className="mb-4">
        <label className="mb-1 block text-xs font-medium text-text-secondary">Rules (JSON DSL)</label>
        <textarea
          value={rules}
          onChange={(e) => setRules(e.target.value)}
          rows={6}
          className="w-full rounded-lg border border-border/50 bg-surface px-3 py-2 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-info"
        />
      </div>
      {error && <p className="mb-3 text-xs text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button
          type="submit"
          disabled={saving || !name}
          className="rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:bg-info/90 transition disabled:opacity-50"
        >
          {saving ? 'Creating...' : 'Create Policy'}
        </button>
        <button type="button" onClick={onCancel} className="rounded-lg bg-surface px-4 py-2 text-sm hover:bg-surface/80 transition">
          Cancel
        </button>
      </div>
    </form>
  );
}
