'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Portal } from '@/components/ui/Portal';

const EVENT_TYPES = [
  'brute_force_attempt', 'unauthorized_access', 'credential_access',
  'suspicious_shell_command', 'policy_violation', 'file_integrity_change',
  'network_anomaly', 'privilege_escalation', 'malware_detected', 'data_exfiltration',
];

export function CreateAlertRuleModal({ instanceId }: { instanceId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: '',
    eventType: EVENT_TYPES[0],
    severityFilter: '',
    threshold: 1,
    windowMinutes: 60,
    cooldownMinutes: 30,
  });

  async function handleSubmit() {
    if (!form.name.trim()) { setError('Name is required'); return; }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/proxy/security/instances/${instanceId}/alert-rules`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: form.name,
            eventType: form.eventType,
            severityFilter: form.severityFilter || null,
            threshold: form.threshold,
            windowMinutes: form.windowMinutes,
            cooldownMinutes: form.cooldownMinutes,
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
        New Rule
      </button>

      {open && (
        <Portal>
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="alert-rule-modal-title"
            tabIndex={-1}
            onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
            className="w-full max-w-md rounded border border-border bg-panel p-6 shadow-xl"
          >
            <div className="mb-4 flex items-center justify-between">
              <h2 id="alert-rule-modal-title" className="text-lg font-semibold">Create Alert Rule</h2>
              <button onClick={() => setOpen(false)} aria-label="Close" className="text-text-dim hover:text-white">
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label htmlFor="alert-name" className="block text-sm text-text-secondary mb-1">Name</label>
                <input
                  id="alert-name"
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. Brute force detector"
                  className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                />
              </div>
              <div>
                <label htmlFor="alert-event-type" className="block text-sm text-text-secondary mb-1">Event Type</label>
                <select
                  id="alert-event-type"
                  value={form.eventType}
                  onChange={(e) => setForm({ ...form, eventType: e.target.value })}
                  className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                >
                  {EVENT_TYPES.map((t) => (
                    <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="alert-severity-filter" className="block text-sm text-text-secondary mb-1">Severity Filter</label>
                <select
                  id="alert-severity-filter"
                  value={form.severityFilter}
                  onChange={(e) => setForm({ ...form, severityFilter: e.target.value })}
                  className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                >
                  <option value="">Any severity</option>
                  <option value="info">Info</option>
                  <option value="warning">Warning</option>
                  <option value="critical">Critical</option>
                </select>
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label htmlFor="alert-threshold" className="block text-sm text-text-secondary mb-1">Threshold</label>
                  <input
                    id="alert-threshold"
                    type="number"
                    min={1}
                    value={form.threshold}
                    onChange={(e) => setForm({ ...form, threshold: parseInt(e.target.value) || 1 })}
                    className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label htmlFor="alert-window" className="block text-sm text-text-secondary mb-1">Window (min)</label>
                  <input
                    id="alert-window"
                    type="number"
                    min={1}
                    value={form.windowMinutes}
                    onChange={(e) => setForm({ ...form, windowMinutes: parseInt(e.target.value) || 60 })}
                    className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
                <div>
                  <label htmlFor="alert-cooldown" className="block text-sm text-text-secondary mb-1">Cooldown (min)</label>
                  <input
                    id="alert-cooldown"
                    type="number"
                    min={1}
                    value={form.cooldownMinutes}
                    onChange={(e) => setForm({ ...form, cooldownMinutes: parseInt(e.target.value) || 30 })}
                    className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white"
                  />
                </div>
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
                className="rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Create Rule'}
              </button>
            </div>
          </div>
        </div>
        </Portal>
      )}
    </>
  );
}
