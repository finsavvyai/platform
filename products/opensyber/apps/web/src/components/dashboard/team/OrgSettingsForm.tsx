'use client';

import { useState } from 'react';

interface OrgSettingsFormProps {
  orgId: string;
  name: string;
  slug: string;
  canEdit: boolean;
}

export function OrgSettingsForm({ orgId, name: initialName, slug: initialSlug, canEdit }: OrgSettingsFormProps) {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleSave() {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/proxy/organizations/${orgId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error((data as { message?: string }).message || 'Failed to update');
      }
      setMessage('Settings saved.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Failed to save');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="rounded border border-border bg-panel/30 p-6 space-y-4">
      <h3 className="text-sm font-semibold uppercase tracking-wider text-text-dim">
        Organization
      </h3>
      <div>
        <label htmlFor="settings-name" className="mb-1 block text-sm text-text-primary">Name</label>
        <input
          id="settings-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          disabled={!canEdit}
          className="w-full max-w-sm rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white disabled:opacity-50 focus:border-signal focus:outline-none"
        />
      </div>
      <div>
        <label htmlFor="settings-slug" className="mb-1 block text-sm text-text-primary">Slug</label>
        <input
          id="settings-slug"
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          disabled={!canEdit}
          className="w-full max-w-sm rounded-lg border border-wire bg-surface px-3 py-2 text-sm text-white disabled:opacity-50 focus:border-signal focus:outline-none"
        />
      </div>
      {canEdit && (
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover disabled:opacity-50"
        >
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
      )}
      {message && <p className="text-sm text-text-secondary">{message}</p>}
    </div>
  );
}
