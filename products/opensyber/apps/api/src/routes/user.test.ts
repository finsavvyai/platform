import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

// Mock createDb so dbMiddleware uses our mock
vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

// Mock fetch for Clerk auth
vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

import { userRoutes } from './user.js';
import { Hono } from 'hono';

describe('User Routes (GET /api/user)', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;

    // Re-stub fetch for each test
    vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/user', userRoutes);
  });

  it('returns 401 without auth header', async () => {
    const res = await app.request('/api/user', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  it('returns 404 when user not found', async () => {
    mockDb._setSelectResult([]);

    const res = await app.request(
      '/api/user',
      { headers: { Authorization: 'Bearer valid-token' } },
      mockEnv,
    );
    expect(res.status).toBe(404);
    const body = (await res.json()) as any;
    expect(body.error).toBe('Not found');
    expect(body.message).toBe('User not found');
  });

  it('returns user profile when found', async () => {
    const mockUser = {
      id: 'user_test123',
      email: 'test@example.com',
      name: 'Test User',
      plan: 'pro',
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
    };
    mockDb._setSelectResult([mockUser]);

    const res = await app.request(
      '/api/user',
      { headers: { Authorization: 'Bearer valid-token' } },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.id).toBe('user_test123');
    expect(body.user.email).toBe('test@example.com');
    expect(body.user.name).toBe('Test User');
    expect(body.user.plan).toBe('pro');
    expect(body.user.createdAt).toBe('2025-01-01T00:00:00.000Z');
  });

  it('returns user with null name', async () => {
    mockDb._setSelectResult([{
      id: 'user_test123',
      email: 'test@example.com',
      name: null,
      plan: 'personal',
      createdAt: '2025-01-01T00:00:00.000Z',
    }]);

    const res = await app.request(
      '/api/user',
      { headers: { Authorization: 'Bearer valid-token' } },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.name).toBeNull();
    expect(body.user.plan).toBe('personal');
  });

  it('returns onboardingCompletedAt and referralCode', async () => {
    mockDb._setSelectResult([{
      id: 'user_test123',
      email: 'test@example.com',
      name: 'Test',
      plan: 'free',
      createdAt: '2025-01-01T00:00:00.000Z',
      onboardingCompletedAt: null,
      referralCode: 'REF-abc123',
    }]);

    const res = await app.request(
      '/api/user',
      { headers: { Authorization: 'Bearer valid-token' } },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.user.onboardingCompletedAt).toBeNull();
    expect(body.user.referralCode).toBe('REF-abc123');
  });
});

describe('Onboarding Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/user', userRoutes);
  });

  it('GET /onboarding returns computed progress', async () => {
    // First call: get user, second: instances, third: skill installations, fourth: alert rules
    mockDb._setSelectResults([
      [{ id: 'user_test123', onboardingProgress: null, onboardingCompletedAt: null }],
      [{ id: 'inst_1' }], // has instance → deployAgent = true
      [], // no skill installations → installSkill = false
      [], // no alert rules → setupAlertRule = false
    ]);

    const res = await app.request(
      '/api/user/onboarding',
      { headers: { Authorization: 'Bearer valid-token' } },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.progress.deployAgent).toBe(true);
    expect(body.progress.installSkill).toBe(false);
    expect(body.progress.setupAlertRule).toBe(false);
    expect(body.completedAt).toBeNull();
  });

  it('PATCH /onboarding dismisses checklist', async () => {
    mockDb._setSelectResult([{
      id: 'user_test123',
      onboardingProgress: null,
      onboardingCompletedAt: null,
    }]);

    const res = await app.request(
      '/api/user/onboarding',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ dismiss: true }),
      },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.completedAt).toBeTruthy();
  });

  it('PATCH /onboarding marks step complete', async () => {
    mockDb._setSelectResult([{
      id: 'user_test123',
      onboardingProgress: JSON.stringify({ reviewSecurity: false }),
      onboardingCompletedAt: null,
    }]);

    const res = await app.request(
      '/api/user/onboarding',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ step: 'reviewSecurity' }),
      },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.progress.reviewSecurity).toBe(true);
  });

  it('PATCH /onboarding returns 400 without step or dismiss', async () => {
    mockDb._setSelectResult([{
      id: 'user_test123',
      onboardingProgress: null,
      onboardingCompletedAt: null,
    }]);

    const res = await app.request(
      '/api/user/onboarding',
      {
        method: 'PATCH',
        headers: {
          Authorization: 'Bearer valid-token',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({}),
      },
      mockEnv,
    );
    expect(res.status).toBe(400);
  });
});

describe('Referral Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/user', userRoutes);
  });

  it('GET /referral returns referral info', async () => {
    mockDb._setSelectResults([
      [{ id: 'user_test123', referralCode: 'REF-abc123', referralCredits: 3 }],
      [{ count: 5 }], // referred count
    ]);

    const res = await app.request(
      '/api/user/referral',
      { headers: { Authorization: 'Bearer valid-token' } },
      mockEnv,
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as any;
    expect(body.referralCode).toBe('REF-abc123');
    expect(body.referredCount).toBe(5);
    expect(body.creditsEarned).toBe(3);
  });

  it('GET /referral returns 404 when user not found', async () => {
    mockDb._setSelectResult([]);

    const res = await app.request(
      '/api/user/referral',
      { headers: { Authorization: 'Bearer valid-token' } },
      mockEnv,
    );
    expect(res.status).toBe(404);
  });
});
