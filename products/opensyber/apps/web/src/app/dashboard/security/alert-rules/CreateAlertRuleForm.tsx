'use client';

import { useState } from 'react';
import { Plus, Check, AlertCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

const EVENT_TYPES = [
  { value: 'file_access', label: 'File Access' },
  { value: 'network_anomaly', label: 'Network Anomaly' },
  { value: 'credential_access', label: 'Credential Access' },
  { value: 'process_execution', label: 'Process Execution' },
  { value: 'supply_chain', label: 'Supply Chain' },
  { value: 'privilege_escalation', label: 'Privilege Escalation' },
];

const SEVERITIES = [
  { value: 'critical', label: 'Critical' },
  { value: 'high', label: 'High' },
  { value: 'medium', label: 'Medium' },
  { value: 'low', label: 'Low' },
];

export function CreateAlertRuleForm({ instanceId }: { instanceId: string }) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [eventType, setEventType] = useState('file_access');
  const [severity, setSeverity] = useState('high');
  const [threshold, setThreshold] = useState(1);
  const [windowMinutes, setWindowMinutes] = useState(60);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/proxy/security/instances/${instanceId}/alert-rules`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          eventType,
          severityFilter: severity,
          threshold,
          windowMinutes,
          cooldownMinutes: 30,
        }),
      });
      if (res.ok) {
        setSuccess(true);
        setName('');
        setTimeout(() => {
          setSuccess(false);
          setOpen(false);
          router.refresh();
        }, 1500);
      } else {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? 'Failed to create rule');
      }
    } catch {
      setError('Network error');
    } finally {
      setLoading(false);
    }
  }

  if (!open) {
    return (
      <div className="mb-6">
        <button
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-lg bg-signal px-4 py-2.5 text-sm font-medium text-white hover:bg-signal-hover transition"
        >
          <Plus className="h-4 w-4" />
          Create Alert Rule
        </button>
      </div>
    );
  }

  return (
    <div className="mb-6 rounded border border-border bg-panel/30 p-6">
      <h3 className="text-base font-semibold mb-4">New Alert Rule</h3>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm text-text-secondary mb-1">Rule Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g., Critical file access alert"
            className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Event Type</label>
            <select
              value={eventType}
              onChange={(e) => setEventType(e.target.value)}
              className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm"
            >
              {EVENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Min Severity</label>
            <select
              value={severity}
              onChange={(e) => setSeverity(e.target.value)}
              className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm"
            >
              {SEVERITIES.map((s) => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Threshold (events)</label>
            <input
              type="number"
              min={1}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Time Window (minutes)</label>
            <input
              type="number"
              min={1}
              value={windowMinutes}
              onChange={(e) => setWindowMinutes(Number(e.target.value))}
              className="w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm"
            />
          </div>
        </div>

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-400">
            <AlertCircle className="h-3.5 w-3.5" /> {error}
          </div>
        )}

        {success && (
          <div className="flex items-center gap-2 rounded-lg border border-green-500/30 bg-green-500/10 px-3 py-2 text-xs text-green-400">
            <Check className="h-3.5 w-3.5" /> Alert rule created!
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={loading || !name.trim()}
            className="rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition disabled:opacity-50"
          >
            {loading ? 'Creating...' : 'Create Rule'}
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            className="rounded-lg border border-wire px-4 py-2 text-sm hover:bg-surface transition"
          >
            Cancel
          </button>
        </div>
      </form>
    </div>
  );
}
