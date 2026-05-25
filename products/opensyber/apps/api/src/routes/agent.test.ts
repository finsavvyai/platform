import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

const mockGetBase64 = vi.fn();
vi.mock('../services/skill-packages.js', () => ({
  skillPackageService: {
    getBase64: (...args: unknown[]) => mockGetBase64(...args),
  },
}));

import { agentRoutes } from './agent.js';
import { Hono } from 'hono';

describe('Agent Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  beforeEach(async () => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.spyOn(console, 'warn').mockImplementation(() => {});

    // Pre-store gateway token
    await mockEnv.CREDENTIAL_VAULT.put('gateway:inst_1', 'gw-token-123');

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/agent', agentRoutes);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  const gatewayHeaders = {
    'X-Gateway-Token': 'gw-token-123',
    'X-Instance-Id': 'inst_1',
  };

  describe('GET /api/agent/instances/:id/updates', () => {
    it('returns 401 without gateway token', async () => {
      const res = await app.request(
        '/api/agent/instances/inst_1/updates',
        {},
        mockEnv,
      );
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const res = await app.request(
        '/api/agent/instances/inst_1/updates',
        {
          headers: {
            'X-Gateway-Token': 'wrong-token',
            'X-Instance-Id': 'inst_1',
          },
        },
        mockEnv,
      );
      expect(res.status).toBe(401);
      expect(console.warn).toHaveBeenCalledWith('[GatewayAuth] Token mismatch for instance inst_1');
    });

    it('returns action none with valid gateway token', async () => {
      const res = await app.request(
        '/api/agent/instances/inst_1/updates',
        { headers: gatewayHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.action).toBe('none');
      expect(body.instanceId).toBe('inst_1');
    });

    it('returns action none when agent version matches latest', async () => {
      const res = await app.request(
        '/api/agent/instances/inst_1/updates',
        {
          headers: {
            ...gatewayHeaders,
            'X-Agent-Version': '0.2.0',
          },
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.action).toBe('none');
    });

    it('returns action update when agent version is outdated', async () => {
      const res = await app.request(
        '/api/agent/instances/inst_1/updates',
        {
          headers: {
            ...gatewayHeaders,
            'X-Agent-Version': '0.0.9',
          },
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.action).toBe('update');
      expect(body.latestVersion).toBe('0.2.0');
      expect(body.currentVersion).toBe('0.0.9');
    });

    it('returns action none when no version header sent', async () => {
      const res = await app.request(
        '/api/agent/instances/inst_1/updates',
        { headers: gatewayHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.action).toBe('none');
    });

    it('returns 403 when instance ID mismatch', async () => {
      const res = await app.request(
        '/api/agent/instances/inst_other/updates',
        { headers: gatewayHeaders }, // X-Instance-Id is inst_1
        mockEnv,
      );
      expect(res.status).toBe(403);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Forbidden');
    });
  });

  describe('GET /api/agent/skills/:slug/:version/package', () => {
    it('returns 401 without gateway token', async () => {
      const res = await app.request(
        '/api/agent/skills/github-integration/1.0.0/package',
        {},
        mockEnv,
      );
      expect(res.status).toBe(401);
    });

    it('returns base64 package data + sha256 for existing skill', async () => {
      mockGetBase64.mockResolvedValueOnce({
        base64: 'dGVzdC1wYWNrYWdl', // base64 of "test-package"
        sha256: 'a'.repeat(64),
      });

      const res = await app.request(
        '/api/agent/skills/github-integration/1.0.0/package',
        { headers: gatewayHeaders },
        mockEnv,
      );

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.slug).toBe('github-integration');
      expect(body.version).toBe('1.0.0');
      expect(body.packageBase64).toBe('dGVzdC1wYWNrYWdl');
      expect(body.packageSha256).toBe('a'.repeat(64));
      expect(mockGetBase64).toHaveBeenCalledWith(
        'github-integration',
        '1.0.0',
        mockEnv.STORAGE,
      );
    });

    it('returns 404 when package not found in R2', async () => {
      mockGetBase64.mockResolvedValueOnce(null);

      const res = await app.request(
        '/api/agent/skills/nonexistent/1.0.0/package',
        { headers: gatewayHeaders },
        mockEnv,
      );

      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Not found');
    });
  });
});
