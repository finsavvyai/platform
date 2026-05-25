import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { incidents, incidentEvents, instances } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { createIncidentSchema, updateIncidentSchema } from './validation/incidents.js';

const validStatuses = new Set(['open', 'investigating', 'contained', 'resolved', 'closed']);
const validSeverities = new Set(['low', 'medium', 'high', 'critical']);

const incidentRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

incidentRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// List incidents
incidentRoutes.get('/instances/:instanceId/incidents', async (c) => {
  const db = c.get('db');
  const instance = await verifyInstanceAccess(db as any, c.req.param('instanceId'), c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const rows = await db.select().from(incidents)
    .where(eq(incidents.instanceId, c.req.param('instanceId')))
    .orderBy(desc(incidents.createdAt));

  const statusFilter = c.req.query('status');
  const severityFilter = c.req.query('severity');
  let filtered = rows;
  if (statusFilter && validStatuses.has(statusFilter)) filtered = filtered.filter((r) => r.status === statusFilter);
  if (severityFilter && validSeverities.has(severityFilter)) filtered = filtered.filter((r) => r.severity === severityFilter);

  return c.json({ incidents: filtered });
});

// Create incident
incidentRoutes.post('/instances/:instanceId/incidents', requirePermission('incident.create'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const instanceId = c.req.param('instanceId');
  const instance = await verifyInstanceAccess(db as any, instanceId, userId, c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const parsed = createIncidentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const now = new Date().toISOString();
  const incident = {
    id: crypto.randomUUID(), instanceId, title: parsed.data.title, description: parsed.data.description || null,
    severity: parsed.data.severity as typeof incidents.$inferInsert.severity,
    status: 'open' as const, rootCause: null, remediation: null, assignee: null,
    orgId: c.get('orgId'), createdAt: now, updatedAt: now, resolvedAt: null,
  };

  await db.insert(incidents).values(incident);
  await db.insert(incidentEvents).values({
    id: crypto.randomUUID(), incidentId: incident.id, eventType: 'status_change',
    content: JSON.stringify({ from: null, to: 'open' }), authorId: userId, createdAt: now,
  });

  return c.json({ incident }, 201);
});

// Update incident
incidentRoutes.patch('/instances/:instanceId/incidents/:incidentId', requirePermission('incident.update'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const instanceId = c.req.param('instanceId');
  const incidentId = c.req.param('incidentId');

  const instance = await verifyInstanceAccess(db as any, instanceId, userId, c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const [existing] = await db.select().from(incidents)
    .where(and(eq(incidents.id, incidentId), eq(incidents.instanceId, instanceId)));
  if (!existing) return c.json({ error: 'Not found', message: 'Incident not found' }, 404);

  const parsed = updateIncidentSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { updatedAt: now };

  if (body.status !== undefined) {
    updates.status = body.status;
    if (body.status === 'resolved' || body.status === 'closed') updates.resolvedAt = now;
    await db.insert(incidentEvents).values({
      id: crypto.randomUUID(), incidentId, eventType: 'status_change',
      content: JSON.stringify({ from: existing.status, to: body.status }), authorId: userId, createdAt: now,
    });
  }

  if (body.rootCause !== undefined) updates.rootCause = body.rootCause;
  if (body.remediation !== undefined) updates.remediation = body.remediation;
  if (body.assignee !== undefined) {
    updates.assignee = body.assignee;
    await db.insert(incidentEvents).values({
      id: crypto.randomUUID(), incidentId, eventType: 'assignment',
      content: JSON.stringify({ assignee: body.assignee }), authorId: userId, createdAt: now,
    });
  }

  await db.update(incidents).set(updates).where(eq(incidents.id, incidentId));
  const [updated] = await db.select().from(incidents).where(eq(incidents.id, incidentId));

  return c.json({ incident: updated });
});

export { incidentRoutes };
