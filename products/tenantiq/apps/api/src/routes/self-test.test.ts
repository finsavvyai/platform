import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { selfTestRoutes } from './self-test';

// Mock jose so authMiddleware doesn't reject
vi.mock('jose', () => ({
  jwtVerify: vi.fn().mockResolvedValue({
    payload: { sub: 'u1', email: 'a@b.com', name: 'Test', orgId: 'o1', tenantIds: ['t1'], role: 'admin' },
  }),
}));

const mockFirst = vi.fn();
const mockDB = { prepare: vi.fn(() => ({ first: mockFirst })) };
const mockKV = {
  put: vi.fn().mockResolvedValue(undefined),
  get: vi.fn().mockResolvedValue('ok'),
  delete: vi.fn().mockResolvedValue(undefined),
  list: vi.fn().mockResolvedValue({ keys: [{ name: 'graph:t1:access_token' }] }),
};

describe('Self-Test Endpoint', () => {
  let app: Hono<AppEnv>;
  let env: AppEnv['Bindings'];
  const headers = { Authorization: 'Bearer valid-token' };

  beforeEach(() => {
    app = new Hono<AppEnv>();
    app.route('/api/self-test', selfTestRoutes);
    env = { DB: mockDB, KV: mockKV, JWT_SECRET: 'secret', ENVIRONMENT: 'test' } as any;
    vi.clearAllMocks();
    mockFirst.mockResolvedValue({ ok: 1 });
    mockKV.get.mockResolvedValue('ok');
    mockKV.list.mockResolvedValue({ keys: [{ name: 'graph:t1:access_token' }] });
  });

  it('should return 200 and pass when all checks succeed', async () => {
    const res = await app.request('/api/self-test', { headers }, env);
    expect(res.status).toBe(200);
    const json = await res.json() as any;
    expect(json.overall).toBe('pass');
    expect(json.checks).toHaveLength(4);
    json.checks.forEach((c: any) => expect(c.status).toBe('pass'));
  });

  it('should return 503 when database check fails', async () => {
    mockFirst.mockRejectedValue(new Error('DB down'));
    const res = await app.request('/api/self-test', { headers }, env);
    expect(res.status).toBe(503);
    const json = await res.json() as any;
    expect(json.overall).toBe('fail');
    const dbCheck = json.checks.find((c: any) => c.name === 'database');
    expect(dbCheck.status).toBe('fail');
  });

  it('should return 503 when KV check fails', async () => {
    mockKV.get.mockResolvedValue(null);
    const res = await app.request('/api/self-test', { headers }, env);
    expect(res.status).toBe(503);
    const json = await res.json() as any;
    const kvCheck = json.checks.find((c: any) => c.name === 'kv');
    expect(kvCheck.status).toBe('fail');
  });

  it('should return 503 when no Graph tokens exist', async () => {
    mockKV.list.mockResolvedValue({ keys: [] });
    const res = await app.request('/api/self-test', { headers }, env);
    expect(res.status).toBe(503);
    const json = await res.json() as any;
    const graphCheck = json.checks.find((c: any) => c.name === 'graph_token');
    expect(graphCheck.status).toBe('fail');
  });

  it('should include timing for each check', async () => {
    const res = await app.request('/api/self-test', { headers }, env);
    const json = await res.json() as any;
    json.checks.forEach((c: any) => {
      expect(c.ms).toBeGreaterThanOrEqual(0);
    });
  });

  it('should require authentication', async () => {
    const res = await app.request('/api/self-test', {}, env);
    expect(res.status).toBe(401);
  });
});
