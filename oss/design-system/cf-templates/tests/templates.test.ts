import { describe, it, expect } from 'vitest';
import { getApiTemplate } from '../src/templates/api';
import { getWebhookTemplate } from '../src/templates/webhook';
import { getCronTemplate } from '../src/templates/cron';

describe('templates', () => {
  describe('getApiTemplate', () => {
    it('should return valid TypeScript code', () => {
      const template = getApiTemplate();
      expect(template).toContain('import { Hono }');
      expect(template).toContain('app.get');
      expect(template).toContain('app.post');
    });

    it('should include health endpoint', () => {
      const template = getApiTemplate();
      expect(template).toContain('/api/health');
      expect(template).toContain('healthy');
    });

    it('should include database operations', () => {
      const template = getApiTemplate();
      expect(template).toContain('getD1');
      expect(template).toContain('SELECT');
      expect(template).toContain('INSERT INTO');
    });

    it('should include KV cache operations', () => {
      const template = getApiTemplate();
      expect(template).toContain('getKV');
      expect(template).toContain('kv.get');
      expect(template).toContain('kv.put');
    });

    it('should include CORS configuration', () => {
      const template = getApiTemplate();
      expect(template).toContain('corsOrigins');
      expect(template).toContain('createApp');
    });

    it('should include rate limiting', () => {
      const template = getApiTemplate();
      expect(template).toContain('rateLimit');
      expect(template).toContain('maxRequests');
    });
  });

  describe('getWebhookTemplate', () => {
    it('should return valid TypeScript code', () => {
      const template = getWebhookTemplate();
      expect(template).toContain('import { Hono }');
      expect(template).toContain('app.post');
    });

    it('should include Stripe webhook handling', () => {
      const template = getWebhookTemplate();
      expect(template).toContain('/webhooks/stripe');
      expect(template).toContain('stripe-signature');
    });

    it('should handle charge.succeeded event', () => {
      const template = getWebhookTemplate();
      expect(template).toContain('charge.succeeded');
      expect(template).toContain('INSERT INTO payments');
    });

    it('should handle charge.refunded event', () => {
      const template = getWebhookTemplate();
      expect(template).toContain('charge.refunded');
      expect(template).toContain('UPDATE payments');
    });

    it('should validate signature', () => {
      const template = getWebhookTemplate();
      expect(template).toContain('Missing signature');
    });

    it('should use database and KV', () => {
      const template = getWebhookTemplate();
      expect(template).toContain('getD1');
      expect(template).toContain('getKV');
    });
  });

  describe('getCronTemplate', () => {
    it('should return valid TypeScript code', () => {
      const template = getCronTemplate();
      expect(template).toContain('import { Hono }');
      expect(template).toContain('scheduled');
    });

    it('should include cron job handler', () => {
      const template = getCronTemplate();
      expect(template).toContain('async scheduled');
      expect(template).toContain('Cron job triggered');
    });

    it('should query pending tasks', () => {
      const template = getCronTemplate();
      expect(template).toContain('pending');
      expect(template).toContain('COUNT');
    });

    it('should update task status', () => {
      const template = getCronTemplate();
      expect(template).toContain('UPDATE tasks');
      expect(template).toContain('processing');
    });

    it('should use KV for tracking', () => {
      const template = getCronTemplate();
      expect(template).toContain('cron:last_run');
      expect(template).toContain('getKV');
    });

    it('should handle errors gracefully', () => {
      const template = getCronTemplate();
      expect(template).toContain('catch (error)');
      expect(template).toContain('Cron job error');
    });
  });
});
