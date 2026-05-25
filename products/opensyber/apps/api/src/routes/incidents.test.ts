import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb, mockAuthFetch } from '../test/helpers.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as any).__mockDb),
}));
vi.mock('../middleware/auth.js', () => ({
  authMiddleware: async (c: any, next: any) => {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Unauthorized', message: 'Missing or invalid authorization header' }, 401);
    }
    c.set('userId', 'user_test123');
    await next();
  },
}));
vi.mock('../middleware/rbac.js', () => ({
  resolveOrgContext: async (c: any, next: any) => {
    c.set('orgId', c.req.header('X-Org-Id') ?? null);
    await next();
  },
  requirePermission: () => async (_c: any, next: any) => { await next(); },
}));

vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

import { incidentRoutes } from './incidents.js';
import { incidentEventRoutes } from './incident-events.js';
import { Hono } from 'hono';

describe('Incident Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  const authHeaders = { Authorization: 'Bearer valid-token' };

  const mockInstance = { id: 'inst_1', userId: 'user_test123' };

  const mockIncident = {
    id: 'inc_1',
    instanceId: 'inst_1',
    title: 'Suspicious activity detected',
    description: 'Unusual login pattern observed',
    severity: 'high',
    status: 'open',
    rootCause: null,
    remediation: null,
    assignee: null,
    createdAt: '2026-01-15T10:00:00.000Z',
    updatedAt: '2026-01-15T10:00:00.000Z',
    resolvedAt: null,
  };

  const mockIncident2 = {
    ...mockIncident,
    id: 'inc_2',
    title: 'Brute force attempt',
    severity: 'critical',
    status: 'investigating',
  };

  const mockIncident3 = {
    ...mockIncident,
    id: 'inc_3',
    title: 'Low priority notice',
    severity: 'low',
    status: 'resolved',
    resolvedAt: '2026-01-16T12:00:00.000Z',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    vi.stubGlobal('fetch', mockAuthFetch('user_test123'));

    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/security', incidentRoutes);
    app.route('/api/security', incidentEventRoutes);
  });

  // ─── Auth ─────────────────────────────────────────────────────────────
  it('returns 401 without auth', async () => {
    const res = await app.request('/api/security/instances/inst_1/incidents', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  // ─── GET /instances/:id/incidents ─────────────────────────────────────
  describe('GET /api/security/instances/:instanceId/incidents', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/incidents',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Not found');
    });

    it('returns incidents list', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident, mockIncident2],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.incidents).toHaveLength(2);
      expect(body.incidents[0].id).toBe('inc_1');
      expect(body.incidents[1].id).toBe('inc_2');
    });

    it('returns empty array when no incidents exist', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.incidents).toHaveLength(0);
    });

    it('filters by status', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident, mockIncident2, mockIncident3],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents?status=open',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.incidents).toHaveLength(1);
      expect(body.incidents[0].status).toBe('open');
    });

    it('filters by severity', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident, mockIncident2, mockIncident3],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents?severity=critical',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.incidents).toHaveLength(1);
      expect(body.incidents[0].severity).toBe('critical');
    });

    it('filters by both status and severity', async () => {
      const openCritical = { ...mockIncident, id: 'inc_4', severity: 'critical', status: 'open' };
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident, mockIncident2, mockIncident3, openCritical],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents?status=open&severity=critical',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.incidents).toHaveLength(1);
      expect(body.incidents[0].id).toBe('inc_4');
    });

    it('ignores invalid status filter', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident, mockIncident2],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents?status=bogus',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      // invalid filter is ignored, all rows returned
      expect(body.incidents).toHaveLength(2);
    });

    it('ignores invalid severity filter', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident, mockIncident2],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents?severity=extreme',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.incidents).toHaveLength(2);
    });
  });

  // ─── POST /instances/:id/incidents ────────────────────────────────────
  describe('POST /api/security/instances/:instanceId/incidents', () => {
    it('creates an incident', async () => {
      mockDb._setSelectResults([
        [mockInstance],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'New incident',
            description: 'Something happened',
            severity: 'high',
          }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.incident).toBeDefined();
      expect(body.incident.title).toBe('New incident');
      expect(body.incident.description).toBe('Something happened');
      expect(body.incident.severity).toBe('high');
      expect(body.incident.status).toBe('open');
      expect(body.incident.resolvedAt).toBeNull();
      // Should insert the incident and an initial timeline event
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('creates an incident without optional description', async () => {
      mockDb._setSelectResults([
        [mockInstance],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: 'No description incident',
            severity: 'low',
          }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.incident.description).toBeNull();
    });

    it('returns 400 for missing title', async () => {
      mockDb._setSelectResults([
        [mockInstance],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ severity: 'high' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Required');
    });

    it('returns 400 for missing severity', async () => {
      mockDb._setSelectResults([
        [mockInstance],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Needs severity' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Required');
    });

    it('returns 400 for invalid severity enum', async () => {
      mockDb._setSelectResults([
        [mockInstance],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Bad severity', severity: 'extreme' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('Invalid enum value');
    });

    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request(
        '/api/security/instances/inst_unknown/incidents',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ title: 'Test', severity: 'low' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });
  });

  // ─── GET /instances/:id/incidents/:incidentId ─────────────────────────
  describe('GET /api/security/instances/:instanceId/incidents/:incidentId', () => {
    it('returns incident detail with timeline and linked events', async () => {
      const timelineEvent = {
        id: 'te_1',
        incidentId: 'inc_1',
        eventType: 'status_change',
        content: JSON.stringify({ from: null, to: 'open' }),
        authorId: 'user_test123',
        createdAt: '2026-01-15T10:00:00.000Z',
      };

      const linkedSecurityEvent = {
        id: 'se_1',
        instanceId: 'inst_1',
        eventType: 'anomaly_detected',
        severity: 'high',
        createdAt: '2026-01-15T09:00:00.000Z',
      };

      mockDb._setSelectResults([
        [mockInstance],           // instance lookup
        [mockIncident],           // incident lookup
        [timelineEvent],          // timeline events
        [{ link: { id: 'link_1' }, event: linkedSecurityEvent }], // linked events join
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.incident).toBeDefined();
      expect(body.incident.id).toBe('inc_1');
      expect(body.timeline).toHaveLength(1);
      expect(body.timeline[0].eventType).toBe('status_change');
      expect(body.linkedEvents).toHaveLength(1);
      expect(body.linkedEvents[0].id).toBe('se_1');
    });

    it('returns 404 when incident not found', async () => {
      mockDb._setSelectResults([
        [mockInstance],  // instance found
        [],              // incident not found
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_nonexistent',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Incident not found');
    });

    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request(
        '/api/security/instances/inst_unknown/incidents/inc_1',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Instance not found');
    });

    it('returns empty timeline and linkedEvents when none exist', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
        [],  // no timeline events
        [],  // no linked events
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.timeline).toHaveLength(0);
      expect(body.linkedEvents).toHaveLength(0);
    });
  });

  // ─── PATCH /instances/:id/incidents/:incidentId ───────────────────────
  describe('PATCH /api/security/instances/:instanceId/incidents/:incidentId', () => {
    it('updates status', async () => {
      const updatedIncident = { ...mockIncident, status: 'investigating', updatedAt: '2026-01-16T00:00:00.000Z' };
      mockDb._setSelectResults([
        [mockInstance],       // instance lookup
        [mockIncident],       // existing incident lookup
        [updatedIncident],    // re-fetch after update
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'investigating' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.incident).toBeDefined();
      // Should insert a status_change timeline event
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('sets resolvedAt when status changed to resolved', async () => {
      const resolvedIncident = { ...mockIncident, status: 'resolved', resolvedAt: '2026-01-16T00:00:00.000Z' };
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
        [resolvedIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'resolved' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      // Verify update was called with resolvedAt set
      expect(mockDb.update).toHaveBeenCalled();
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'resolved', resolvedAt: expect.any(String) }),
      );
    });

    it('sets resolvedAt when status changed to closed', async () => {
      const closedIncident = { ...mockIncident, status: 'closed', resolvedAt: '2026-01-16T00:00:00.000Z' };
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
        [closedIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'closed' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'closed', resolvedAt: expect.any(String) }),
      );
    });

    it('returns 400 for invalid status', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'invalid_status' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('Invalid enum value');
    });

    it('updates root cause and remediation', async () => {
      const updatedIncident = {
        ...mockIncident,
        rootCause: 'Weak password policy',
        remediation: 'Enforce 2FA',
      };
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
        [updatedIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ rootCause: 'Weak password policy', remediation: 'Enforce 2FA' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          rootCause: 'Weak password policy',
          remediation: 'Enforce 2FA',
          updatedAt: expect.any(String),
        }),
      );
    });

    it('updates assignee and creates assignment timeline event', async () => {
      const updatedIncident = { ...mockIncident, assignee: 'user_analyst' };
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
        [updatedIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ assignee: 'user_analyst' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      // Should insert an assignment timeline event
      expect(mockDb.insert).toHaveBeenCalled();
      expect(mockDb._updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({ assignee: 'user_analyst' }),
      );
    });

    it('returns 404 when incident not found', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_missing',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'investigating' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Incident not found');
    });

    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request(
        '/api/security/instances/inst_unknown/incidents/inc_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'investigating' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /instances/:id/incidents/:incidentId/events ─────────────────
  describe('POST /api/security/instances/:instanceId/incidents/:incidentId/events', () => {
    it('adds a timeline event', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1/events',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'comment', content: 'Investigating the issue' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.event).toBeDefined();
      expect(body.event.eventType).toBe('comment');
      expect(body.event.content).toBe('Investigating the issue');
      expect(body.event.authorId).toBe('user_test123');
      expect(mockDb.insert).toHaveBeenCalled();
    });

    it('adds an evidence timeline event', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1/events',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'evidence', content: 'Screenshot of suspicious login' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.event.eventType).toBe('evidence');
    });

    it('returns 400 for missing required fields', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1/events',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'comment' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Invalid input');
    });

    it('validates eventType enum', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1/events',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'invalid_type', content: 'Some content' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Invalid input');
    });

    it('returns 404 when incident not found', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_missing/events',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'comment', content: 'Test' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Incident not found');
    });

    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request(
        '/api/security/instances/inst_unknown/incidents/inc_1/events',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'comment', content: 'Test' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });
  });

  // ─── POST /instances/:id/incidents/:incidentId/link ───────────────────
  describe('POST /api/security/instances/:instanceId/incidents/:incidentId/link', () => {
    it('links security events to incident', async () => {
      const secEvent1 = { id: 'se_1', instanceId: 'inst_1', eventType: 'anomaly_detected', severity: 'high' };
      const secEvent2 = { id: 'se_2', instanceId: 'inst_1', eventType: 'skill_blocked', severity: 'warning' };

      mockDb._setSelectResults([
        [mockInstance],     // instance lookup
        [mockIncident],     // incident lookup
        [secEvent1],        // first security event verification
        [secEvent2],        // second security event verification
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1/link',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ securityEventIds: ['se_1', 'se_2'] }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.linked).toBe(2);
      // 2 link inserts
      expect(mockDb.insert).toHaveBeenCalledTimes(2);
    });

    it('skips security events that do not exist', async () => {
      const secEvent1 = { id: 'se_1', instanceId: 'inst_1', eventType: 'anomaly_detected', severity: 'high' };

      mockDb._setSelectResults([
        [mockInstance],     // instance lookup
        [mockIncident],     // incident lookup
        [secEvent1],        // first event exists
        [],                 // second event does not exist
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1/link',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ securityEventIds: ['se_1', 'se_nonexistent'] }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.linked).toBe(1);
      // Only 1 link insert since 1 event was not found
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('returns 400 for missing securityEventIds', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1/link',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Invalid input');
    });

    it('returns 400 for empty securityEventIds array', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [mockIncident],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_1/link',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ securityEventIds: [] }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it('returns 404 when incident not found', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/incidents/inc_missing/link',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ securityEventIds: ['se_1'] }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Incident not found');
    });

    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request(
        '/api/security/instances/inst_unknown/incidents/inc_1/link',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ securityEventIds: ['se_1'] }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });
  });
});
