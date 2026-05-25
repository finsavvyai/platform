import { Hono } from 'hono';
import { eq, and, or } from 'drizzle-orm';
import { assetRelations, assets } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import { authMiddleware } from '../../middleware/auth.js';
import { dbMiddleware } from '../../middleware/db.js';
import { requirePermission } from '../../middleware/rbac.js';
import { createRelationSchema } from './validation.js';

export const assetRelationRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
assetRelationRoutes.use('*', dbMiddleware, authMiddleware);

const read = requirePermission('cloud.read');
const write = requirePermission('cloud.write');

/** GET /api/asset-relations/:assetId — list relations for an asset */
assetRelationRoutes.get('/:assetId', read, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const assetId = c.req.param('assetId');
  if (!orgId) return c.json({ data: [] });

  const rows = await db.select().from(assetRelations)
    .where(and(
      eq(assetRelations.orgId, orgId),
      or(
        eq(assetRelations.sourceAssetId, assetId),
        eq(assetRelations.targetAssetId, assetId),
      ),
    ));
  return c.json({ data: rows });
});

/** POST /api/asset-relations — create relation */
assetRelationRoutes.post('/', write, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Bad Request', message: 'Organization context required' }, 400);

  const parsed = createRelationSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid body' }, 400);
  }

  // Verify both assets exist and belong to the org
  const [source] = await db.select({ id: assets.id }).from(assets)
    .where(and(eq(assets.id, parsed.data.sourceAssetId), eq(assets.orgId, orgId)));
  const [target] = await db.select({ id: assets.id }).from(assets)
    .where(and(eq(assets.id, parsed.data.targetAssetId), eq(assets.orgId, orgId)));
  if (!source) return c.json({ error: 'Not found', message: 'Source asset not found' }, 404);
  if (!target) return c.json({ error: 'Not found', message: 'Target asset not found' }, 404);

  const now = new Date().toISOString();
  const id = `rel-${crypto.randomUUID()}`;
  const metadata = parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null;

  await db.insert(assetRelations).values({
    id, orgId, ...parsed.data, metadata,
    firstSeenAt: now, lastSeenAt: now,
  });
  return c.json({ data: { id, ...parsed.data } }, 201);
});

/** DELETE /api/asset-relations/:id */
assetRelationRoutes.delete('/:id', write, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const relId = c.req.param('id');

  const [existing] = await db.select().from(assetRelations)
    .where(and(eq(assetRelations.id, relId), orgId ? eq(assetRelations.orgId, orgId) : undefined));
  if (!existing) return c.json({ error: 'Not found', message: 'Relation not found' }, 404);

  await db.delete(assetRelations).where(eq(assetRelations.id, relId));
  return c.json({ data: { deleted: true } });
});
