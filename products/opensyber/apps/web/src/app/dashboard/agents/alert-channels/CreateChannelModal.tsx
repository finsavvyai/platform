'use client';

import { useState } from 'react';
import { Portal } from '@/components/ui/Portal';
import {
  CHANNEL_LABELS,
  CHANNEL_ICONS,
  type AlertChannelType,
  type AlertSeverity,
} from './alert-channel-types';

const typeConfig: Record<AlertChannelType, { fields: Array<{ key: string; label: string; type: 'text' | 'email' | 'url' | 'textarea' }> }> = {
  email: {
    fields: [
      { key: 'to', label: 'Recipient Emails (comma-separated)', type: 'text' },
      { key: 'from', label: 'From Email (optional)', type: 'email' },
    ],
  },
  slack: {
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url' },
      { key: 'channel', label: 'Channel (optional)', type: 'text' },
    ],
  },
  pagerduty: {
    fields: [
      { key: 'integrationKey', label: 'Integration Key', type: 'text' },
      { key: 'region', label: 'Region (us or eu)', type: 'text' },
    ],
  },
  opsgenie: {
    fields: [
      { key: 'apiKey', label: 'API Key', type: 'text' },
      { key: 'region', label: 'Region (us or eu)', type: 'text' },
    ],
  },
  teams: {
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url' },
    ],
  },
  discord: {
    fields: [
      { key: 'webhookUrl', label: 'Webhook URL', type: 'url' },
      { key: 'username', label: 'Bot Username (optional)', type: 'text' },
      { key: 'avatarUrl', label: 'Avatar URL (optional)', type: 'url' },
    ],
  },
};

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function CreateChannelModal({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<'type' | 'config'>('type');
  const [channelType, setChannelType] = useState<AlertChannelType>('email');
  const [name, setName] = useState('');
  const [minSeverity, setMinSeverity] = useState<AlertSeverity>('medium');
  const [config, setConfig] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      // Normalize email 'to' field: split comma-separated string into array
      const processedConfig = channelType === 'email' && typeof config.to === 'string'
        ? { ...config, to: (config.to as string).split(',').map((s) => s.trim()).filter(Boolean) }
        : config;
      const res = await fetch('/api/proxy/agents/alert-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          channelType,
          name: name || `${CHANNEL_LABELS[channelType]} Channel`,
          config: { [channelType]: processedConfig },
          minSeverity,
          isActive: true,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? 'Failed to create channel');
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error');
      setLoading(false);
    }
  }

  return (
    <Portal>
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="channel-modal-title"
        tabIndex={-1}
        onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
        className="w-full max-w-md rounded border border-border bg-panel p-6"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-6 flex items-center justify-between">
          <h2 id="channel-modal-title" className="text-xl font-semibold">Add Alert Channel</h2>
          <button onClick={onClose} aria-label="Close dialog" className="text-text-secondary hover:text-white">&#x2715;</button>
        </div>

        {step === 'type' ? (
          <div>
            <p className="mb-4 text-sm text-text-secondary">Select the type of alert channel you want to add:</p>
            <div className="space-y-2">
              {Object.entries(CHANNEL_LABELS).map(([type, label]) => (
                <button key={type}
                  onClick={() => { setChannelType(type as AlertChannelType); setStep('config'); }}
                  className="w-full rounded-lg border border-border bg-panel/30 p-4 text-left hover:border-wire transition">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-surface p-2 text-text-secondary">
                      {CHANNEL_ICONS[type as AlertChannelType]}
                    </div>
                    <span className="font-medium">{label}</span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <button type="button" onClick={() => setStep('type')} className="mb-4 text-sm text-text-secondary hover:text-white">
              &#x2190; Back to channel types
            </button>
            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium">Channel Name</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  placeholder={`${CHANNEL_LABELS[channelType]} Channel`}
                  className="w-full rounded-lg border border-border bg-void px-3 py-2 text-sm focus:border-signal focus:outline-none" />
              </div>
              <div>
                <label className="mb-1 block text-sm font-medium">Minimum Severity</label>
                <select value={minSeverity} onChange={(e) => setMinSeverity(e.target.value as AlertSeverity)}
                  className="w-full rounded-lg border border-border bg-void px-3 py-2 text-sm focus:border-signal focus:outline-none">
                  <option value="critical">Critical</option>
                  <option value="high">High</option>
                  <option value="medium">Medium</option>
                  <option value="low">Low</option>
                </select>
              </div>
              <div className="space-y-3">
                {typeConfig[channelType].fields.map((field) => (
                  <div key={field.key}>
                    <label className="mb-1 block text-sm font-medium">{field.label}</label>
                    {field.type === 'textarea' ? (
                      <textarea value={(config[field.key] as string) ?? ''}
                        onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })} rows={3}
                        className="w-full rounded-lg border border-border bg-void px-3 py-2 text-sm focus:border-signal focus:outline-none" />
                    ) : (
                      <input type={field.type} value={(config[field.key] as string) ?? ''}
                        onChange={(e) => setConfig({ ...config, [field.key]: e.target.value })}
                        placeholder={field.label}
                        className="w-full rounded-lg border border-border bg-void px-3 py-2 text-sm focus:border-signal focus:outline-none" />
                    )}
                  </div>
                ))}
              </div>
              {error && (
                <div role="alert" className="rounded-lg bg-red-500/10 border border-red-500/20 px-3 py-2 text-sm text-red-400">{error}</div>
              )}
              <div className="flex gap-2">
                <button type="button" onClick={onClose} disabled={loading}
                  className="flex-1 rounded-lg border border-border px-4 py-2 text-sm font-medium text-text-secondary hover:bg-surface transition disabled:opacity-50">
                  Cancel
                </button>
                <button type="submit" disabled={loading}
                  className="flex-1 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition disabled:opacity-50">
                  {loading ? 'Creating...' : 'Create Channel'}
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
    </Portal>
  );
}
