import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { z } from 'zod';
import { vulnerabilityScans, vulnerabilities } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';

const updateVulnStatusSchema = z.object({
  status: z.enum(['open', 'in_progress', 'fixed', 'ignored', 'false_positive']),
});

const securityVulnRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

securityVulnRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Get vulnerability scans
securityVulnRoutes.get('/instances/:instanceId/vulnerability-scans', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const scans = await db.select().from(vulnerabilityScans)
    .where(eq(vulnerabilityScans.instanceId, instanceId))
    .orderBy(desc(vulnerabilityScans.scannedAt));

  return c.json({ scans });
});

// Get vulnerabilities
securityVulnRoutes.get('/instances/:instanceId/vulnerabilities', async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const severityFilter = c.req.query('severity');
  const statusFilter = c.req.query('status');
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  let rows = await db.select().from(vulnerabilities)
    .where(eq(vulnerabilities.instanceId, instanceId))
    .orderBy(desc(vulnerabilities.createdAt));

  if (severityFilter) rows = rows.filter((r: any) => r.severity === severityFilter);
  if (statusFilter) rows = rows.filter((r: any) => r.status === statusFilter);

  return c.json({ vulnerabilities: rows });
});

// Update vulnerability status
securityVulnRoutes.patch('/instances/:instanceId/vulnerabilities/:id', requirePermission('policy.update'), async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');
  const instanceId = c.req.param('instanceId');
  const vulnId = c.req.param('id');
  const orgId = c.get('orgId');

  const instance = await verifyInstanceAccess(db, instanceId, userId, orgId);
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const [existing] = await db.select().from(vulnerabilities)
    .where(and(eq(vulnerabilities.id, vulnId), eq(vulnerabilities.instanceId, instanceId)));

  if (!existing) return c.json({ error: 'Not found', message: 'Vulnerability not found' }, 404);

  const parsed = updateVulnStatusSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }

  await db.update(vulnerabilities).set({ status: parsed.data.status as any }).where(eq(vulnerabilities.id, vulnId));
  const [updated] = await db.select().from(vulnerabilities).where(eq(vulnerabilities.id, vulnId));

  return c.json({ vulnerability: updated });
});

export { securityVulnRoutes };
