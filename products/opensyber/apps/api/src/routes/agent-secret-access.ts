/**
 * Agent Secret Access Report Routes
 *
 * Provides visibility into which agents accessed which secrets.
 */
import { Hono } from 'hono';
import { eq, and, desc } from 'drizzle-orm';
import { agentSecretAccess } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { createSecretAccessSchema } from './validation/agent-secret-access.js';

export const agentSecretAccessRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

agentSecretAccessRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

agentSecretAccessRoutes.get('/secret-access', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const records = await db.select().from(agentSecretAccess)
    .where(eq(agentSecretAccess.orgId, orgId))
    .orderBy(desc(agentSecretAccess.accessedAt))
    .limit(100);
  return c.json({ data: records });
});

agentSecretAccessRoutes.get('/secret-access/:agentId', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const records = await db.select().from(agentSecretAccess)
    .where(and(
      eq(agentSecretAccess.orgId, orgId),
      eq(agentSecretAccess.agentId, c.req.param('agentId')),
    ))
    .orderBy(desc(agentSecretAccess.accessedAt));
  return c.json({ data: records });
});

agentSecretAccessRoutes.post('/secret-access', requirePermission('audit.write'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const parsed = createSecretAccessSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const id = crypto.randomUUID();
  await db.insert(agentSecretAccess).values({
    id, orgId,
    agentId: parsed.data.agentId,
    secretName: parsed.data.secretName,
    accessType: parsed.data.accessType,
  });
  return c.json({ data: { id } }, 201);
});
