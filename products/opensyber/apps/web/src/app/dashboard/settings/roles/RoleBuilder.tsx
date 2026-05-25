'use client';

import { useState, useCallback } from 'react';
import { PERMISSION_CATEGORIES } from '@opensyber/shared';

interface RoleBuilderProps {
  orgId: string;
}

export function RoleBuilder({ orgId }: RoleBuilderProps) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const toggle = useCallback((perm: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }, []);

  const toggleCategory = useCallback((perms: readonly string[]) => {
    setSelected((prev) => {
      const next = new Set(prev);
      const allSelected = perms.every((p) => next.has(p));
      if (allSelected) {
        perms.forEach((p) => next.delete(p));
      } else {
        perms.forEach((p) => next.add(p));
      }
      return next;
    });
  }, []);

  const handleSubmit = async () => {
    if (!name.trim()) { setError('Name is required'); return; }
    if (selected.size === 0) { setError('Select at least one permission'); return; }

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/organizations/${orgId}/roles`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || undefined,
          permissions: Array.from(selected),
        }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message ?? 'Failed to create role');
      }
      setSuccess(true);
      setName('');
      setDescription('');
      setSelected(new Set());
      setTimeout(() => { setSuccess(false); setOpen(false); window.location.reload(); }, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
    } finally {
      setLoading(false);
    }
  };

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 rounded-lg bg-teal-500/20 text-teal-400 text-sm font-medium
                   hover:bg-teal-500/30 transition-colors"
      >
        + Create Custom Role
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] p-6 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-semibold text-white">Create Custom Role</h3>
        <button onClick={() => setOpen(false)} className="text-gray-500 hover:text-white text-sm">
          Cancel
        </button>
      </div>

      {/* Name & Description */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-xs text-gray-400 mb-1">Role Name</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            maxLength={50}
            placeholder="e.g. Security Lead"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10
                       text-white text-sm placeholder:text-gray-600 focus:border-teal-500/50
                       focus:outline-none"
          />
        </div>
        <div>
          <label className="block text-xs text-gray-400 mb-1">Description (optional)</label>
          <input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            maxLength={500}
            placeholder="What this role is for"
            className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10
                       text-white text-sm placeholder:text-gray-600 focus:border-teal-500/50
                       focus:outline-none"
          />
        </div>
      </div>

      {/* Permission Matrix */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <label className="text-xs text-gray-400">
            Permissions ({selected.size} selected)
          </label>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(PERMISSION_CATEGORIES).map(([category, perms]) => {
            const allChecked = perms.every((p) => selected.has(p));
            return (
              <div key={category} className="rounded-lg border border-white/5 bg-white/[0.02] p-3">
                <label className="flex items-center gap-2 mb-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={allChecked}
                    onChange={() => toggleCategory(perms)}
                    className="rounded accent-teal-500"
                  />
                  <span className="text-sm font-medium text-white">{category}</span>
                </label>
                <div className="space-y-1 ml-5">
                  {perms.map((perm) => (
                    <label key={perm} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={selected.has(perm)}
                        onChange={() => toggle(perm)}
                        className="rounded accent-teal-500"
                      />
                      <span className="text-xs text-gray-400">{perm}</span>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Actions */}
      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm text-teal-400">Role created successfully!</p>}
      <div className="flex gap-3">
        <button
          onClick={handleSubmit}
          disabled={loading}
          className="px-4 py-2 rounded-lg bg-teal-500 text-black text-sm font-medium
                     hover:bg-teal-400 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Creating...' : 'Create Role'}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="px-4 py-2 rounded-lg border border-white/10 text-gray-400
                     text-sm hover:text-white transition-colors"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
