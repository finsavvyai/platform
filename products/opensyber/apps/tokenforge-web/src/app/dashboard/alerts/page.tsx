'use client';

import { useState, useCallback } from 'react';
import { Bell, Trash2, Plus } from 'lucide-react';
import { useApi, useApiKey } from '@/lib/use-api';
import { fetchAlertRules, createAlertRule, deleteAlertRule } from '@/lib/tokenforge-api';

interface AlertRule {
  id: string;
  name: string;
  condition: string;
  threshold?: number;
  channel: 'email' | 'webhook';
  destination: string;
  createdAt: string;
}

const CONDITIONS = [
  { value: 'hijack_attempt', label: 'Hijack Attempt' },
  { value: 'trust_drop', label: 'Trust Score Drop' },
  { value: 'ip_change', label: 'IP Address Change' },
  { value: 'geo_anomaly', label: 'Geo Anomaly' },
  { value: 'session_revoked', label: 'Session Revoked' },
];

export default function AlertsPage(): React.ReactElement {
  const token = useApiKey();
  const fetcher = useCallback(
    (token: string, signal: AbortSignal) => fetchAlertRules(token, signal),
    [],
  );
  const { data: rules, loading, refetch } = useApi<AlertRule[]>(fetcher);

  const [name, setName] = useState('');
  const [condition, setCondition] = useState('hijack_attempt');
  const [threshold, setThreshold] = useState('');
  const [channel, setChannel] = useState<'email' | 'webhook'>('email');
  const [destination, setDestination] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleCreate(): Promise<void> {
    if (!name || !destination) return;
    setSaving(true);
    try {
      if (!token) return;
      await createAlertRule(token, {
        name,
        condition,
        threshold: threshold ? Number(threshold) : undefined,
        channel,
        destination,
      });
      setName('');
      setThreshold('');
      setDestination('');
      refetch();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!token) return;
    await deleteAlertRule(token, id);
    refetch();
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold">Alert Rules</h1>
        <p className="mt-1 text-sm text-text-secondary">
          Get notified when security events match your conditions
        </p>
      </div>

      {/* Create Rule Form */}
      <div className="mb-8 rounded-2xl border border-border/50 bg-panel p-6">
        <h2 className="mb-4 text-lg font-semibold">New Rule</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <input
            placeholder="Rule name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="rounded-lg border border-border/50 bg-void px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
          />
          <select
            value={condition}
            onChange={(e) => setCondition(e.target.value)}
            className="rounded-lg border border-border/50 bg-void px-3 py-2 text-sm text-text-secondary focus:border-info focus:outline-none"
          >
            {CONDITIONS.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          {condition === 'trust_drop' && (
            <input
              type="number"
              placeholder="Threshold (0-100)"
              value={threshold}
              onChange={(e) => setThreshold(e.target.value)}
              className="rounded-lg border border-border/50 bg-void px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none"
            />
          )}
          <div className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="radio" name="channel" checked={channel === 'email'} onChange={() => setChannel('email')} className="accent-info" />
              Email
            </label>
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input type="radio" name="channel" checked={channel === 'webhook'} onChange={() => setChannel('webhook')} className="accent-info" />
              Webhook
            </label>
          </div>
          <input
            placeholder={channel === 'email' ? 'alert@company.com' : 'https://hooks.example.com/alert'}
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            className="rounded-lg border border-border/50 bg-void px-3 py-2 text-sm text-text-primary placeholder:text-text-muted focus:border-info focus:outline-none sm:col-span-2"
          />
        </div>
        <button
          onClick={handleCreate}
          disabled={saving || !name || !destination}
          className="mt-4 flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-white hover:brightness-110 transition disabled:opacity-50"
        >
          <Plus className="h-4 w-4" />
          {saving ? 'Creating...' : 'Create Rule'}
        </button>
      </div>

      {/* Rules List */}
      {loading ? (
        <div className="h-48 animate-pulse rounded-2xl border border-border/50 bg-panel" />
      ) : !rules || rules.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-border/50 bg-panel/20 p-16 text-center">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl bg-info/10">
            <Bell className="h-8 w-8 text-info" />
          </div>
          <h2 className="mb-2 text-xl font-semibold">No alert rules</h2>
          <p className="max-w-md text-sm text-text-secondary">
            Create your first alert rule above to get notified about security events.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rules.map((rule) => (
            <div key={rule.id} className="flex items-center justify-between rounded-2xl border border-border/50 bg-panel p-4">
              <div>
                <p className="font-medium text-text-primary">{rule.name}</p>
                <p className="mt-1 text-xs text-text-muted">
                  {CONDITIONS.find((c) => c.value === rule.condition)?.label ?? rule.condition}
                  {rule.threshold !== undefined ? ` (< ${rule.threshold})` : ''}
                  {' — '}
                  {rule.channel}: {rule.destination}
                </p>
              </div>
              <button
                onClick={() => handleDelete(rule.id)}
                className="rounded p-2 text-text-muted hover:bg-alert/10 hover:text-alert transition"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
