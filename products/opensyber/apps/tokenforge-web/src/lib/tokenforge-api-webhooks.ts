import { apiFetch } from './tokenforge-api';

export interface Webhook {
  id: string;
  name: string;
  endpointUrl: string;
  events: string[];
  enabled: boolean;
  lastDeliveryAt: string | null;
  lastDeliveryStatus: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface WebhookCreateResponse extends Webhook {
  /** Freshly-minted signing secret — returned once at creation. */
  secret: string;
}

export interface WebhookDelivery {
  id: string;
  event: string;
  attempt: number;
  status: number | null;
  error: string | null;
  scheduledAt: string;
  deliveredAt: string | null;
  nextRetryAt: string | null;
}

export async function fetchWebhooks(
  token: string,
  signal?: AbortSignal,
): Promise<Webhook[]> {
  const res = await apiFetch<{ data: Webhook[] }>('/v1/webhooks', token, { signal });
  return res.data;
}

export async function createWebhook(
  token: string,
  input: { name?: string; endpointUrl: string; events: string[]; secret?: string },
): Promise<WebhookCreateResponse> {
  const res = await apiFetch<{ data: WebhookCreateResponse }>('/v1/webhooks', token, {
    method: 'POST',
    body: input,
  });
  return res.data;
}

export async function updateWebhook(
  token: string,
  id: string,
  patch: { name?: string; endpointUrl?: string; events?: string[]; enabled?: boolean },
): Promise<Webhook> {
  const res = await apiFetch<{ data: Webhook }>(`/v1/webhooks/${id}`, token, {
    method: 'PATCH',
    body: patch,
  });
  return res.data;
}

export async function deleteWebhook(token: string, id: string): Promise<void> {
  await apiFetch(`/v1/webhooks/${id}`, token, { method: 'DELETE' });
}

export async function rotateWebhookSecret(
  token: string,
  id: string,
): Promise<{ id: string; secret: string; gracePeriodEndsAt: string | null }> {
  const res = await apiFetch<{
    data: { id: string; secret: string; gracePeriodEndsAt: string | null };
  }>(`/v1/webhooks/${id}/rotate`, token, { method: 'POST' });
  return res.data;
}

export async function sendTestWebhook(token: string, id: string): Promise<void> {
  await apiFetch(`/v1/webhooks/${id}/test`, token, { method: 'POST' });
}

export async function fetchWebhookDeliveries(
  token: string,
  id: string,
  signal?: AbortSignal,
): Promise<WebhookDelivery[]> {
  const res = await apiFetch<{ data: WebhookDelivery[] }>(
    `/v1/webhooks/${id}/deliveries`,
    token,
    { signal },
  );
  return res.data;
}
