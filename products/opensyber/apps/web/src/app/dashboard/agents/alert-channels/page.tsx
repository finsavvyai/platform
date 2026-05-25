'use client';

import { useEffect, useState } from 'react';
import { Bell, Plus } from 'lucide-react';
import { CreateChannelModal } from './CreateChannelModal';
import { ChannelCard } from './ChannelCard';
import type { AlertChannel } from './alert-channel-types';


export default function AlertChannelsPage() {
  const [channels, setChannels] = useState<AlertChannel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [testing, setTesting] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ channelId: string; success: boolean; message: string } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function loadChannels() {
    setLoading(true);
    fetch('/api/proxy/agents/alert-channels')
      .then((r) => r.json())
      .then((d) => setChannels(d.data ?? []))
      .catch(() => setChannels([]))
      .finally(() => setLoading(false));
  }

  useEffect(() => { loadChannels(); }, []);

  async function toggleActive(channel: AlertChannel) {
    setError(null);
    try {
      const res = await fetch(`/api/proxy/agents/alert-channels/${channel.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !channel.isActive }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function deleteChannel(id: string) {
    if (!confirm('Delete this alert channel? This cannot be undone.')) return;
    setError(null);
    try {
      const res = await fetch(`/api/proxy/agents/alert-channels/${id}`, { method: 'DELETE' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error((body as { message?: string }).message ?? `Failed (${res.status})`);
      }
      loadChannels();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong');
    }
  }

  async function testChannel(id: string) {
    setTesting(id);
    setTestResult(null);
    try {
      const res = await fetch(`/api/proxy/agents/alert-channels/${id}/test`, { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setTestResult({ channelId: id, success: true, message: 'Test alert sent successfully!' });
      } else {
        setTestResult({ channelId: id, success: false, message: data.message ?? 'Failed to send test alert' });
      }
    } catch {
      setTestResult({ channelId: id, success: false, message: 'Network error' });
    } finally {
      setTesting(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-wire border-t-info" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Alert Channels</h1>
          <p className="mt-1 text-sm text-text-secondary">Configure where security alerts are sent</p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="flex items-center gap-2 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition">
          <Plus className="h-4 w-4" />Add Channel
        </button>
      </div>

      {error && <p className="text-sm text-red-400 mt-2 mb-4">{error}</p>}

      {channels.length === 0 ? (
        <div className="rounded border border-border bg-panel/30 p-12 text-center">
          <Bell className="mx-auto mb-4 h-12 w-12 text-text-dim" aria-hidden="true" />
          <p className="text-lg font-medium text-text-secondary">No alert channels configured</p>
          <p className="mt-2 text-sm text-text-dim">Add your first alert channel to start receiving security notifications.</p>
          <button onClick={() => setShowModal(true)}
            className="mt-4 rounded-lg bg-signal px-4 py-2 text-sm font-medium hover:bg-signal-hover transition">
            Add First Channel
          </button>
        </div>
      ) : (
        <div className="space-y-4">
          {channels.map((channel) => (
            <ChannelCard key={channel.id} channel={channel} testing={testing}
              testResult={testResult} onTest={testChannel} onToggle={toggleActive} onDelete={deleteChannel} />
          ))}
        </div>
      )}

      {showModal && <CreateChannelModal onClose={() => setShowModal(false)} onCreated={() => { setShowModal(false); loadChannels(); }} />}
    </div>
  );
}

