/**
 * Webhook config store — DI'd surface for webhook CRUD and dispatch
 * lookups. Phase 7 ships an in-memory adapter; Phase 7.1 swaps to D1.
 */

import { randomB64Url } from '../../lib/ids.js';

export type WebhookEvent =
  | 'risk_signal'
  | 'session_revoked'
  | 'session_register'
  | 'refresh_failed';

export interface WebhookConfig {
  id: string;
  appId: string;
  url: string;
  secret: string;
  events: WebhookEvent[];
  enabled: boolean;
  createdAt: Date;
}

export interface NewWebhookConfig {
  appId: string;
  url: string;
  events: WebhookEvent[];
}

export interface WebhookStore {
  insert(input: NewWebhookConfig): Promise<WebhookConfig>;
  get(id: string): Promise<WebhookConfig | null>;
  listForApp(appId: string): Promise<WebhookConfig[]>;
  setEnabled(id: string, enabled: boolean): Promise<void>;
  delete(id: string): Promise<void>;
}

export class InMemoryWebhookStore implements WebhookStore {
  rows = new Map<string, WebhookConfig>();

  async insert(input: NewWebhookConfig): Promise<WebhookConfig> {
    const row: WebhookConfig = {
      id: `whk_${randomB64Url(18)}`,
      appId: input.appId,
      url: input.url,
      secret: `whsec_${randomB64Url(32)}`,
      events: input.events,
      enabled: true,
      createdAt: new Date(),
    };
    this.rows.set(row.id, row);
    return row;
  }

  async get(id: string) {
    return this.rows.get(id) ?? null;
  }

  async listForApp(appId: string) {
    return [...this.rows.values()].filter((w) => w.appId === appId);
  }

  async setEnabled(id: string, enabled: boolean) {
    const row = this.rows.get(id);
    if (row) row.enabled = enabled;
  }

  async delete(id: string) {
    this.rows.delete(id);
  }
}
