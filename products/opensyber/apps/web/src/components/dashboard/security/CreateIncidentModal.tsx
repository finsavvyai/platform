'use client';

import { useState } from 'react';
import { AlertOctagon, X } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';

export function CreateIncidentModal({ instanceId }: { instanceId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    severity: 'medium',
  });

  async function handleSubmit() {
    if (!form.title.trim()) { setError('Title is required'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/incidents`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(form),
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
        className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 transition"
      >
        <AlertOctagon className="h-4 w-4" />
        Report Incident
      </button>

      {open && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="incident-modal-title"
            tabIndex={-1}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
            className="w-full max-w-md rounded border border-border bg-panel p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="incident-modal-title" className="text-lg font-semibold">Report Incident</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-text-dim hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="incident-title" className="block text-sm text-text-secondary mb-1">Title</label>
                <input
                  id="incident-title"
                  type="text"
                  value={form.title}
                  onChange={(e) => setForm({ ...form, title: e.target.value })}
                  placeholder="e.g. Unauthorized access detected"
                  className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label htmlFor="incident-description" className="block text-sm text-text-secondary mb-1">Description</label>
                <textarea
                  id="incident-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Describe what happened..."
                  rows={3}
                  className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label htmlFor="incident-severity" className="block text-sm text-text-secondary mb-1">Severity</label>
                <select
                  id="incident-severity"
                  value={form.severity}
                  onChange={(e) => setForm({ ...form, severity: e.target.value })}
                  className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
            </div>

            {error && <p role="alert" className="mt-3 text-sm text-red-400">{error}</p>}

            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setOpen(false)} className="rounded-lg border border-wire px-4 py-2 text-sm hover:bg-surface transition">
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Report Incident'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
