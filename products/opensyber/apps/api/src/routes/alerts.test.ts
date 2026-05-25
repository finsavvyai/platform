import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { Env, Variables } from '../types.js';
import { createMockEnv, createMockDb } from '../test/helpers.js';

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

import { alertRoutes } from './alerts.js';
import { notificationChannelRoutes } from './notification-channels.js';
import { Hono } from 'hono';

describe('Alert Routes', () => {
  let app: Hono<{ Bindings: Env; Variables: Variables }>;
  let mockEnv: Env;
  let mockDb: ReturnType<typeof createMockDb>;

  const authHeaders = { Authorization: 'Bearer valid-token' };

  const mockInstance = { id: 'inst_1', userId: 'user_test123' };

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    mockDb = createMockDb();
    (globalThis as any).__mockDb = mockDb;
    app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route('/api/security', alertRoutes);
    app.route('/api/security', notificationChannelRoutes);
  });

  // ─── Auth ──────────────────────────────────────────────────────────────────────

  it('returns 401 without auth for alert-rules', async () => {
    const res = await app.request('/api/security/instances/inst_1/alert-rules', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  it('returns 401 without auth for alerts', async () => {
    const res = await app.request('/api/security/instances/inst_1/alerts', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  it('returns 401 without auth for notification-channels', async () => {
    const res = await app.request('/api/security/user/notification-channels', {}, mockEnv);
    expect(res.status).toBe(401);
  });

  // ─── Alert Rules CRUD ─────────────────────────────────────────────────────────

  describe('GET /api/security/instances/:instanceId/alert-rules', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Instance not found');
    });

    it('returns alert rules list', async () => {
      const rule1 = { id: 'rule_1', instanceId: 'inst_1', name: 'CPU Alert', eventType: 'cpu_high' };
      const rule2 = { id: 'rule_2', instanceId: 'inst_1', name: 'Memory Alert', eventType: 'mem_high' };
      mockDb._setSelectResults([
        [mockInstance],
        [rule1, rule2],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alertRules).toHaveLength(2);
      expect(body.alertRules[0].name).toBe('CPU Alert');
      expect(body.alertRules[1].name).toBe('Memory Alert');
    });

    it('returns empty list when no rules exist', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alertRules).toHaveLength(0);
    });
  });

  describe('POST /api/security/instances/:instanceId/alert-rules', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Test Rule', eventType: 'cpu_high' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
    });

    it('creates an alert rule with required fields', async () => {
      mockDb._setSelectResult([mockInstance]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'CPU Spike', eventType: 'cpu_high' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.alertRule.name).toBe('CPU Spike');
      expect(body.alertRule.eventType).toBe('cpu_high');
      expect(body.alertRule.instanceId).toBe('inst_1');
      expect(body.alertRule.isActive).toBe(true);
      expect(body.alertRule.threshold).toBe(1);
      expect(body.alertRule.windowMinutes).toBe(60);
      expect(body.alertRule.cooldownMinutes).toBe(30);
      expect(body.alertRule.id).toBeDefined();
      expect(body.alertRule.createdAt).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('creates an alert rule with all optional fields', async () => {
      mockDb._setSelectResult([mockInstance]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: 'Custom Rule',
            eventType: 'anomaly_detected',
            severityFilter: 'critical',
            threshold: 5,
            windowMinutes: 15,
            cooldownMinutes: 120,
          }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.alertRule.severityFilter).toBe('critical');
      expect(body.alertRule.threshold).toBe(5);
      expect(body.alertRule.windowMinutes).toBe(15);
      expect(body.alertRule.cooldownMinutes).toBe(120);
    });

    it('returns 400 when name is missing', async () => {
      mockDb._setSelectResult([mockInstance]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ eventType: 'cpu_high' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('name');
    });

    it('returns 400 when eventType is missing', async () => {
      mockDb._setSelectResult([mockInstance]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Some Rule' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('eventType');
    });

    it('returns 400 when both name and eventType are missing', async () => {
      mockDb._setSelectResult([mockInstance]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
    });
  });

  describe('PATCH /api/security/instances/:instanceId/alert-rules/:id', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules/rule_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Instance not found');
    });

    it('returns 404 when alert rule not found', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [], // rule not found
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules/rule_unknown',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'Updated' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Alert rule not found');
    });

    it('updates an alert rule and returns updated version', async () => {
      const existingRule = { id: 'rule_1', instanceId: 'inst_1', name: 'Old Name', eventType: 'cpu_high', isActive: true };
      const updatedRule = { ...existingRule, name: 'New Name', isActive: false };

      mockDb._setSelectResults([
        [mockInstance],     // instance lookup
        [existingRule],     // existing rule lookup
        [updatedRule],      // updated rule read-back
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules/rule_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: 'New Name', isActive: false }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alertRule.name).toBe('New Name');
      expect(body.alertRule.isActive).toBe(false);
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it('updates only provided fields', async () => {
      const existingRule = { id: 'rule_1', instanceId: 'inst_1', name: 'Name', eventType: 'cpu_high', threshold: 1 };
      const updatedRule = { ...existingRule, threshold: 10 };

      mockDb._setSelectResults([
        [mockInstance],
        [existingRule],
        [updatedRule],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules/rule_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ threshold: 10 }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alertRule.threshold).toBe(10);
      expect(body.alertRule.name).toBe('Name');
    });
  });

  describe('DELETE /api/security/instances/:instanceId/alert-rules/:id', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules/rule_1',
        {
          method: 'DELETE',
          headers: authHeaders,
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Instance not found');
    });

    it('returns 404 when alert rule not found', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [], // rule not found
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules/rule_unknown',
        {
          method: 'DELETE',
          headers: authHeaders,
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Alert rule not found');
    });

    it('deletes an alert rule and returns confirmation', async () => {
      const existingRule = { id: 'rule_1', instanceId: 'inst_1', name: 'To Delete' };

      mockDb._setSelectResults([
        [mockInstance],
        [existingRule],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alert-rules/rule_1',
        {
          method: 'DELETE',
          headers: authHeaders,
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.deleted).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });
  });

  // ─── Triggered Alerts ─────────────────────────────────────────────────────────

  describe('GET /api/security/instances/:instanceId/alerts', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/alerts',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Instance not found');
    });

    it('returns alerts list', async () => {
      const alert1 = { id: 'alert_1', instanceId: 'inst_1', status: 'open', createdAt: '2026-01-01T00:00:00Z' };
      const alert2 = { id: 'alert_2', instanceId: 'inst_1', status: 'acknowledged', createdAt: '2026-01-02T00:00:00Z' };
      mockDb._setSelectResults([
        [mockInstance],
        [alert2, alert1], // ordered by desc createdAt
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alerts).toHaveLength(2);
    });

    it('returns empty list when no alerts exist', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alerts).toHaveLength(0);
    });

    it('filters alerts by status=open', async () => {
      const openAlert = { id: 'alert_1', instanceId: 'inst_1', status: 'open', createdAt: '2026-01-01T00:00:00Z' };
      const ackAlert = { id: 'alert_2', instanceId: 'inst_1', status: 'acknowledged', createdAt: '2026-01-02T00:00:00Z' };
      const resolvedAlert = { id: 'alert_3', instanceId: 'inst_1', status: 'resolved', createdAt: '2026-01-03T00:00:00Z' };
      mockDb._setSelectResults([
        [mockInstance],
        [resolvedAlert, ackAlert, openAlert],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts?status=open',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alerts).toHaveLength(1);
      expect(body.alerts[0].status).toBe('open');
    });

    it('filters alerts by status=acknowledged', async () => {
      const openAlert = { id: 'alert_1', status: 'open', createdAt: '2026-01-01T00:00:00Z' };
      const ackAlert = { id: 'alert_2', status: 'acknowledged', createdAt: '2026-01-02T00:00:00Z' };
      mockDb._setSelectResults([
        [mockInstance],
        [ackAlert, openAlert],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts?status=acknowledged',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alerts).toHaveLength(1);
      expect(body.alerts[0].status).toBe('acknowledged');
    });

    it('filters alerts by status=resolved', async () => {
      const openAlert = { id: 'alert_1', status: 'open', createdAt: '2026-01-01T00:00:00Z' };
      const resolvedAlert = { id: 'alert_2', status: 'resolved', createdAt: '2026-01-02T00:00:00Z' };
      mockDb._setSelectResults([
        [mockInstance],
        [resolvedAlert, openAlert],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts?status=resolved',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alerts).toHaveLength(1);
      expect(body.alerts[0].status).toBe('resolved');
    });

    it('ignores invalid status filter and returns all alerts', async () => {
      const alert1 = { id: 'alert_1', status: 'open', createdAt: '2026-01-01T00:00:00Z' };
      const alert2 = { id: 'alert_2', status: 'acknowledged', createdAt: '2026-01-02T00:00:00Z' };
      mockDb._setSelectResults([
        [mockInstance],
        [alert2, alert1],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts?status=invalid_status',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alerts).toHaveLength(2);
    });
  });

  describe('PATCH /api/security/instances/:instanceId/alerts/:id', () => {
    it('returns 404 when instance not found', async () => {
      mockDb._setSelectResult([]);
      const res = await app.request(
        '/api/security/instances/inst_1/alerts/alert_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'acknowledged' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Instance not found');
    });

    it('returns 404 when alert not found', async () => {
      mockDb._setSelectResults([
        [mockInstance],
        [], // alert not found
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts/alert_unknown',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'acknowledged' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Alert not found');
    });

    it('acknowledges an alert', async () => {
      const existingAlert = { id: 'alert_1', instanceId: 'inst_1', status: 'open' };
      const updatedAlert = { ...existingAlert, status: 'acknowledged', acknowledgedAt: '2026-02-24T00:00:00Z' };

      mockDb._setSelectResults([
        [mockInstance],
        [existingAlert],
        [updatedAlert],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts/alert_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'acknowledged' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alert.status).toBe('acknowledged');
      expect(body.alert.acknowledgedAt).toBeDefined();
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it('resolves an alert', async () => {
      const existingAlert = { id: 'alert_1', instanceId: 'inst_1', status: 'open' };
      const updatedAlert = { ...existingAlert, status: 'resolved', resolvedAt: '2026-02-24T00:00:00Z' };

      mockDb._setSelectResults([
        [mockInstance],
        [existingAlert],
        [updatedAlert],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts/alert_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'resolved' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.alert.status).toBe('resolved');
      expect(body.alert.resolvedAt).toBeDefined();
      expect(mockDb.update).toHaveBeenCalledTimes(1);
    });

    it('returns 400 for invalid status value', async () => {
      const existingAlert = { id: 'alert_1', instanceId: 'inst_1', status: 'open' };

      mockDb._setSelectResults([
        [mockInstance],
        [existingAlert],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts/alert_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'invalid' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('acknowledged');
      expect(body.message).toContain('resolved');
    });

    it('returns 400 when status is missing', async () => {
      const existingAlert = { id: 'alert_1', instanceId: 'inst_1', status: 'open' };

      mockDb._setSelectResults([
        [mockInstance],
        [existingAlert],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts/alert_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
    });

    it('returns 400 when status is open (cannot reopen)', async () => {
      const existingAlert = { id: 'alert_1', instanceId: 'inst_1', status: 'acknowledged' };

      mockDb._setSelectResults([
        [mockInstance],
        [existingAlert],
      ]);

      const res = await app.request(
        '/api/security/instances/inst_1/alerts/alert_1',
        {
          method: 'PATCH',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ status: 'open' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
    });
  });

  // ─── Notification Channels ────────────────────────────────────────────────────

  describe('GET /api/security/user/notification-channels', () => {
    it('returns channels for user', async () => {
      const channel1 = { id: 'ch_1', userId: 'user_test123', channelType: 'email', name: 'My Email' };
      const channel2 = { id: 'ch_2', userId: 'user_test123', channelType: 'slack', name: 'My Slack' };
      mockDb._setSelectResult([channel1, channel2]);

      const res = await app.request(
        '/api/security/user/notification-channels',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.channels).toHaveLength(2);
      expect(body.channels[0].channelType).toBe('email');
      expect(body.channels[1].channelType).toBe('slack');
    });

    it('returns empty list when user has no channels', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request(
        '/api/security/user/notification-channels',
        { headers: authHeaders },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.channels).toHaveLength(0);
    });
  });

  describe('POST /api/security/user/notification-channels', () => {
    it('creates an email notification channel', async () => {
      const res = await app.request(
        '/api/security/user/notification-channels',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelType: 'email',
            name: 'Work Email',
            config: JSON.stringify({ email: 'test@example.com' }),
          }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.channel.channelType).toBe('email');
      expect(body.channel.name).toBe('Work Email');
      expect(body.channel.userId).toBe('user_test123');
      expect(body.channel.isActive).toBe(true);
      expect(body.channel.id).toBeDefined();
      expect(body.channel.createdAt).toBeDefined();
      expect(mockDb.insert).toHaveBeenCalledTimes(1);
    });

    it('creates a webhook notification channel', async () => {
      const res = await app.request(
        '/api/security/user/notification-channels',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelType: 'webhook',
            name: 'My Webhook',
            config: JSON.stringify({ url: 'https://hooks.example.com/alert' }),
          }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.channel.channelType).toBe('webhook');
    });

    it('creates a slack notification channel', async () => {
      const res = await app.request(
        '/api/security/user/notification-channels',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelType: 'slack',
            name: 'Alerts Channel',
            config: JSON.stringify({ webhook_url: 'https://hooks.slack.com/services/xxx' }),
          }),
        },
        mockEnv,
      );
      expect(res.status).toBe(201);
      const body = (await res.json()) as any;
      expect(body.channel.channelType).toBe('slack');
    });

    it('returns 400 when required fields are missing', async () => {
      const res = await app.request(
        '/api/security/user/notification-channels',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({ channelType: 'email' }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.error).toBe('Bad request');
    });

    it('returns 400 for invalid channelType', async () => {
      const res = await app.request(
        '/api/security/user/notification-channels',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelType: 'sms',
            name: 'SMS Channel',
            config: JSON.stringify({ phone: '+1234567890' }),
          }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('Invalid channelType');
    });

    it('returns 400 when config is not valid JSON', async () => {
      const res = await app.request(
        '/api/security/user/notification-channels',
        {
          method: 'POST',
          headers: { ...authHeaders, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            channelType: 'email',
            name: 'Bad Config',
            config: 'not-valid-json{',
          }),
        },
        mockEnv,
      );
      expect(res.status).toBe(400);
      const body = (await res.json()) as any;
      expect(body.message).toContain('config must be valid JSON');
    });
  });

  describe('DELETE /api/security/user/notification-channels/:id', () => {
    it('returns 404 when channel not found', async () => {
      mockDb._setSelectResult([]);

      const res = await app.request(
        '/api/security/user/notification-channels/ch_unknown',
        {
          method: 'DELETE',
          headers: authHeaders,
        },
        mockEnv,
      );
      expect(res.status).toBe(404);
      const body = (await res.json()) as any;
      expect(body.message).toBe('Notification channel not found');
    });

    it('deletes a notification channel', async () => {
      const existingChannel = { id: 'ch_1', userId: 'user_test123', channelType: 'email', name: 'To Delete' };
      mockDb._setSelectResult([existingChannel]);

      const res = await app.request(
        '/api/security/user/notification-channels/ch_1',
        {
          method: 'DELETE',
          headers: authHeaders,
        },
        mockEnv,
      );
      expect(res.status).toBe(200);
      const body = (await res.json()) as any;
      expect(body.deleted).toBe(true);
      expect(mockDb.delete).toHaveBeenCalledTimes(1);
    });
  });
});
