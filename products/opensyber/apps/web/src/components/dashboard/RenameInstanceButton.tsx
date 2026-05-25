'use client';

import { useState } from 'react';
import { Pencil, Check, X } from 'lucide-react';

export function RenameInstanceButton({
  instanceId,
  currentName,
}: {
  instanceId: string;
  currentName: string;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(currentName);
  const [loading, setLoading] = useState(false);

  async function handleSave() {
    const trimmed = name.trim();
    if (!trimmed || trimmed === currentName) {
      setEditing(false);
      setName(currentName);
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(`/api/proxy/instances/${instanceId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (res.ok) {
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        alert((data as { message?: string }).message ?? 'Rename failed');
      }
    } catch {
      alert('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (editing) {
    return (
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSave();
            if (e.key === 'Escape') { setEditing(false); setName(currentName); }
          }}
          autoFocus
          disabled={loading}
          className="bg-surface border border-neutral-600 rounded-lg px-3 py-1.5 text-sm text-white w-48 focus:outline-none focus:border-signal disabled:opacity-50"
        />
        <button
          onClick={handleSave}
          disabled={loading}
          className="rounded-lg bg-signal p-1.5 text-white hover:bg-signal-hover transition disabled:opacity-50"
          aria-label="Save name"
        >
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
        <button
          onClick={() => { setEditing(false); setName(currentName); }}
          disabled={loading}
          className="rounded-lg border border-wire p-1.5 text-text-secondary hover:bg-surface transition"
          aria-label="Cancel rename"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={() => setEditing(true)}
      className="rounded-lg border border-wire p-1.5 text-text-secondary hover:bg-surface hover:text-white transition"
      title="Rename instance"
      aria-label="Rename instance"
    >
      <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
    </button>
  );
}
