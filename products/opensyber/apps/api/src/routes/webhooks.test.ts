import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, generateSvixSignature, generateHmacSignature } from '../test/helpers.js';

// Mock createDb so dbMiddleware uses our mock
vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

// Mock Cloudflare Containers service for user.deleted cascade
vi.mock('../services/cloudflare-containers.js', () => ({
  containerService: {
    deleteInstance: vi.fn(async () => undefined),
    createInstance: vi.fn(async () => ({
      containerId: 'cf-container-1', hostname: 'agent-1.opensyber.cloud', region: 'enam',
    })),
    restartInstance: vi.fn(async () => undefined),
    getInstanceStatus: vi.fn(async () => 'running'),
  },
}));

// Mock email service for payment failure
vi.mock('../services/email.js', () => ({
  emailService: {
    sendPaymentFailedEmail: vi.fn(async () => undefined),
    sendWelcomeEmail: vi.fn(async () => undefined),
  },
}));

import { webhookRoutes } from './webhooks.js';
import { emailService } from '../services/email.js';
import { Hono } from 'hono';

describe('Webhook Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/webhooks', webhookRoutes);

    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Clerk Webhook (removed — Clerk migrated to Auth.js on 2026-03-27)
  // ═══════════════════════════════════════════════════════════════════════

  describe.skip('POST /webhooks/clerk (removed — Auth.js migration)', () => {
    it('rejects requests missing Svix headers', async () => {
      const res = await app.request(
        '/webhooks/clerk',
        { method: 'POST', body: '{}' },
        mockEnv,
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Missing Svix headers');
    });

    it('rejects missing svix-id header', async () => {
      const res = await app.request(
        '/webhooks/clerk',
        {
          method: 'POST',
          headers: {
            'svix-timestamp': String(Math.floor(Date.now() / 1000)),
            'svix-signature': 'v1,abc',
          },
          body: '{}',
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
    });

    it('rejects stale timestamps (> 5 min)', async () => {
      const staleTimestamp = String(Math.floor(Date.now() / 1000) - 600);

      const res = await app.request(
        '/webhooks/clerk',
        {
          method: 'POST',
          headers: {
            'svix-id': 'msg_test',
            'svix-timestamp': staleTimestamp,
            'svix-signature': 'v1,fakesig',
          },
          body: '{}',
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Timestamp too old');
    });

    it('rejects invalid signature', async () => {
      const timestamp = String(Math.floor(Date.now() / 1000));

      const res = await app.request(
        '/webhooks/clerk',
        {
          method: 'POST',
          headers: {
            'svix-id': 'msg_test',
            'svix-timestamp': timestamp,
            'svix-signature': 'v1,invalidsignature',
          },
          body: '{"type":"user.created","data":{}}',
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Invalid signature');
      expect(console.error).toHaveBeenCalledWith('Clerk webhook signature mismatch');
    });

    it('accepts valid signature and processes user.created', async () => {
      const svixId = 'msg_test123';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({
        type: 'user.created',
        data: {
          id: 'user_new',
          email_addresses: [{ email_address: 'new@example.com' }],
          first_name: 'John',
          last_name: 'Doe',
        },
      });

      const secret = mockEnv.CLERK_WEBHOOK_SECRET.replace('whsec_', '');
      const signature = await generateSvixSignature(secret, svixId, timestamp, payload);

      const res = await app.request(
        '/webhooks/clerk',
        {
          method: 'POST',
          headers: {
            'svix-id': svixId,
            'svix-timestamp': timestamp,
            'svix-signature': signature,
          },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.received).toBe(true);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(emailService.sendWelcomeEmail).toHaveBeenCalledWith({
        to: 'new@example.com',
        userName: 'John Doe',
        apiKey: mockEnv.RESEND_API_KEY,
      });
    });

    it('processes user.created with no email gracefully', async () => {
      const svixId = 'msg_noemail';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({
        type: 'user.created',
        data: {
          id: 'user_noemail',
          email_addresses: [],
          first_name: 'NoEmail',
          last_name: null,
        },
      });

      const secret = mockEnv.CLERK_WEBHOOK_SECRET.replace('whsec_', '');
      const signature = await generateSvixSignature(secret, svixId, timestamp, payload);

      const res = await app.request(
        '/webhooks/clerk',
        {
          method: 'POST',
          headers: { 'svix-id': svixId, 'svix-timestamp': timestamp, 'svix-signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      // insert should NOT be called when email is missing
      expect(mockDb.insert).not.toHaveBeenCalled();
    });

    it('processes user.created with only first_name (no last_name)', async () => {
      const svixId = 'msg_firstname';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({
        type: 'user.created',
        data: {
          id: 'user_fname',
          email_addresses: [{ email_address: 'fname@example.com' }],
          first_name: 'Jane',
          last_name: null,
        },
      });

      const secret = mockEnv.CLERK_WEBHOOK_SECRET.replace('whsec_', '');
      const signature = await generateSvixSignature(secret, svixId, timestamp, payload);

      const res = await app.request(
        '/webhooks/clerk',
        {
          method: 'POST',
          headers: { 'svix-id': svixId, 'svix-timestamp': timestamp, 'svix-signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('processes user.created with null name fields', async () => {
      const svixId = 'msg_noname';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({
        type: 'user.created',
        data: {
          id: 'user_noname',
          email_addresses: [{ email_address: 'noname@example.com' }],
          first_name: null,
          last_name: null,
        },
      });

      const secret = mockEnv.CLERK_WEBHOOK_SECRET.replace('whsec_', '');
      const signature = await generateSvixSignature(secret, svixId, timestamp, payload);

      const res = await app.request(
        '/webhooks/clerk',
        {
          method: 'POST',
          headers: { 'svix-id': svixId, 'svix-timestamp': timestamp, 'svix-signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('processes user.updated event', async () => {
      const svixId = 'msg_update';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({
        type: 'user.updated',
        data: {
          id: 'user_existing',
          email_addresses: [{ email_address: 'updated@example.com' }],
          first_name: 'Jane',
          last_name: null,
        },
      });

      const secret = mockEnv.CLERK_WEBHOOK_SECRET.replace('whsec_', '');
      const signature = await generateSvixSignature(secret, svixId, timestamp, payload);

      const res = await app.request(
        '/webhooks/clerk',
        {
          method: 'POST',
          headers: { 'svix-id': svixId, 'svix-timestamp': timestamp, 'svix-signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('handles user.deleted cascade — destroys instances and cleans KV', async () => {
      // User has 2 instances
      mockDb._setSelectResult([
        { id: 'inst_1', containerId: 12345, userId: 'user_deleted' },
        { id: 'inst_2', containerId: 67890, userId: 'user_deleted' },
      ]);

      const svixId = 'msg_delete';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({
        type: 'user.deleted',
        data: { id: 'user_deleted' },
      });

      const secret = mockEnv.CLERK_WEBHOOK_SECRET.replace('whsec_', '');
      const signature = await generateSvixSignature(secret, svixId, timestamp, payload);

      const res = await app.request(
        '/webhooks/clerk',
        {
          method: 'POST',
          headers: { 'svix-id': svixId, 'svix-timestamp': timestamp, 'svix-signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.received).toBe(true);

      // Should mark instances as destroying and clean up KV
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockEnv.CREDENTIAL_VAULT.delete).toHaveBeenCalledWith('gateway:inst_1');
      expect(mockEnv.CREDENTIAL_VAULT.delete).toHaveBeenCalledWith('gateway:inst_2');
    });

    it('handles user.deleted with no instances', async () => {
      mockDb._setSelectResult([]); // No instances

      const svixId = 'msg_delete2';
      const timestamp = String(Math.floor(Date.now() / 1000));
      const payload = JSON.stringify({
        type: 'user.deleted',
        data: { id: 'user_no_instances' },
      });

      const secret = mockEnv.CLERK_WEBHOOK_SECRET.replace('whsec_', '');
      const signature = await generateSvixSignature(secret, svixId, timestamp, payload);

      const res = await app.request(
        '/webhooks/clerk',
        {
          method: 'POST',
          headers: { 'svix-id': svixId, 'svix-timestamp': timestamp, 'svix-signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockEnv.CREDENTIAL_VAULT.delete).not.toHaveBeenCalled();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // LemonSqueezy Webhook
  // ═══════════════════════════════════════════════════════════════════════

  describe('POST /webhooks/lemonsqueezy', () => {
    it('rejects requests without X-Signature', async () => {
      const res = await app.request(
        '/webhooks/lemonsqueezy',
        { method: 'POST', body: '{}' },
        mockEnv,
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Missing signature');
    });

    it('rejects invalid signature', async () => {
      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': 'wrong-signature' },
          body: '{"meta":{"event_name":"test"},"data":{}}',
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Invalid signature');
    });

    it('ignores events for other products', async () => {
      const payload = JSON.stringify({
        meta: { event_name: 'subscription_created', custom_data: { user_id: 'u1' } },
        data: {
          id: 'sub_1',
          attributes: { store_id: 12345, product_id: 999, variant_id: 200, customer_id: 1, status: 'active' },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.ignored).toBe(true);
    });

    it('processes subscription_created and updates user plan', async () => {
      const payload = JSON.stringify({
        meta: { event_name: 'subscription_created', custom_data: { user_id: 'user_123' } },
        data: {
          id: 'sub_abc',
          attributes: {
            store_id: 12345, product_id: 100,
            variant_id: 201, // pro
            customer_id: 5000,
            status: 'active',
          },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('handles subscription_created without user_id', async () => {
      const payload = JSON.stringify({
        meta: { event_name: 'subscription_created' }, // no custom_data
        data: {
          id: 'sub_noid',
          attributes: { store_id: 12345, product_id: 100, variant_id: 200, customer_id: 1, status: 'active' },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('downgrades plan on subscription_cancelled', async () => {
      mockDb._setSelectResult([{ id: 'user_123', lemonSqueezyCustomerId: '5000', plan: 'pro' }]);

      const payload = JSON.stringify({
        meta: { event_name: 'subscription_cancelled' },
        data: {
          id: 'sub_cancel',
          attributes: { store_id: 12345, product_id: 100, variant_id: 201, customer_id: 5000, status: 'cancelled', cancelled: true },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('suspends excess instances on subscription_cancelled (3 instances, personal limit = 1)', async () => {
      // First select: find user by customerId
      // Second select: query user instances for suspension
      mockDb._setSelectResults([
        [{ id: 'user_suspend', lemonSqueezyCustomerId: '5500', plan: 'team', email: 'u@ex.com', name: 'Test' }],
        [
          { id: 'inst_oldest', userId: 'user_suspend', createdAt: '2024-01-01T00:00:00Z' },
          { id: 'inst_middle', userId: 'user_suspend', createdAt: '2024-06-01T00:00:00Z' },
          { id: 'inst_newest', userId: 'user_suspend', createdAt: '2024-12-01T00:00:00Z' },
        ],
      ]);

      const payload = JSON.stringify({
        meta: { event_name: 'subscription_cancelled' },
        data: {
          id: 'sub_suspend',
          attributes: { store_id: 12345, product_id: 100, variant_id: 201, customer_id: 5500, status: 'cancelled', cancelled: true },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      // update called: 1 for plan downgrade + 2 for suspending excess instances
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('downgrades plan on subscription_expired', async () => {
      mockDb._setSelectResult([{ id: 'user_456', lemonSqueezyCustomerId: '6000', plan: 'team' }]);

      const payload = JSON.stringify({
        meta: { event_name: 'subscription_expired' },
        data: {
          id: 'sub_expired',
          attributes: { store_id: 12345, product_id: 100, variant_id: 202, customer_id: 6000, status: 'expired' },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('handles subscription_updated event', async () => {
      mockDb._setSelectResult([{ id: 'user_up', lemonSqueezyCustomerId: '7000', plan: 'personal' }]);

      const payload = JSON.stringify({
        meta: { event_name: 'subscription_updated' },
        data: {
          id: 'sub_upd',
          attributes: { store_id: 12345, product_id: 100, variant_id: 202, customer_id: 7000, status: 'active' },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('handles subscription_updated when user not found', async () => {
      mockDb._setSelectResult([]); // user not found

      const payload = JSON.stringify({
        meta: { event_name: 'subscription_updated' },
        data: {
          id: 'sub_upd',
          attributes: { store_id: 12345, product_id: 100, variant_id: 202, customer_id: 9999, status: 'active' },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('handles subscription_cancelled when user not found', async () => {
      mockDb._setSelectResult([]); // user not found

      const payload = JSON.stringify({
        meta: { event_name: 'subscription_cancelled' },
        data: {
          id: 'sub_cancel',
          attributes: { store_id: 12345, product_id: 100, variant_id: 201, customer_id: 9999, status: 'cancelled', cancelled: true },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).not.toHaveBeenCalled();
    });

    it('handles subscription_payment_failed when user not found', async () => {
      mockDb._setSelectResult([]); // user not found

      const payload = JSON.stringify({
        meta: { event_name: 'subscription_payment_failed' },
        data: {
          id: 'sub_fail_nf',
          attributes: { store_id: 12345, product_id: 100, variant_id: 200, customer_id: 9999, status: 'past_due' },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it('handles subscription_created with unknown variant (defaults to personal)', async () => {
      const payload = JSON.stringify({
        meta: { event_name: 'subscription_created', custom_data: { user_id: 'user_unk' } },
        data: {
          id: 'sub_unk_var',
          attributes: { store_id: 12345, product_id: 100, variant_id: 999, customer_id: 1, status: 'active' },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('handles missing variant env vars gracefully', async () => {
      // Remove variant env vars to test buildVariantMap branches
      const envWithoutVariants = createMockEnv({
        OPENSYBER_LS_VARIANT_PERSONAL: '',
        OPENSYBER_LS_VARIANT_PRO: '',
        OPENSYBER_LS_VARIANT_TEAM: '',
      });

      const payload = JSON.stringify({
        meta: { event_name: 'subscription_created', custom_data: { user_id: 'user_nv' } },
        data: {
          id: 'sub_nv',
          attributes: { store_id: 12345, product_id: 100, variant_id: 200, customer_id: 1, status: 'active' },
        },
      });

      const signature = await generateHmacSignature(envWithoutVariants.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        envWithoutVariants,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('handles subscription_payment_success event', async () => {
      const payload = JSON.stringify({
        meta: { event_name: 'subscription_payment_success' },
        data: {
          id: 'sub_pay',
          attributes: { store_id: 12345, product_id: 100, variant_id: 200, customer_id: 1, status: 'active' },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
    });

    it('handles subscription_payment_failed event and sends email', async () => {
      mockDb._setSelectResult([{
        id: 'user_fail',
        lemonSqueezyCustomerId: '8000',
        email: 'fail@example.com',
        name: 'Failing User',
      }]);

      const payload = JSON.stringify({
        meta: { event_name: 'subscription_payment_failed' },
        data: {
          id: 'sub_fail',
          attributes: { store_id: 12345, product_id: 100, variant_id: 200, customer_id: 8000, status: 'past_due' },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      // Email service is called for payment failure
      expect(emailService.sendPaymentFailedEmail).toHaveBeenCalledWith({
        to: 'fail@example.com',
        userName: 'Failing User',
        apiKey: mockEnv.RESEND_API_KEY,
      });
    });

    it('handles unrecognized event name gracefully', async () => {
      const payload = JSON.stringify({
        meta: { event_name: 'unknown_event' },
        data: {
          id: 'sub_unk',
          attributes: { store_id: 12345, product_id: 100, variant_id: 200, customer_id: 1, status: 'active' },
        },
      });

      const signature = await generateHmacSignature(mockEnv.LEMONSQUEEZY_WEBHOOK_SECRET, payload);

      const res = await app.request(
        '/webhooks/lemonsqueezy',
        {
          method: 'POST',
          headers: { 'X-Signature': signature },
          body: payload,
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
    });
  });

  // ═══════════════════════════════════════════════════════════════════════
  // Agent Health Webhook
  // ═══════════════════════════════════════════════════════════════════════

  describe('POST /webhooks/agent/health', () => {
    // Agent health now requires gateway auth (X-Gateway-Token + X-Instance-Id)
    beforeEach(async () => {
      await mockEnv.CREDENTIAL_VAULT.put('gateway:inst_1', 'gw-token-inst1');
      await mockEnv.CREDENTIAL_VAULT.put('gateway:inst_cache', 'gw-token-cache');
      await mockEnv.CREDENTIAL_VAULT.put('gateway:inst_down', 'gw-token-down');
    });

    it('returns 401 without gateway token', async () => {
      const res = await app.request(
        '/webhooks/agent/health',
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ instanceId: 'inst_1' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
    });

    it('updates instance status when engine is running', async () => {
      const payload = {
        instanceId: 'inst_1',
        status: 'running',
        cpuPercent: 45,
        memoryPercent: 60,
        diskPercent: 30,
        engineRunning: true,
        agentVersion: '1.0.0',
        engineVersion: '2.0.0',
      };

      const res = await app.request(
        '/webhooks/agent/health',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Token': 'gw-token-inst1',
            'X-Instance-Id': 'inst_1',
          },
          body: JSON.stringify(payload),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('stores health metrics in KV cache with TTL', async () => {
      const payload = {
        instanceId: 'inst_cache',
        status: 'running',
        cpuPercent: 10,
        memoryPercent: 20,
        diskPercent: 15,
        engineRunning: true,
        agentVersion: '1.0.0',
        engineVersion: '2.0.0',
      };

      await app.request(
        '/webhooks/agent/health',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Token': 'gw-token-cache',
            'X-Instance-Id': 'inst_cache',
          },
          body: JSON.stringify(payload),
        },
        mockEnv,
      );

      expect(mockEnv.CACHE.put).toHaveBeenCalledWith(
        'health:inst_cache',
        expect.any(String),
        { expirationTtl: 300 },
      );
    });

    it('sets status to error when engine is not running', async () => {
      const payload = {
        instanceId: 'inst_down',
        status: 'error',
        cpuPercent: 0,
        memoryPercent: 10,
        diskPercent: 5,
        engineRunning: false,
        agentVersion: '1.0.0',
        engineVersion: '2.0.0',
      };

      const res = await app.request(
        '/webhooks/agent/health',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Token': 'gw-token-down',
            'X-Instance-Id': 'inst_down',
          },
          body: JSON.stringify(payload),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      expect(mockDb.update).toHaveBeenCalled();
    });

    it('returns desiredSkills in health response', async () => {
      // First select: instance status lookup, second: skill installations
      mockDb._setSelectResults([
        [{ status: 'running' }],
        [
          { slug: 'github-integration', version: '1.0.0' },
          { slug: 'slack-notifier', version: '1.2.0' },
        ],
      ]);

      const payload = {
        instanceId: 'inst_1',
        status: 'running',
        cpuPercent: 20,
        memoryPercent: 40,
        diskPercent: 25,
        engineRunning: true,
        agentVersion: '1.0.0',
        engineVersion: '2.0.0',
      };

      const res = await app.request(
        '/webhooks/agent/health',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Token': 'gw-token-inst1',
            'X-Instance-Id': 'inst_1',
          },
          body: JSON.stringify(payload),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.received).toBe(true);
      expect(body.desiredSkills).toEqual([
        { slug: 'github-integration', version: '1.0.0' },
        { slug: 'slack-notifier', version: '1.2.0' },
      ]);
    });

    it('returns empty desiredSkills when no active installations', async () => {
      mockDb._setSelectResults([
        [{ status: 'running' }],
        [],
      ]); // No skill installations

      const payload = {
        instanceId: 'inst_1',
        status: 'running',
        cpuPercent: 10,
        memoryPercent: 20,
        diskPercent: 15,
        engineRunning: true,
        agentVersion: '1.0.0',
        engineVersion: '2.0.0',
      };

      const res = await app.request(
        '/webhooks/agent/health',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Token': 'gw-token-inst1',
            'X-Instance-Id': 'inst_1',
          },
          body: JSON.stringify(payload),
        },
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.desiredSkills).toEqual([]);
    });

    it('returns 403 when instance ID mismatch', async () => {
      const payload = {
        instanceId: 'inst_other', // Doesn't match X-Instance-Id header
        status: 'running',
        cpuPercent: 10,
        memoryPercent: 20,
        diskPercent: 15,
        engineRunning: true,
        agentVersion: '1.0.0',
        engineVersion: '2.0.0',
      };

      const res = await app.request(
        '/webhooks/agent/health',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Gateway-Token': 'gw-token-inst1',
            'X-Instance-Id': 'inst_1',
          },
          body: JSON.stringify(payload),
        },
        mockEnv,
      );

      expect(res.status).toBe(403);
    });
  });
});
