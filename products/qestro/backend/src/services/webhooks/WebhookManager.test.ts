'use strict';

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookManager } from './WebhookManager.js';
import { WebhookEventType } from './types.js';
import crypto from 'crypto';

describe('WebhookManager', () => {
  let manager: WebhookManager;

  beforeEach(() => {
    manager = new WebhookManager();
  });

  describe('registerWebhook', () => {
    it('should register a webhook and return ID', async () => {
      const id = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook',
        ['test.completed'],
        'user-123'
      );

      expect(id).toBeDefined();
      expect(id).toMatch(/^[a-f0-9-]{36}$/);
    });

    it('should throw on invalid URL', async () => {
      await expect(
        manager.registerWebhook(
          'proj-123',
          'not-a-url',
          ['test.completed'],
          'user-123'
        )
      ).rejects.toThrow('Invalid webhook URL');
    });

    it('should throw on empty events', async () => {
      await expect(
        manager.registerWebhook(
          'proj-123',
          'https://example.com/webhook',
          [],
          'user-123'
        )
      ).rejects.toThrow('At least one event type must be specified');
    });

    it('should accept custom secret', async () => {
      const customSecret = 'my-custom-secret';
      const id = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook',
        ['test.completed'],
        'user-123',
        { secret: customSecret }
      );

      const webhook = manager.getWebhook(id);
      expect(webhook?.secret).toBe(customSecret);
    });

    it('should generate secret if not provided', async () => {
      const id = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook',
        ['test.completed'],
        'user-123'
      );

      const webhook = manager.getWebhook(id);
      expect(webhook?.secret).toBeDefined();
      expect(webhook?.secret.length).toBeGreaterThan(20);
    });
  });

  describe('removeWebhook', () => {
    it('should remove a webhook', async () => {
      const id = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook',
        ['test.completed'],
        'user-123'
      );

      await manager.removeWebhook(id);
      expect(manager.getWebhook(id)).toBeUndefined();
    });

    it('should throw on non-existent webhook', async () => {
      await expect(
        manager.removeWebhook('fake-id')
      ).rejects.toThrow('Webhook not found');
    });
  });

  describe('listWebhooks', () => {
    it('should list webhooks by project', async () => {
      const id1 = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook1',
        ['test.completed'],
        'user-123'
      );

      const id2 = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook2',
        ['test.failed'],
        'user-123'
      );

      const id3 = await manager.registerWebhook(
        'proj-456',
        'https://example.com/webhook3',
        ['run.started'],
        'user-123'
      );

      const list = await manager.listWebhooks('proj-123');
      expect(list).toHaveLength(2);
      expect(list.map((w) => w.id)).toContain(id1);
      expect(list.map((w) => w.id)).toContain(id2);
    });

    it('should return empty array for project with no webhooks', async () => {
      const list = await manager.listWebhooks('proj-xyz');
      expect(list).toEqual([]);
    });
  });

  describe('deactivateWebhook', () => {
    it('should deactivate a webhook', async () => {
      const id = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook',
        ['test.completed'],
        'user-123'
      );

      await manager.deactivateWebhook(id);

      const webhook = manager.getWebhook(id);
      expect(webhook?.active).toBe(false);
    });
  });

  describe('activateWebhook', () => {
    it('should activate a deactivated webhook', async () => {
      const id = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook',
        ['test.completed'],
        'user-123'
      );

      await manager.deactivateWebhook(id);
      await manager.activateWebhook(id);

      const webhook = manager.getWebhook(id);
      expect(webhook?.active).toBe(true);
    });
  });

  describe('getDeliveryStats', () => {
    it('should return delivery statistics', async () => {
      const id = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook',
        ['test.completed'],
        'user-123'
      );

      const stats = await manager.getDeliveryStats(id);

      expect(stats).toMatchObject({
        total: 0,
        succeeded: 0,
        failed: 0,
        pending: 0,
        successRate: 0,
      });
    });
  });

  describe('emit', () => {
    it('should emit event to matching webhooks', async () => {
      const id1 = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook1',
        ['test.completed'],
        'user-123'
      );

      const id2 = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook2',
        ['test.failed'],
        'user-123'
      );

      await manager.emit({
        id: crypto.randomUUID(),
        type: 'test.completed',
        projectId: 'proj-123',
        timestamp: new Date(),
        data: { testId: 'test-1', status: 'passed' },
      });

      // Give delivery worker time to process
      await new Promise((resolve) => setTimeout(resolve, 2000));

      const history1 = await manager.getDeliveryHistory(id1, 1);
      expect(history1.length).toBeGreaterThan(0);

      const history2 = await manager.getDeliveryHistory(id2, 1);
      expect(history2.length).toBe(0);
    });

    it('should not emit to inactive webhooks', async () => {
      const id = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook',
        ['test.completed'],
        'user-123'
      );

      await manager.deactivateWebhook(id);

      await manager.emit({
        id: crypto.randomUUID(),
        type: 'test.completed',
        projectId: 'proj-123',
        timestamp: new Date(),
        data: { testId: 'test-1', status: 'passed' },
      });

      await new Promise((resolve) => setTimeout(resolve, 1000));

      const history = await manager.getDeliveryHistory(id, 1);
      expect(history).toHaveLength(0);
    });
  });

  describe('updateWebhook', () => {
    it('should update webhook configuration', async () => {
      const id = await manager.registerWebhook(
        'proj-123',
        'https://example.com/webhook',
        ['test.completed'],
        'user-123'
      );

      await manager.updateWebhook(id, {
        maxRetries: 5,
        timeout: 60000,
      });

      const webhook = manager.getWebhook(id);
      expect(webhook?.maxRetries).toBe(5);
      expect(webhook?.timeout).toBe(60000);
    });
  });
});
