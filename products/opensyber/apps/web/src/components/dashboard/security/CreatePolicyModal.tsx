'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';

const POLICY_TYPES = [
  { value: 'network_allowlist', label: 'Network Allowlist' },
  { value: 'network_blocklist', label: 'Network Blocklist' },
  { value: 'file_path_rules', label: 'File Path Rules' },
  { value: 'shell_command_rules', label: 'Shell Command Rules' },
  { value: 'ip_allowlist', label: 'IP Allowlist' },
  { value: 'rate_limit', label: 'Rate Limit' },
];

export function CreatePolicyModal({ instanceId }: { instanceId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    policyType: 'network_allowlist',
    name: '',
    rules: '',
    isActive: true,
  });

  async function handleSubmit() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    if (!form.rules.trim()) { setError('Rules are required'); return; }
    try {
      JSON.parse(form.rules);
    } catch {
      setError('Rules must be valid JSON');
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/policies`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            policyType: form.policyType,
            name: form.name,
            rules: form.rules,
            isActive: form.isActive,
          }),
        },
      );
      if (res.ok) {
        setOpen(false);
        window.location.reload();
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? 'Failed to create');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition"
      >
        <Plus className="h-4 w-4" />
        New Policy
      </button>

      {open && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div className="w-full max-w-md rounded border border-border bg-panel p-6 shadow-xl">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-semibold">Create Security Policy</h2>
              <button onClick={() => setOpen(false)} className="text-text-dim hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm text-text-secondary mb-1">Policy Type</label>
                <select
                  value={form.policyType}
                  onChange={(e) => setForm({ ...form, policyType: e.target.value })}
                  className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                >
                  {POLICY_TYPES.map((t) => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Name</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Block malicious domains"
                  className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label className="block text-sm text-text-secondary mb-1">Rules (JSON)</label>
                <textarea
                  value={form.rules}
                  onChange={(e) => setForm({ ...form, rules: e.target.value })}
                  placeholder='["*.example.com", "api.openai.com"]'
                  rows={4}
                  className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white font-mono"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={form.isActive}
                  onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                  className="rounded border-wire"
                />
                <span className="text-text-primary">Active</span>
              </label>
            </div>

            {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-wire px-4 py-2 text-sm hover:bg-surface transition">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Policy'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
