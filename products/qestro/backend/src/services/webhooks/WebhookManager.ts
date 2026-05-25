'use strict';

import crypto from 'crypto';
import { WebhookConfig, WebhookEvent, WebhookDelivery, WebhookEventType } from './types.js';
import { WebhookDeliveryService } from './WebhookDeliveryService.js';
import { logger } from '../../utils/logger.js';

/**
 * Webhook Manager Service
 * Manages webhook registration, event emission, and delivery history
 */
export class WebhookManager {
  private deliveryService: WebhookDeliveryService;
  private webhooks: Map<string, WebhookConfig>;
  private deliveryHistory: Map<string, WebhookDelivery[]>;
  private deliveryQueue: Array<{
    webhook: WebhookConfig;
    event: WebhookEvent;
    attempt: number;
  }>;

  constructor() {
    this.deliveryService = new WebhookDeliveryService();
    this.webhooks = new Map();
    this.deliveryHistory = new Map();
    this.deliveryQueue = [];
    this.startDeliveryWorker();
  }

  /**
   * Register a new webhook
   */
  async registerWebhook(
    projectId: string,
    url: string,
    events: WebhookEventType[],
    userId: string,
    options?: {
      secret?: string;
      maxRetries?: number;
      retryDelay?: number;
      timeout?: number;
      headers?: Record<string, string>;
    }
  ): Promise<string> {
    // Validate URL
    try {
      new URL(url);
    } catch {
      throw new Error('Invalid webhook URL');
    }

    if (events.length === 0) {
      throw new Error('At least one event type must be specified');
    }

    const webhookId = crypto.randomUUID();
    const secret = options?.secret || crypto.randomBytes(32).toString('hex');

    const config: WebhookConfig = {
      id: webhookId,
      projectId,
      url,
      secret,
      events,
      active: true,
      maxRetries: options?.maxRetries ?? 3,
      retryDelay: options?.retryDelay ?? 5000,
      timeout: options?.timeout ?? 30000,
      headers: options?.headers,
      createdAt: new Date(),
      updatedAt: new Date(),
      createdBy: userId,
    };

    this.webhooks.set(webhookId, config);
    this.deliveryHistory.set(webhookId, []);

    logger.info(`Webhook registered: ${webhookId} for project ${projectId}`);
    return webhookId;
  }

  /**
   * Remove a webhook
   */
  async removeWebhook(webhookId: string): Promise<void> {
    if (!this.webhooks.has(webhookId)) {
      throw new Error('Webhook not found');
    }

    this.webhooks.delete(webhookId);
    this.deliveryHistory.delete(webhookId);
    logger.info(`Webhook removed: ${webhookId}`);
  }

  /**
   * List all webhooks for a project
   */
  async listWebhooks(projectId: string): Promise<WebhookConfig[]> {
    return Array.from(this.webhooks.values()).filter(
      (wh) => wh.projectId === projectId
    );
  }

  /**
   * Emit a webhook event
   */
  async emit(event: WebhookEvent): Promise<void> {
    const matchingWebhooks = Array.from(this.webhooks.values()).filter(
      (wh) => wh.projectId === event.projectId && wh.active && wh.events.includes(event.type)
    );

    logger.info(
      `Emitting event ${event.type} to ${matchingWebhooks.length} webhooks`
    );

    // Queue deliveries
    for (const webhook of matchingWebhooks) {
      this.deliveryQueue.push({
        webhook,
        event,
        attempt: 1,
      });
    }
  }

  /**
   * Get delivery history for a webhook
   */
  async getDeliveryHistory(
    webhookId: string,
    limit: number = 100
  ): Promise<WebhookDelivery[]> {
    const history = this.deliveryHistory.get(webhookId) || [];
    return history.slice(-limit).reverse();
  }

  /**
   * Get delivery statistics
   */
  async getDeliveryStats(webhookId: string): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    pending: number;
    successRate: number;
  }> {
    const history = this.deliveryHistory.get(webhookId) || [];
    const succeeded = history.filter((d) => d.status === 'success').length;
    const failed = history.filter((d) => d.status === 'failed').length;
    const pending = history.filter((d) => d.status === 'retrying').length;

    return {
      total: history.length,
      succeeded,
      failed,
      pending,
      successRate: history.length > 0 ? (succeeded / history.length) * 100 : 0,
    };
  }

  /**
   * Deactivate a webhook
   */
  async deactivateWebhook(webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }
    webhook.active = false;
    webhook.updatedAt = new Date();
  }

  /**
   * Activate a webhook
   */
  async activateWebhook(webhookId: string): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }
    webhook.active = true;
    webhook.updatedAt = new Date();
  }

  /**
   * Process delivery queue with exponential backoff
   */
  private startDeliveryWorker(): void {
    setInterval(async () => {
      if (this.deliveryQueue.length === 0) return;

      const item = this.deliveryQueue.shift();
      if (!item) return;

      const { webhook, event, attempt } = item;

      const delivery = await this.deliveryService.deliver(webhook, event, attempt);

      // Store delivery history
      const history = this.deliveryHistory.get(webhook.id) || [];
      history.push(delivery);
      this.deliveryHistory.set(webhook.id, history);

      // Requeue if failed and retries remain
      if (
        delivery.status === 'retrying' &&
        attempt < webhook.maxRetries
      ) {
        const delay = webhook.retryDelay * Math.pow(2, attempt - 1);
        setTimeout(() => {
          this.deliveryQueue.push({
            webhook,
            event,
            attempt: attempt + 1,
          });
        }, delay);
      }
    }, 1000);
  }

  /**
   * Get webhook by ID
   */
  getWebhook(webhookId: string): WebhookConfig | undefined {
    return this.webhooks.get(webhookId);
  }

  /**
   * Update webhook configuration
   */
  async updateWebhook(webhookId: string, updates: Partial<WebhookConfig>): Promise<void> {
    const webhook = this.webhooks.get(webhookId);
    if (!webhook) {
      throw new Error('Webhook not found');
    }

    Object.assign(webhook, updates, { updatedAt: new Date() });
    logger.info(`Webhook updated: ${webhookId}`);
  }
}
