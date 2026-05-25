import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { alertRules, alerts } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { createAlertRuleSchema, updateAlertRuleSchema, updateAlertStatusSchema } from './validation/alerts.js';

const alertRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

alertRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// List alert rules
alertRoutes.get('/instances/:instanceId/alert-rules', async (c) => {
  const db = c.get('db');
  const instance = await verifyInstanceAccess(db as any, c.req.param('instanceId'), c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const rules = await db.select().from(alertRules).where(eq(alertRules.instanceId, c.req.param('instanceId')));
  c.header('Cache-Control', 'private, max-age=30, stale-while-revalidate=60');
  return c.json({ alertRules: rules });
});

// Create alert rule
alertRoutes.post('/instances/:instanceId/alert-rules', requirePermission('alert.create'), async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const parsed = createAlertRuleSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const rule = {
    id: crypto.randomUUID(), instanceId, name: body.name, eventType: body.eventType,
    severityFilter: body.severityFilter || null, threshold: body.threshold,
    windowMinutes: body.windowMinutes, cooldownMinutes: body.cooldownMinutes,
    isActive: true, createdAt: new Date().toISOString(),
  };

  await db.insert(alertRules).values(rule);
  return c.json({ alertRule: rule }, 201);
});

// Update alert rule
alertRoutes.patch('/instances/:instanceId/alert-rules/:id', requirePermission('alert.update'), async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const ruleId = c.req.param('id');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const [existing] = await db.select().from(alertRules)
    .where(and(eq(alertRules.id, ruleId), eq(alertRules.instanceId, instanceId)));
  if (!existing) return c.json({ error: 'Not found', message: 'Alert rule not found' }, 404);

  const parsed = updateAlertRuleSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name;
  if (body.eventType !== undefined) updates.eventType = body.eventType;
  if (body.severityFilter !== undefined) updates.severityFilter = body.severityFilter;
  if (body.threshold !== undefined) updates.threshold = body.threshold;
  if (body.windowMinutes !== undefined) updates.windowMinutes = body.windowMinutes;
  if (body.cooldownMinutes !== undefined) updates.cooldownMinutes = body.cooldownMinutes;
  if (body.isActive !== undefined) updates.isActive = body.isActive;

  await db.update(alertRules).set(updates).where(eq(alertRules.id, ruleId));
  const [updated] = await db.select().from(alertRules).where(eq(alertRules.id, ruleId));
  return c.json({ alertRule: updated });
});

// Delete alert rule
alertRoutes.delete('/instances/:instanceId/alert-rules/:id', requirePermission('alert.delete'), async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const ruleId = c.req.param('id');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const [existing] = await db.select().from(alertRules)
    .where(and(eq(alertRules.id, ruleId), eq(alertRules.instanceId, instanceId)));
  if (!existing) return c.json({ error: 'Not found', message: 'Alert rule not found' }, 404);

  await db.delete(alertRules).where(eq(alertRules.id, ruleId));
  return c.json({ deleted: true });
});

// List triggered alerts
const validAlertStatuses = new Set(['open', 'acknowledged', 'resolved']);

alertRoutes.get('/instances/:instanceId/alerts', async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  // Push status filter into SQL when valid — the composite index
  // (instance_id, status) from migration 0040 serves this directly.
  const statusFilter = c.req.query('status');
  const useStatusFilter = !!(statusFilter && validAlertStatuses.has(statusFilter));
  const where = useStatusFilter
    ? and(eq(alerts.instanceId, instanceId), eq(alerts.status, statusFilter as 'open' | 'acknowledged' | 'resolved'))
    : eq(alerts.instanceId, instanceId);

  const rows = await db.select().from(alerts).where(where).orderBy(desc(alerts.createdAt));
  // Defensive in-memory filter: ensures correctness if SQL filter is
  // bypassed (e.g. mocked DB in tests) and preserves legacy behaviour.
  const filtered = useStatusFilter ? rows.filter((r) => r.status === statusFilter) : rows;
  c.header('Cache-Control', 'private, max-age=10, stale-while-revalidate=20');
  return c.json({ alerts: filtered });
});

// Acknowledge or resolve an alert
alertRoutes.patch('/instances/:instanceId/alerts/:id', requirePermission('alert.update'), async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const alertId = c.req.param('id');
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const [existing] = await db.select().from(alerts)
    .where(and(eq(alerts.id, alertId), eq(alerts.instanceId, instanceId)));
  if (!existing) return c.json({ error: 'Not found', message: 'Alert not found' }, 404);

  const parsed = updateAlertStatusSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status: body.status };
  if (body.status === 'acknowledged') updates.acknowledgedAt = now;
  if (body.status === 'resolved') updates.resolvedAt = now;

  await db.update(alerts).set(updates).where(eq(alerts.id, alertId));
  const [updated] = await db.select().from(alerts).where(eq(alerts.id, alertId));
  return c.json({ alert: updated });
});

export { alertRoutes };
