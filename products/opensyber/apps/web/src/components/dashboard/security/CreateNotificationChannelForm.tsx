'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import {
  PagerDutyFields, OpsGenieFields, TeamsFields, DiscordFields, buildConfig,
} from './NotificationChannelFields';

export function CreateNotificationChannelForm() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState<Record<string, string>>({
    channelType: 'email', name: '', email: '',
    webhookUrl: '', webhookSecret: '', slackUrl: '',
    pagerdutyKey: '', opsgenieKey: '', opsgenieTeam: '',
    teamsUrl: '', discordUrl: '',
  });

  async function handleSubmit() {
    if (!form.name.trim()) { setError('Name is required'); return; }

    let config: Record<string, string> = {};
    if (form.channelType === 'email') {
      if (!form.email.trim()) { setError('Email is required.'); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setError('Please enter a valid email address.'); return; }
      config = { email: form.email };
    } else if (form.channelType === 'webhook') {
      if (!form.webhookUrl.trim()) { setError('Webhook URL is required'); return; }
      config = { url: form.webhookUrl };
      if (form.webhookSecret) config.secret = form.webhookSecret;
    } else if (form.channelType === 'slack') {
      if (!form.slackUrl.trim()) { setError('Slack webhook URL is required'); return; }
      config = { webhookUrl: form.slackUrl };
    } else {
      const built = buildConfig(form.channelType, form);
      if (!built) { setError('Required fields missing'); return; }
      config = built;
    }

    setLoading(true); setError(null);
    try {
      const res = await fetch('/api/proxy/security/user/notification-channels', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelType: form.channelType, name: form.name, config: JSON.stringify(config) }),
      });
      if (res.ok) { window.location.reload(); }
      else {
        const data = await res.json().catch(() => ({}));
        setError((data as { message?: string }).message ?? 'Failed to create');
      }
    } catch { setError('Network error'); }
    finally { setLoading(false); }
  }

  const inputClass = 'w-full bg-surface border border-wire rounded-lg px-3 py-2 text-sm text-white';

  return (
    <div className="rounded border border-border bg-panel/30 p-6">
      <h3 className="text-base font-semibold mb-4">Add Notification Channel</h3>
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm text-text-secondary mb-1">Type</label>
            <select value={form.channelType} onChange={(e) => setForm({ ...form, channelType: e.target.value })} className={inputClass}>
              <option value="email">Email</option>
              <option value="webhook">Webhook</option>
              <option value="slack">Slack</option>
              <option value="pagerduty">PagerDuty</option>
              <option value="opsgenie">OpsGenie</option>
              <option value="teams">Microsoft Teams</option>
              <option value="discord">Discord</option>
            </select>
          </div>
          <div>
            <label className="block text-sm text-text-secondary mb-1">Name</label>
            <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Team alerts" className={inputClass} />
          </div>
        </div>

        {form.channelType === 'email' && (
          <div>
            <label className="block text-sm text-text-secondary mb-1">Email Address</label>
            <input type="email" value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="alerts@company.com" className={inputClass} />
          </div>
        )}
        {form.channelType === 'webhook' && (
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-text-secondary mb-1">Webhook URL</label>
              <input type="url" value={form.webhookUrl} onChange={(e) => setForm({ ...form, webhookUrl: e.target.value })}
                placeholder="https://example.com/webhook" className={inputClass} />
            </div>
            <div>
              <label className="block text-sm text-text-secondary mb-1">Secret (optional)</label>
              <input type="text" value={form.webhookSecret} onChange={(e) => setForm({ ...form, webhookSecret: e.target.value })}
                placeholder="Signing secret" className={inputClass} />
            </div>
          </div>
        )}
        {form.channelType === 'slack' && (
          <div>
            <label className="block text-sm text-text-secondary mb-1">Slack Webhook URL</label>
            <input type="url" value={form.slackUrl} onChange={(e) => setForm({ ...form, slackUrl: e.target.value })}
              placeholder="https://hooks.slack.com/services/..." className={inputClass} />
          </div>
        )}
        {form.channelType === 'pagerduty' && <PagerDutyFields form={form} setForm={setForm} />}
        {form.channelType === 'opsgenie' && <OpsGenieFields form={form} setForm={setForm} />}
        {form.channelType === 'teams' && <TeamsFields form={form} setForm={setForm} />}
        {form.channelType === 'discord' && <DiscordFields form={form} setForm={setForm} />}

        {error && <p className="text-sm text-red-400">{error}</p>}
        <button onClick={handleSubmit} disabled={loading}
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium text-white hover:bg-signal-hover transition disabled:opacity-50">
          <Plus className="h-4 w-4" />
          {loading ? 'Adding...' : 'Add Channel'}
        </button>
      </div>
    </div>
  );
}
