import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import {
  incidents, incidentEvents, incidentSecurityEvents, securityEvents,
} from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';

const incidentEventSchema = z.object({
  eventType: z.enum(['status_change', 'comment', 'evidence', 'assignment']),
  content: z.string().min(1),
});

const linkEventsSchema = z.object({
  securityEventIds: z.array(z.string().min(1)).min(1),
});

const incidentEventRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

incidentEventRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Get incident detail with timeline
incidentEventRoutes.get('/instances/:instanceId/incidents/:incidentId', async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const incidentId = c.req.param('incidentId');

  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const [incident] = await db.select().from(incidents)
    .where(and(eq(incidents.id, incidentId), eq(incidents.instanceId, instanceId)));
  if (!incident) return c.json({ error: 'Not found', message: 'Incident not found' }, 404);

  const timeline = await db.select().from(incidentEvents)
    .where(eq(incidentEvents.incidentId, incidentId))
    .orderBy(desc(incidentEvents.createdAt));

  const linkedEventRows = await db
    .select({ link: incidentSecurityEvents, event: securityEvents })
    .from(incidentSecurityEvents)
    .innerJoin(securityEvents, eq(incidentSecurityEvents.securityEventId, securityEvents.id))
    .where(eq(incidentSecurityEvents.incidentId, incidentId));

  return c.json({
    incident, timeline,
    linkedEvents: linkedEventRows.map((r) => r.event),
  });
});

// Add timeline event (comment/evidence)
incidentEventRoutes.post(
  '/instances/:instanceId/incidents/:incidentId/events',
  requirePermission('incident.update'),
  async (c) => {
    const db = c.get('db');
    const userId = c.get('userId');
    const instanceId = c.req.param('instanceId');
    const incidentId = c.req.param('incidentId');

    const instance = await verifyInstanceAccess(db as any, instanceId, userId, c.get('orgId'));
    if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

    const [incident] = await db.select().from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.instanceId, instanceId)));
    if (!incident) return c.json({ error: 'Not found', message: 'Incident not found' }, 404);

    const parsed = incidentEventSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'Invalid input' }, 400);
    }
    const body = parsed.data;

    const event = {
      id: crypto.randomUUID(), incidentId,
      eventType: body.eventType as typeof incidentEvents.$inferInsert.eventType,
      content: body.content, authorId: userId, createdAt: new Date().toISOString(),
    };

    await db.insert(incidentEvents).values(event);
    return c.json({ event }, 201);
  },
);

// Link security events to incident
incidentEventRoutes.post(
  '/instances/:instanceId/incidents/:incidentId/link',
  requirePermission('incident.update'),
  async (c) => {
    const db = c.get('db');
    const instanceId = c.req.param('instanceId');
    const incidentId = c.req.param('incidentId');

    const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
    if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

    const [incident] = await db.select().from(incidents)
      .where(and(eq(incidents.id, incidentId), eq(incidents.instanceId, instanceId)));
    if (!incident) return c.json({ error: 'Not found', message: 'Incident not found' }, 404);

    const parsed2 = linkEventsSchema.safeParse(await c.req.json());
    if (!parsed2.success) {
      return c.json({ error: 'Invalid input' }, 400);
    }
    const body = parsed2.data;

    const now = new Date().toISOString();
    let linked = 0;

    for (const eventId of body.securityEventIds) {
      const [secEvent] = await db.select().from(securityEvents)
        .where(and(eq(securityEvents.id, eventId), eq(securityEvents.instanceId, instanceId)));
      if (secEvent) {
        await db.insert(incidentSecurityEvents).values({
          id: crypto.randomUUID(), incidentId, securityEventId: eventId, linkedAt: now,
        });
        linked++;
      }
    }

    return c.json({ linked }, 201);
  },
);

export { incidentEventRoutes };
