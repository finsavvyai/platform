'use client';

import { Trash2, RotateCw, ChevronDown, ChevronRight } from 'lucide-react';
import { WebhookDeliveryLog } from './WebhookDeliveryLog';
import type { Webhook } from '@/lib/tokenforge-api-settings';

interface WebhookListProps {
  webhooks: Webhook[] | null;
  loading: boolean;
  busyId: string | null;
  expandedId: string | null;
  onToggle: (w: Webhook) => void;
  onRotate: (id: string) => void;
  onDelete: (id: string) => void;
  onExpand: (id: string) => void;
}

export function WebhookList(props: WebhookListProps): React.ReactElement {
  const { webhooks, loading, busyId, expandedId, onToggle, onRotate, onDelete, onExpand } = props;

  if (loading) {
    return <div className="h-24 animate-pulse rounded-lg bg-surface/30" />;
  }

  return (
    <div className="mb-4 divide-y divide-border rounded-lg border border-border">
      {!webhooks || webhooks.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-text-muted">
          No webhooks configured yet.
        </p>
      ) : (
        webhooks.map((w) => (
          <div key={w.id} className="flex flex-col gap-2 px-4 py-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="truncate font-medium text-text-primary">
                    {w.name || w.endpointUrl}
                  </span>
                  <span
                    className={`rounded px-2 py-0.5 text-xs ${
                      w.enabled ? 'bg-ok/20 text-ok' : 'bg-wire text-text-muted'
                    }`}
                  >
                    {w.enabled ? 'enabled' : 'disabled'}
                  </span>
                </div>
                <p className="truncate font-mono text-xs text-text-muted">{w.endpointUrl}</p>
                <p className="mt-1 text-xs text-text-secondary">
                  {w.events.length} event{w.events.length === 1 ? '' : 's'}
                  {w.lastDeliveryAt && (
                    <>
                      {' '}
                      · last delivery {new Date(w.lastDeliveryAt).toLocaleString()}
                      {w.lastDeliveryStatus != null && ` (${w.lastDeliveryStatus})`}
                    </>
                  )}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onExpand(w.id)}
                  title="Deliveries"
                  className="rounded-lg border border-wire px-2 py-1.5 text-text-secondary hover:text-text-primary"
                >
                  {expandedId === w.id ? (
                    <ChevronDown className="h-4 w-4" />
                  ) : (
                    <ChevronRight className="h-4 w-4" />
                  )}
                </button>
                <button
                  onClick={() => onToggle(w)}
                  disabled={busyId === w.id}
                  className="rounded-lg border border-wire px-3 py-1.5 text-xs text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  {w.enabled ? 'Disable' : 'Enable'}
                </button>
                <button
                  onClick={() => onRotate(w.id)}
                  disabled={busyId === w.id}
                  title="Rotate secret"
                  className="rounded-lg border border-wire px-2 py-1.5 text-text-secondary hover:text-text-primary disabled:opacity-50"
                >
                  <RotateCw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => onDelete(w.id)}
                  disabled={busyId === w.id}
                  title="Delete"
                  className="rounded-lg border border-wire px-2 py-1.5 text-alert hover:brightness-125 disabled:opacity-50"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
            {expandedId === w.id && <WebhookDeliveryLog webhookId={w.id} />}
          </div>
        ))
      )}
    </div>
  );
}
