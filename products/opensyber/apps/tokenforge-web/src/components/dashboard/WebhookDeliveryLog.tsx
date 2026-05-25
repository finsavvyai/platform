'use client';

import { useState } from 'react';
import { Send, RefreshCw } from 'lucide-react';
import { useApiKey } from '@/lib/use-api';
import {
  fetchWebhookDeliveries,
  sendTestWebhook,
  type WebhookDelivery,
} from '@/lib/tokenforge-api-settings';

interface Props {
  webhookId: string;
}

export function WebhookDeliveryLog({ webhookId }: Props): React.ReactElement {
  const apiKey = useApiKey();
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [loading, setLoading] = useState(false);
  const [testing, setTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function refresh(): Promise<void> {
    if (!apiKey) return;
    setLoading(true);
    setError(null);
    try {
      const list = await fetchWebhookDeliveries(apiKey, webhookId);
      setDeliveries(list);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load deliveries');
    } finally {
      setLoading(false);
    }
  }

  async function sendTest(): Promise<void> {
    if (!apiKey || testing) return;
    setTesting(true);
    setMessage(null);
    setError(null);
    try {
      await sendTestWebhook(apiKey, webhookId);
      setMessage('Test delivery queued — refresh in a moment.');
      setTimeout(refresh, 1500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to queue test');
    } finally {
      setTesting(false);
    }
  }

  return (
    <div className="mt-4 rounded-lg border border-border bg-void/50 p-3 text-xs">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-medium text-text-secondary">Recent deliveries</span>
        <div className="flex gap-2">
          <button
            onClick={sendTest}
            disabled={testing}
            className="inline-flex items-center gap-1 rounded-md border border-wire px-2 py-1 text-text-secondary hover:text-white disabled:opacity-50 transition"
          >
            <Send className="h-3 w-3" />
            {testing ? 'Sending…' : 'Send test event'}
          </button>
          <button
            onClick={refresh}
            disabled={loading}
            className="inline-flex items-center gap-1 rounded-md border border-wire px-2 py-1 text-text-secondary hover:text-white disabled:opacity-50 transition"
          >
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </button>
        </div>
      </div>
      {message && <p className="mb-2 text-green-400">{message}</p>}
      {error && <p className="mb-2 text-red-400">{error}</p>}
      {deliveries.length === 0 ? (
        <p className="text-text-muted">No deliveries yet. Click &ldquo;Send test event&rdquo; to try it out.</p>
      ) : (
        <ul className="-mx-3 divide-y divide-border overflow-x-auto px-3">
          {deliveries.map((d) => (
            <li key={d.id} className="grid min-w-[520px] grid-cols-5 gap-2 py-1.5 font-mono">
              <span className="text-text-secondary">{new Date(d.scheduledAt).toLocaleTimeString()}</span>
              <span className="text-text-primary">{d.event}</span>
              <span className="text-text-secondary">#{d.attempt}</span>
              <span className={d.status && d.status >= 200 && d.status < 300 ? 'text-green-400' : 'text-red-400'}>
                {d.status ?? 'error'}
              </span>
              <span className="truncate text-text-muted" title={d.error ?? ''}>{d.error ?? 'ok'}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
