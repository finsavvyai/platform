import { describe, it, expect, beforeEach, vi } from 'vitest';
import { WebhookHandler } from '../src/webhook/handler.js';
import {
  verifyStripeSignature,
  verifyLemonSqueezySignature,
  getSignatureTimestamp,
  validateTimestamp,
} from '../src/webhook/signature.js';
import { WebhookSignatureError } from '../src/types.js';
import { createHmac } from 'crypto';

describe('Webhook Signature Verification', () => {
  describe('verifyStripeSignature', () => {
    it('should verify valid stripe signature', () => {
      const secret = 'whsec_test_123';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';

      const signed = `${timestamp}.${payload}`;
      const hash = createHmac('sha256', secret).update(signed).digest('hex');
      const signature = `t=${timestamp},v1=${hash}`;

      expect(verifyStripeSignature(payload, signature, secret)).toBe(true);
    });

    it('should reject invalid stripe signature', () => {
      const secret = 'whsec_test_123';
      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"test": "data"}';
      const signature = `t=${timestamp},v1=invalidsignature`;

      expect(verifyStripeSignature(payload, signature, secret)).toBe(false);
    });

    it('should throw on malformed signature', () => {
      expect(() => verifyStripeSignature('payload', 'invalid', 'secret')).toThrow(WebhookSignatureError);
    });
  });

  describe('verifyLemonSqueezySignature', () => {
    it('should verify valid lemonsqueezy signature', () => {
      const secret = 'webhook_secret_123';
      const payload = '{"test": "data"}';

      const hash = createHmac('sha256', secret).update(payload).digest('hex');

      expect(verifyLemonSqueezySignature(payload, hash, secret)).toBe(true);
    });

    it('should reject invalid lemonsqueezy signature', () => {
      const secret = 'webhook_secret_123';
      const payload = '{"test": "data"}';

      expect(verifyLemonSqueezySignature(payload, 'invalidsignature', secret)).toBe(false);
    });
  });

  describe('getSignatureTimestamp', () => {
    it('should extract timestamp from stripe signature', () => {
      const timestamp = '1234567890';
      const signature = `t=${timestamp},v1=somehash`;

      expect(getSignatureTimestamp(signature)).toBe(parseInt(timestamp, 10));
    });

    it('should throw when timestamp missing', () => {
      expect(() => getSignatureTimestamp('v1=somehash')).toThrow(WebhookSignatureError);
    });
  });

  describe('validateTimestamp', () => {
    it('should accept recent timestamp', () => {
      const now = Math.floor(Date.now() / 1000);
      expect(validateTimestamp(now)).toBe(true);
    });

    it('should reject old timestamp', () => {
      const oldTimestamp = Math.floor(Date.now() / 1000) - 400;
      expect(validateTimestamp(oldTimestamp)).toBe(false);
    });

    it('should reject future timestamp', () => {
      const futureTimestamp = Math.floor(Date.now() / 1000) + 400;
      expect(validateTimestamp(futureTimestamp)).toBe(false);
    });
  });
});

describe('WebhookHandler', () => {
  describe('Stripe Webhooks', () => {
    it('should handle stripe subscription.created event', async () => {
      const handler = new WebhookHandler({
        provider: 'stripe',
        secret: 'whsec_test_123',
      });

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({
        type: 'customer.subscription.created',
        data: { object: { id: 'sub_123', customer: 'cus_123' } },
      });

      const signed = `${timestamp}.${payload}`;
      const hash = createHmac('sha256', 'whsec_test_123').update(signed).digest('hex');
      const signature = `t=${timestamp},v1=${hash}`;

      const event = await handler.handle(signature, payload);

      expect(event.type).toBe('subscription.created');
      expect(event.data.id).toBe('sub_123');
    });

    it('should handle stripe payment.succeeded event', async () => {
      const handler = new WebhookHandler({
        provider: 'stripe',
        secret: 'whsec_test_123',
      });

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = JSON.stringify({
        type: 'charge.succeeded',
        data: { object: { id: 'ch_123' } },
      });

      const signed = `${timestamp}.${payload}`;
      const hash = createHmac('sha256', 'whsec_test_123').update(signed).digest('hex');
      const signature = `t=${timestamp},v1=${hash}`;

      const event = await handler.handle(signature, payload);

      expect(event.type).toBe('payment.succeeded');
    });

    it('should throw on stripe signature mismatch', async () => {
      const handler = new WebhookHandler({
        provider: 'stripe',
        secret: 'whsec_test_123',
      });

      const timestamp = Math.floor(Date.now() / 1000).toString();
      const payload = '{"type": "charge.succeeded"}';
      const signature = `t=${timestamp},v1=invalidsignature`;

      await expect(handler.handle(signature, payload)).rejects.toThrow(WebhookSignatureError);
    });
  });

  describe('LemonSqueezy Webhooks', () => {
    it('should handle lemonsqueezy subscription_created event', async () => {
      const handler = new WebhookHandler({
        provider: 'lemonsqueezy',
        secret: 'webhook_secret_123',
      });

      const payload = JSON.stringify({
        meta: { event_name: 'subscription_created' },
        data: { id: 'sub_123' },
      });

      const hash = createHmac('sha256', 'webhook_secret_123').update(payload).digest('hex');

      const event = await handler.handle(hash, payload);

      expect(event.type).toBe('subscription.created');
    });

    it('should handle lemonsqueezy order_completed event', async () => {
      const handler = new WebhookHandler({
        provider: 'lemonsqueezy',
        secret: 'webhook_secret_123',
      });

      const payload = JSON.stringify({
        meta: { event_name: 'order_completed' },
        data: { id: 'order_123' },
      });

      const hash = createHmac('sha256', 'webhook_secret_123').update(payload).digest('hex');

      const event = await handler.handle(hash, payload);

      expect(event.type).toBe('payment.succeeded');
    });

    it('should throw on lemonsqueezy signature mismatch', async () => {
      const handler = new WebhookHandler({
        provider: 'lemonsqueezy',
        secret: 'webhook_secret_123',
      });

      const payload = JSON.stringify({ meta: { event_name: 'subscription_created' } });

      await expect(handler.handle('invalidsignature', payload)).rejects.toThrow(WebhookSignatureError);
    });
  });
});
