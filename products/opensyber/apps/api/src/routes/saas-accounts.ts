/**
 * SaaS Account Routes
 *
 * GET /api/saas/accounts — List SaaS connections
 * POST /api/saas/accounts — Connect a SaaS account
 * DELETE /api/saas/accounts/:id — Disconnect
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { createDb } from '../lib/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { saasAccounts } from '@opensyber/db';
import { eq, and } from 'drizzle-orm';
import { createSaasAccountSchema } from './validation/saas-accounts.js';

const saasAccountRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

saasAccountRoutes.use('*', authMiddleware);

saasAccountRoutes.get('/accounts', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  const db = createDb(c.env.DB);
  const accounts = await db.select().from(saasAccounts).where(eq(saasAccounts.orgId, orgId));
  return c.json({ data: accounts });
});

saasAccountRoutes.post('/accounts', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  const parsed = createSaasAccountSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const body = parsed.data;

  const db = createDb(c.env.DB);
  const id = crypto.randomUUID();
  await db.insert(saasAccounts).values({
    id, orgId, provider: body.provider, name: body.name,
    connectionType: body.connectionType,
  });

  return c.json({ data: { id } }, 201);
});

saasAccountRoutes.delete('/accounts/:id', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Org context required' }, 400);

  const db = createDb(c.env.DB);
  await db.delete(saasAccounts).where(and(eq(saasAccounts.id, c.req.param('id')), eq(saasAccounts.orgId, orgId)));
  return c.json({ data: { deleted: true } });
});

export { saasAccountRoutes };
