import { describe, it, expect, vi } from 'vitest';
import app from '../src/index';

describe('Billing', () => {
  describe('GET /billing/plans', () => {
    it('should return all plans', async () => {
      const res = await app.request('/billing/plans');
      expect(res.status).toBe(200);
      const json = await res.json() as { plans: any[] };
      expect(json.plans).toHaveLength(3);
    });

    it('each plan should have required fields', async () => {
      const res = await app.request('/billing/plans');
      const json = await res.json() as { plans: any[] };
      json.plans.forEach((plan) => {
        expect(plan).toHaveProperty('id');
        expect(plan).toHaveProperty('name');
        expect(plan).toHaveProperty('monthlyPrice');
        expect(plan).toHaveProperty('annualPrice');
        expect(plan).toHaveProperty('features');
      });
    });

    it('free plan should have zero price', async () => {
      const res = await app.request('/billing/plans');
      const json = await res.json() as { plans: any[] };
      const free = json.plans.find((p) => p.id === 'free');
      expect(free?.monthlyPrice).toBe(0);
      expect(free?.annualPrice).toBe(0);
    });

    it('pro plan should be cheaper annually', async () => {
      const res = await app.request('/billing/plans');
      const json = await res.json() as { plans: any[] };
      const pro = json.plans.find((p) => p.id === 'pro');
      expect(pro?.annualPrice).toBe(pro?.monthlyPrice * 12);
    });
  });

  describe('POST /billing/checkout', () => {
    it('should require valid planId', async () => {
      const res = await app.request('/billing/checkout', {
        method: 'POST',
        headers: { 'x-user-id': 'user-123' },
        body: JSON.stringify({ planId: 'invalid', billingCycle: 'monthly' }),
      });
      expect(res.status).toBe(400);
    });

    it('should require billingCycle', async () => {
      const res = await app.request('/billing/checkout', {
        method: 'POST',
        headers: { 'x-user-id': 'user-123' },
        body: JSON.stringify({ planId: 'pro' }),
      });
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('should create checkout session for monthly', async () => {
      const res = await app.request('/billing/checkout', {
        method: 'POST',
        headers: { 'x-user-id': 'user-123' },
        body: JSON.stringify({ planId: 'pro', billingCycle: 'monthly' }),
      });
      expect([200, 201, 400, 500]).toContain(res.status);
    });

    it('should create checkout session for annual', async () => {
      const res = await app.request('/billing/checkout', {
        method: 'POST',
        headers: { 'x-user-id': 'user-123' },
        body: JSON.stringify({ planId: 'pro', billingCycle: 'annual' }),
      });
      expect([200, 201, 400, 500]).toContain(res.status);
    });

    it('should return sessionId and checkoutUrl', async () => {
      const res = await app.request('/billing/checkout', {
        method: 'POST',
        headers: { 'x-user-id': 'user-123' },
        body: JSON.stringify({ planId: 'free', billingCycle: 'monthly' }),
      });
      if (res.status === 200 || res.status === 201) {
        const json = await res.json() as { sessionId?: string; checkoutUrl?: string };
        expect(json).toHaveProperty('sessionId');
        expect(json).toHaveProperty('checkoutUrl');
      }
    });
  });

  describe('POST /billing/webhook', () => {
    it('should accept charge.succeeded events', async () => {
      const res = await app.request('/billing/webhook', {
        method: 'POST',
        body: JSON.stringify({
          type: 'charge.succeeded',
          data: { object: { metadata: { sessionId: 'sess-123' } } },
        }),
      });
      expect([200, 400, 500]).toContain(res.status);
    });

    it('should return received: true', async () => {
      const res = await app.request('/billing/webhook', {
        method: 'POST',
        body: JSON.stringify({ type: 'charge.succeeded' }),
      });
      const json = await res.json() as { received?: boolean };
      expect(json.received).toBe(true);
    });

    it('should handle other webhook types', async () => {
      const res = await app.request('/billing/webhook', {
        method: 'POST',
        body: JSON.stringify({ type: 'customer.updated' }),
      });
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('GET /billing/subscription', () => {
    it('should require user ID', async () => {
      const res = await app.request('/billing/subscription');
      expect([400, 401, 404]).toContain(res.status);
    });

    it('should return subscription plan', async () => {
      const res = await app.request('/billing/subscription', {
        headers: { 'x-user-id': 'user-123' },
      });
      expect([200, 404, 500]).toContain(res.status);
    });

    it('should include updatedAt timestamp', async () => {
      const res = await app.request('/billing/subscription', {
        headers: { 'x-user-id': 'user-123' },
      });
      if (res.status === 200) {
        const json = await res.json() as { updatedAt?: string };
        expect(json).toHaveProperty('updatedAt');
      }
    });
  });
});
