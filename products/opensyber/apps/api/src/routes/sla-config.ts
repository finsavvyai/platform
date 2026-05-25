import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { slaConfigs } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';

const slaConfigSchema = z.object({
  targetUptime: z.number().min(90).max(100).optional(),
  checkIntervalMinutes: z.number().int().min(1).max(60).optional(),
  alertOnBreach: z.boolean().optional(),
});

const slaConfigRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

slaConfigRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Get org SLA config
slaConfigRoutes.get('/:orgId/sla', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Organization context required' }, 400);
  }

  const db = c.get('db');
  const [config] = await db.select().from(slaConfigs).where(eq(slaConfigs.orgId, orgId));

  return c.json({ data: config || null });
});

// Update org SLA config
slaConfigRoutes.put('/:orgId/sla', requirePermission('org.update'), async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Organization context required' }, 400);
  }

  const db = c.get('db');
  const parsed = slaConfigSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const [existing] = await db.select().from(slaConfigs).where(eq(slaConfigs.orgId, orgId));

  if (existing) {
    await db.update(slaConfigs).set({
      targetUptime: body.targetUptime ?? existing.targetUptime,
      checkIntervalMinutes: body.checkIntervalMinutes ?? existing.checkIntervalMinutes,
      alertOnBreach: body.alertOnBreach ?? existing.alertOnBreach,
    }).where(eq(slaConfigs.orgId, orgId));

    const [updated] = await db.select().from(slaConfigs).where(eq(slaConfigs.orgId, orgId));
    return c.json({ data: updated });
  }

  const newConfig = {
    id: generateId(),
    orgId,
    targetUptime: body.targetUptime ?? 99.9,
    checkIntervalMinutes: body.checkIntervalMinutes ?? 5,
    alertOnBreach: body.alertOnBreach ?? true,
    createdAt: new Date().toISOString(),
  };

  await db.insert(slaConfigs).values(newConfig);
  return c.json({ data: newConfig }, 201);
});

export { slaConfigRoutes };
