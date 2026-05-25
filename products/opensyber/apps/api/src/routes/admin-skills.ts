import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { skills } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { adminMiddleware } from '../middleware/admin.js';

const adminSkillActionSchema = z.object({
  action: z.enum(['approve', 'reject']),
  reason: z.string().optional(),
});

const adminSkillRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

adminSkillRoutes.use('*', dbMiddleware, authMiddleware, adminMiddleware);

// GET /api/admin/skills — skills pending moderation
adminSkillRoutes.get('/', async (c) => {
  const db = c.get('db');

  const rows = await db.select().from(skills)
    .where(eq(skills.verificationStatus, 'pending'))
    .orderBy(desc(skills.createdAt))
    .limit(100);

  return c.json({ data: rows });
});

// PATCH /api/admin/skills/:id — approve or reject
adminSkillRoutes.patch('/:id', async (c) => {
  const db = c.get('db');
  const id = c.req.param('id');
  const parsed = adminSkillActionSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const [skill] = await db.select().from(skills).where(eq(skills.id, id)).limit(1);
  if (!skill) return c.json({ error: 'Not Found', message: 'Skill not found' }, 404);

  if (body.action === 'approve') {
    await db.update(skills).set({ verifiedAt: new Date().toISOString(), verificationStatus: 'approved' }).where(eq(skills.id, id));
  } else {
    await db.delete(skills).where(eq(skills.id, id));
  }

  return c.json({ data: { id, action: body.action } });
});

export { adminSkillRoutes };
