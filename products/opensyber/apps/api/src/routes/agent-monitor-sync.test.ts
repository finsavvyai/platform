import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));

vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

import { agentMonitorSyncRoutes } from './agent-monitor-sync.js';

function makeEvent(overrides: Record<string, unknown> = {}) {
  return {
    id: crypto.randomUUID(),
    sessionId: 'sess_001',
    agentName: 'cursor',
    eventType: 'file_access',
    riskLevel: 'low',
    filePath: '/src/index.ts',
    summary: 'Read file',
    secretsDetected: 0,
    timestamp: new Date().toISOString(),
    ...overrides,
  };
}

describe('Agent Monitor Sync Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;
  const authHeaders = { Authorization: 'Bearer valid-token' };
  const jsonHeaders = { ...authHeaders, 'Content-Type': 'application/json' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch('user_test123'));
    vi.spyOn(console, 'error').mockImplementation(() => {});

    // Extend mock insert chain to support onConflictDoNothing
    mockDb._insertChain.values = vi.fn().mockReturnValue({
      onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
    });

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/agents/monitor', agentMonitorSyncRoutes);
  });

  // ─── Auth ──────────────────────────────────────────────────────────

  it('returns 401 without auth header', async () => {
    const res = await app.request('/api/agents/monitor/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events: [] }),
    }, mockEnv);
    expect(res.status).toBe(401);
  });

  // ─── POST /sync ────────────────────────────────────────────────────

  describe('POST /sync', () => {
    it('syncs valid events and returns count', async () => {
      const events = [makeEvent(), makeEvent({ agentName: 'claude' })];
      const res = await app.request('/api/agents/monitor/sync', {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ events }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.synced).toBe(2);
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('returns synced 0 for empty events array', async () => {
      const res = await app.request('/api/agents/monitor/sync', {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ events: [] }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.synced).toBe(0);
    });

    it('rejects more than 100 events', async () => {
      const events = Array.from({ length: 101 }, () => makeEvent());
      const res = await app.request('/api/agents/monitor/sync', {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ events }),
      }, mockEnv);

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Bad request');
    });

    it('rejects invalid risk level', async () => {
      const events = [makeEvent({ riskLevel: 'catastrophic' })];
      const res = await app.request('/api/agents/monitor/sync', {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ events }),
      }, mockEnv);

      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Bad request');
    });

    it('rejects invalid event type', async () => {
      const events = [makeEvent({ eventType: 'sql_injection' })];
      const res = await app.request('/api/agents/monitor/sync', {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ events }),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('rejects event with missing id', async () => {
      const events = [{ ...makeEvent(), id: undefined }];
      const res = await app.request('/api/agents/monitor/sync', {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ events }),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('rejects event with invalid timestamp', async () => {
      const events = [makeEvent({ timestamp: 'not-a-date' })];
      const res = await app.request('/api/agents/monitor/sync', {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ events }),
      }, mockEnv);

      expect(res.status).toBe(400);
    });

    it('accepts all valid event types', async () => {
      const types = ['file_access', 'file_write', 'terminal_command', 'secret_detected', 'network_request'];
      const events = types.map((eventType) => makeEvent({ eventType }));
      const res = await app.request('/api/agents/monitor/sync', {
        method: 'POST', headers: jsonHeaders,
        body: JSON.stringify({ events }),
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.synced).toBe(5);
    });
  });

  // ─── GET /summary ──────────────────────────────────────────────────

  describe('GET /summary', () => {
    it('returns correct risk breakdown', async () => {
      mockDb._setSelectResult([
        { id: '1', agent: 'cursor', agentName: 'cursor', risk: 'critical', riskLevel: 'critical', secretsCount: 1, secretsDetected: 1, createdAt: new Date().toISOString(), summary: 'test', type: 'file_read', eventType: 'file_access', path: '/a', filePath: '/a', sessionId: 's1', metadata: null },
        { id: '2', agent: 'claude', agentName: 'claude', risk: 'low', riskLevel: 'low', secretsCount: 0, secretsDetected: 0, createdAt: new Date().toISOString(), summary: 'test', type: 'file_read', eventType: 'file_access', path: '/b', filePath: '/b', sessionId: 's2', metadata: null },
        { id: '3', agent: 'cursor', agentName: 'cursor', risk: 'high', riskLevel: 'high', secretsCount: 0, secretsDetected: 0, createdAt: new Date().toISOString(), summary: 'test', type: 'bash_exec', eventType: 'terminal_command', path: null, filePath: null, sessionId: 's1', metadata: null },
      ]);

      const res = await app.request('/api/agents/monitor/summary', {
        headers: authHeaders,
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.totalEvents).toBe(3);
      expect(body.riskBreakdown.critical).toBe(1);
      expect(body.riskBreakdown.high).toBe(1);
      expect(body.riskBreakdown.low).toBe(1);
      expect(body.riskBreakdown.medium).toBe(0);
      expect(body.agents).toContain('cursor');
      expect(body.agents).toContain('claude');
      expect(body.recentEvents).toHaveLength(3);
    });

    it('returns empty summary when no events', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request('/api/agents/monitor/summary', {
        headers: authHeaders,
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.totalEvents).toBe(0);
      expect(body.agents).toEqual([]);
    });
  });

  // ─── GET /events ───────────────────────────────────────────────────

  describe('GET /events', () => {
    const mockEvent = (id: string, risk: string, agent: string, createdAt: string) => ({
      id, agent, agentName: agent, risk, riskLevel: risk,
      secretsCount: 0, secretsDetected: 0, createdAt,
      summary: 'test', type: 'file_read', eventType: 'file_access',
      path: '/a', filePath: '/a', sessionId: 's1', metadata: null,
    });

    it('returns paginated events', async () => {
      const events = Array.from({ length: 3 }, (_, i) =>
        mockEvent(`evt_${i}`, 'low', 'cursor', `2026-03-${15 - i}T00:00:00.000Z`),
      );
      mockDb._setSelectResult(events);

      const res = await app.request('/api/agents/monitor/events?limit=50', {
        headers: authHeaders,
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(3);
      expect(body.hasMore).toBe(false);
      expect(body.nextCursor).toBeNull();
    });

    it('returns hasMore when more events exist', async () => {
      // Return limit+1 events to trigger hasMore
      const events = Array.from({ length: 3 }, (_, i) =>
        mockEvent(`evt_${i}`, 'low', 'cursor', `2026-03-${15 - i}T00:00:00.000Z`),
      );
      mockDb._setSelectResult(events);

      const res = await app.request('/api/agents/monitor/events?limit=2', {
        headers: authHeaders,
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(2);
      expect(body.hasMore).toBe(true);
      expect(body.nextCursor).toBeTruthy();
    });

    it('filters by risk level', async () => {
      mockDb._setSelectResult([
        mockEvent('evt_1', 'critical', 'cursor', '2026-03-15T00:00:00.000Z'),
      ]);

      const res = await app.request('/api/agents/monitor/events?risk=critical', {
        headers: authHeaders,
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
    });

    it('filters by agent name', async () => {
      mockDb._setSelectResult([
        mockEvent('evt_1', 'low', 'claude', '2026-03-15T00:00:00.000Z'),
      ]);

      const res = await app.request('/api/agents/monitor/events?agent=claude', {
        headers: authHeaders,
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toHaveLength(1);
    });

    it('supports cursor-based pagination', async () => {
      mockDb._setSelectResult([]);
      const cursor = '2026-03-10T00:00:00.000Z';
      const res = await app.request(`/api/agents/monitor/events?cursor=${cursor}`, {
        headers: authHeaders,
      }, mockEnv);

      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.data).toEqual([]);
      expect(body.hasMore).toBe(false);
    });
  });
});
