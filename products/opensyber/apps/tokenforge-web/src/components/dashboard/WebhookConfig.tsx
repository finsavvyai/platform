'use client';

import { useCallback, useState } from 'react';
import { Plus } from 'lucide-react';
import { useApi, useApiKey } from '@/lib/use-api';
import {
  fetchWebhooks,
  createWebhook,
  updateWebhook,
  deleteWebhook,
  rotateWebhookSecret,
  type Webhook,
} from '@/lib/tokenforge-api-settings';
import { WebhookList } from './WebhookList';
import { WebhookFormModal, SUPPORTED_EVENTS } from './WebhookFormModal';

export function WebhookConfig(): React.ReactElement {
  const token = useApiKey();
  const fetcher = useCallback(
    (t: string, signal: AbortSignal) => fetchWebhooks(t, signal),
    [],
  );
  const { data: webhooks, loading, refetch } = useApi<Webhook[]>(fetcher);

  const [showModal, setShowModal] = useState(false);
  const [creating, setCreating] = useState(false);
  const [formName, setFormName] = useState('');
  const [formUrl, setFormUrl] = useState('');
  const [formEvents, setFormEvents] = useState<string[]>([...SUPPORTED_EVENTS]);
  const [formError, setFormError] = useState('');
  const [revealedSecret, setRevealedSecret] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  function toggleEvent(ev: string): void {
    setFormEvents((prev) =>
      prev.includes(ev) ? prev.filter((e) => e !== ev) : [...prev, ev],
    );
  }

  function resetModal(): void {
    setShowModal(false);
    setFormName('');
    setFormUrl('');
    setFormEvents([...SUPPORTED_EVENTS]);
    setFormError('');
    setRevealedSecret(null);
    setCopied(false);
  }

  async function handleCreate(): Promise<void> {
    if (!token || creating) return;
    if (!formUrl.trim()) {
      setFormError('Endpoint URL is required');
      return;
    }
    if (formEvents.length === 0) {
      setFormError('Select at least one event');
      return;
    }
    setCreating(true);
    setFormError('');
    try {
      const res = await createWebhook(token, {
        name: formName.trim() || undefined,
        endpointUrl: formUrl.trim(),
        events: formEvents,
      });
      setRevealedSecret(res.secret);
      refetch();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to save webhook';
      setFormError(msg);
    } finally {
      setCreating(false);
    }
  }

  async function handleToggle(w: Webhook): Promise<void> {
    if (!token || busyId) return;
    setBusyId(w.id);
    try {
      await updateWebhook(token, w.id, { enabled: !w.enabled });
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to update webhook');
    } finally {
      setBusyId(null);
    }
  }

  async function handleDelete(id: string): Promise<void> {
    if (!token || busyId) return;
    if (!window.confirm('Delete this webhook? This cannot be undone.')) return;
    setBusyId(id);
    try {
      await deleteWebhook(token, id);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to delete webhook');
    } finally {
      setBusyId(null);
    }
  }

  async function handleRotate(id: string): Promise<void> {
    if (!token || busyId) return;
    if (
      !window.confirm(
        'Rotate signing secret? The old secret will stop working immediately.',
      )
    )
      return;
    setBusyId(id);
    try {
      const { secret } = await rotateWebhookSecret(token, id);
      setRevealedSecret(secret);
      setShowModal(true);
      refetch();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Failed to rotate secret');
    } finally {
      setBusyId(null);
    }
  }

  async function handleCopy(): Promise<void> {
    if (!revealedSecret) return;
    await navigator.clipboard.writeText(revealedSecret);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div>
      <WebhookList
        webhooks={webhooks}
        loading={loading}
        busyId={busyId}
        expandedId={expandedId}
        onToggle={handleToggle}
        onRotate={handleRotate}
        onDelete={handleDelete}
        onExpand={(id) => setExpandedId(expandedId === id ? null : id)}
      />
      <button
        onClick={() => setShowModal(true)}
        className="flex items-center gap-2 rounded-lg bg-info px-4 py-2 text-sm font-medium text-void hover:brightness-110 transition"
      >
        <Plus className="h-4 w-4" /> Add Webhook
      </button>
      <WebhookFormModal
        open={showModal}
        formName={formName}
        formUrl={formUrl}
        formEvents={formEvents}
        formError={formError}
        creating={creating}
        revealedSecret={revealedSecret}
        copied={copied}
        onNameChange={setFormName}
        onUrlChange={setFormUrl}
        onToggleEvent={toggleEvent}
        onCancel={resetModal}
        onCreate={handleCreate}
        onCopy={handleCopy}
      />
    </div>
  );
}
