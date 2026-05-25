import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { agentActivityFindingsRoutes } from './agent-activity-findings.js';
import { createMockDb, createMockEnv } from '../test/helpers.js';
import { findRelatedFindings } from '../services/activity-cspm-linker.js';
import { mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as any).__mockDb) }));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
    }
    c.set('userId', 'user-123');
    await next();
  },
}));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: any, next: any) => {
    const orgId = c.req.header('X-Org-Id') ?? null;
    const role = orgId ? c.req.header('X-Test-Role') ?? 'admin' : null;
    c.set('orgId', orgId);
    c.set('role', role);
    c.set('orgMember', orgId ? { orgId, userId: 'user-123', role } : null);
    await next();
  },
}));

// Mock the cross-linker service
vi.mock('../services/activity-cspm-linker.js', () => ({
  findRelatedFindings: vi.fn(),
}));

const mockFindRelatedFindings = vi.mocked(findRelatedFindings);

describe('Agent Activity Findings Routes', () => {
  let app: Hono;
  let mockDb: ReturnType<typeof createMockDb>;
  let mockEnv: ReturnType<typeof createMockEnv>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockDb = createMockDb();
    mockEnv = createMockEnv();
    (globalThis as any).__mockDb = mockDb;
    app = new Hono();
    app.route('/api/activity', agentActivityFindingsRoutes);

    // Mock fetch for Clerk authentication
    vi.stubGlobal('fetch', mockAuthFetch());

    // Reset mock service
    mockFindRelatedFindings.mockReset();
    mockFindRelatedFindings.mockResolvedValue([]);
  });

  describe('GET /:activityId/related-findings', () => {
    it('should return related findings for owned activity', async () => {
      const userId = 'user-123';
      const activityId = 'activity-1';

      const mockActivity = {
        id: activityId,
        userId,
        orgId: null,
        sessionId: 'session-1',
        agent: 'cline',
        type: 'bash_exec',
        risk: 'high',
        path: '/home/user/.aws/credentials',
        summary: 'aws s3 ls',
        secretsCount: 0,
        createdAt: '2025-03-04T00:00:00.000Z',
      };

      const mockFindings = [
        {
          id: 'finding-1',
          severity: 'high',
          resourceId: 's3-bucket',
          resourceType: 's3-bucket',
          title: 'S3 Bucket Public',
        },
      ];

      mockDb._setSelectResults([[mockActivity]]);
      mockFindRelatedFindings.mockResolvedValue(mockFindings);

      const response = await app.request(
        `/api/activity/${activityId}/related-findings`,
        {
          headers: {
            'Authorization': `Bearer test-token`,
          },
        },
        mockEnv,
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json).toEqual({ data: mockFindings });
      expect(mockFindRelatedFindings).toHaveBeenCalledWith(
        mockDb,
        mockActivity,
        null,
      );
    });

    it('should return 404 when activity not found', async () => {
      mockDb._setSelectResults([[]]);

      const response = await app.request(
        '/api/activity/not-found/related-findings',
        {
          headers: {
            'Authorization': `Bearer test-token`,
          },
        },
        mockEnv,
      );

      expect(response.status).toBe(404);
      const json = await response.json();
      expect(json.error).toBe('Not found');
    });

    it('should handle empty findings', async () => {
      const activityId = 'activity-1';

      const mockActivity = {
        id: activityId,
        userId: 'user-123',
        orgId: null,
        sessionId: 'session-1',
        agent: 'cline',
        type: 'bash_exec',
        risk: 'low',
        path: null,
        summary: 'git status',
        secretsCount: 0,
        createdAt: '2025-03-04T00:00:00.000Z',
      };

      mockDb._setSelectResults([[mockActivity]]);
      mockFindRelatedFindings.mockResolvedValue([]);

      const response = await app.request(
        `/api/activity/${activityId}/related-findings`,
        {
          headers: {
            'Authorization': `Bearer test-token`,
          },
        },
        mockEnv,
      );

      expect(response.status).toBe(200);
      const json = await response.json();
      expect(json.data).toEqual([]);
    });
  });
});
