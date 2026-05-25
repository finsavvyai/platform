/**
 * Shared schemas + helpers for the webhook config route.
 *
 * Extracted from `routes/webhooks-config.ts` so the route file stays
 * under the 200-line portfolio cap. Pure: no Hono / no DB I/O —
 * caller wires Zod-validated input into Drizzle queries.
 */

import { z } from 'zod';
import { tfWebhookConfig } from '@opensyber/db';

export const SUPPORTED_EVENTS = [
  'session.bound',
  'session.verified',
  'session.revoked',
  'trust_score.degraded',
  'trust_score.critical',
  'session.hijack_attempt',
  'usage.cap_exceeded',
  'dbsc.risk_signal',
  'dbsc.policy_block',
  'dbsc.session_step_up',
  'dbsc.session_revoked',
] as const;

const eventEnum = z.enum(SUPPORTED_EVENTS);

export const createWebhookSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  endpointUrl: z.string().url(),
  events: z.array(eventEnum).min(1),
  secret: z.string().min(8).max(256).optional(),
});

export const updateWebhookSchema = z.object({
  name: z.string().min(1).max(64).optional(),
  endpointUrl: z.string().url().optional(),
  events: z.array(eventEnum).min(1).optional(),
  enabled: z.boolean().optional(),
});

export type WebhookRow = typeof tfWebhookConfig.$inferSelect;

export interface SerializedWebhook {
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

export function serializeWebhook(row: WebhookRow): SerializedWebhook {
  return {
    id: row.id,
    name: row.name ?? '',
    endpointUrl: row.endpointUrl,
    events: row.events ? row.events.split(',').filter(Boolean) : [],
    enabled: row.enabled === 1,
    lastDeliveryAt: row.lastDeliveryAt ?? null,
    lastDeliveryStatus: row.lastDeliveryStatus ?? null,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt,
  };
}

export function generateWebhookSecret(): string {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes).map((b) => b.toString(16).padStart(2, '0')).join('');
  return `whsec_${hex}`;
}
