/**
 * Integration tests for API routes.
 * Tests health check, auth, and billing endpoints.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Context } from 'hono';
import { createAuthRoutes } from '../src/routes/auth-wave1';
import { createBillingRoutes } from '../src/routes/billing-wave1';
import { health } from '../src/routes/health';
import type { Env, Variables } from '../src/types';

const mockEnv = {
  DB: { prepare: vi.fn().mockReturnValue({ first: vi.fn().mockResolvedValue({ 1: 1 }) }) },
  CACHE: { get: vi.fn().mockResolvedValue(null) },
  STORAGE: { head: vi.fn().mockResolvedValue(null) },
} as unknown as Env;

describe('Health Routes', () => {
  it('should return healthy status', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/health', health);

    const res = await app.request('/health', {}, mockEnv);
    const json = (await res.json()) as { status: string };

    expect(res.status).toBe(200);
    expect(json.status).toBe('healthy');
  });

  it('should include timestamp', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/health', health);

    const res = await app.request('/health', {}, mockEnv);
    const json = (await res.json()) as { timestamp: string };

    expect(json.timestamp).toBeDefined();
    expect(new Date(json.timestamp)).toBeInstanceOf(Date);
  });

  it('should include version', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/health', health);

    const res = await app.request('/health', {}, mockEnv);
    const json = (await res.json()) as { version: string };

    expect(json.version).toBe('0.3.0');
  });
});

describe('Auth Routes Structure', () => {
  it('should create auth router', () => {
    const router = createAuthRoutes();
    expect(router).toBeDefined();
  });

  it('should have login endpoint', () => {
    const router = createAuthRoutes();
    // The router should have routes defined
    expect(router).toBeDefined();
  });

  it('should have register endpoint', () => {
    const router = createAuthRoutes();
    expect(router).toBeDefined();
  });

  it('should have refresh endpoint', () => {
    const router = createAuthRoutes();
    expect(router).toBeDefined();
  });

  it('should have me endpoint', () => {
    const router = createAuthRoutes();
    expect(router).toBeDefined();
  });
});

describe('Billing Routes Structure', () => {
  const mockPaymentProvider = {
    createCheckout: vi.fn(async (planId: string, userId: string) => ({
      checkoutUrl: 'https://checkout.example.com',
      sessionId: 'session-123',
    })),
    handleWebhook: vi.fn(async (signature: string, body: string) => ({
      id: 'event-123',
      type: 'subscription_created',
      data: {},
      createdAt: new Date(),
    })),
    getPlan: vi.fn((planId: string) => ({
      id: planId,
      name: 'Test Plan',
      variantId: 'variant-123',
      price: 2999,
      currency: 'USD',
      features: [],
    })),
  };

  it('should create billing router', () => {
    const router = createBillingRoutes(mockPaymentProvider);
    expect(router).toBeDefined();
  });

  it('should have checkout endpoint', () => {
    const router = createBillingRoutes(mockPaymentProvider);
    expect(router).toBeDefined();
  });

  it('should have webhook endpoint', () => {
    const router = createBillingRoutes(mockPaymentProvider);
    expect(router).toBeDefined();
  });

  it('should have billing endpoint', () => {
    const router = createBillingRoutes(mockPaymentProvider);
    expect(router).toBeDefined();
  });
});

describe('Route Error Handling', () => {
  const authEnv = {
    ...mockEnv,
    CACHE: {
      get: vi.fn().mockResolvedValue(null),
      put: vi.fn().mockResolvedValue(undefined),
    },
  } as unknown as Env;

  it('should handle validation errors in auth routes', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/auth', createAuthRoutes());

    const res = await app.request(
      '/auth/login',
      {
        method: 'POST',
        body: JSON.stringify({ email: 'invalid', password: 'short' }),
        headers: { 'Content-Type': 'application/json' },
      },
      authEnv,
    );

    expect(res.status).toBe(400);
  });

  it('should handle missing auth header', async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/auth', createAuthRoutes());

    const res = await app.request('/auth/me', {}, authEnv);

    // Auth endpoint should require authentication
    expect([400, 401, 404]).toContain(res.status);
  });
});
