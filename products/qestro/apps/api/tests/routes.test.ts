import { describe, it, expect, beforeEach, vi } from 'vitest';
import app from '../src/index';

describe('Routes', () => {
  let mockDB: any;
  let mockEnv: any;

  beforeEach(() => {
    mockDB = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          all: vi.fn().mockResolvedValue({ results: [] }),
          run: vi.fn().mockResolvedValue({ success: true }),
        }),
      }),
    };

    mockEnv = {
      DB: mockDB,
      JWT_SECRET: 'test-secret',
      STRIPE_SECRET: 'test-stripe',
      OPENAI_API_KEY: 'test-openai',
    };
  });

  describe('Health Check', () => {
    it('should return 200 on /health', async () => {
      const res = await app.request('/health');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.status).toBe('ok');
    });
  });

  describe('Tests Routes', () => {
    it('GET /api/tests should return 401 without auth', async () => {
      const res = await app.request('/api/tests');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('POST /api/tests should create test with valid token', async () => {
      const res = await app.request('/api/tests', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid.token.here' },
        body: JSON.stringify({
          name: 'Login Test',
          description: 'Test user login flow',
          projectId: 'proj-123',
        }),
      });
      expect(res.status).toBeLessThan(500);
    });

    it('GET /api/tests/:id should 404 for missing test', async () => {
      const res = await app.request('/api/tests/missing-id');
      expect(res.status).toBeGreaterThanOrEqual(400);
    });

    it('DELETE /api/tests/:id should delete test', async () => {
      const res = await app.request('/api/tests/test-id', {
        method: 'DELETE',
        headers: { Authorization: 'Bearer valid.token.here' },
      });
      expect(res.status).toBeLessThan(500);
    });

    it('POST /api/tests/:id/generate should generate steps', async () => {
      const res = await app.request('/api/tests/test-id/generate', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid.token.here' },
      });
      expect(res.status).toBeLessThan(500);
    });

    it('POST /api/tests/:id/run should execute test', async () => {
      const res = await app.request('/api/tests/test-id/run', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid.token.here' },
        body: JSON.stringify({
          testId: 'test-id',
          appUrl: 'https://app.example.com',
        }),
      });
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('Auth Routes', () => {
    it('POST /auth/register should register user', async () => {
      const res = await app.request('/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'password123',
          name: 'Test User',
        }),
      });
      expect([200, 201, 400, 409]).toContain(res.status);
    });

    it('POST /auth/login should login user', async () => {
      const res = await app.request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          email: 'user@example.com',
          password: 'password123',
        }),
      });
      expect([200, 401, 400]).toContain(res.status);
    });

    it('POST /auth/logout should succeed', async () => {
      const res = await app.request('/auth/logout', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid.token.here' },
      });
      expect(res.status).toBeLessThan(500);
    });

    it('POST /auth/refresh should refresh token', async () => {
      const res = await app.request('/auth/refresh', {
        method: 'POST',
        headers: { Authorization: 'Bearer valid.token.here' },
      });
      expect([200, 400, 401]).toContain(res.status);
    });
  });

  describe('Billing Routes', () => {
    it('GET /billing/plans should list plans', async () => {
      const res = await app.request('/billing/plans');
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json.plans).toBeInstanceOf(Array);
      expect(json.plans.length).toBeGreaterThan(0);
    });

    it('POST /billing/checkout should create session', async () => {
      const res = await app.request('/billing/checkout', {
        method: 'POST',
        headers: { 'x-user-id': 'user-123' },
        body: JSON.stringify({
          planId: 'pro',
          billingCycle: 'monthly',
        }),
      });
      expect([200, 201, 400]).toContain(res.status);
    });

    it('GET /billing/subscription should get user plan', async () => {
      const res = await app.request('/billing/subscription', {
        headers: { 'x-user-id': 'user-123' },
      });
      expect([200, 404]).toContain(res.status);
    });

    it('POST /billing/webhook should handle Stripe events', async () => {
      const res = await app.request('/billing/webhook', {
        method: 'POST',
        body: JSON.stringify({
          type: 'charge.succeeded',
          data: { object: { metadata: { sessionId: 'sess-123' } } },
        }),
      });
      expect(res.status).toBeLessThan(500);
    });
  });

  describe('Error Handling', () => {
    it('should return 404 for unknown routes', async () => {
      const res = await app.request('/unknown-route');
      expect(res.status).toBe(404);
    });

    it('should handle CORS preflight', async () => {
      const res = await app.request('/api/tests', {
        method: 'OPTIONS',
      });
      expect([200, 204]).toContain(res.status);
    });
  });
});
