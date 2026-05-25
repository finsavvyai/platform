import { Hono } from 'hono';
import { eq, and, lt, desc } from 'drizzle-orm';
import { assets } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import { authMiddleware } from '../../middleware/auth.js';
import { dbMiddleware } from '../../middleware/db.js';
import { requirePermission } from '../../middleware/rbac.js';
import {
  createAssetSchema,
  updateAssetSchema,
  listAssetsQuerySchema,
} from './validation.js';

export const assetRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
assetRoutes.use('*', dbMiddleware, authMiddleware);

const read = requirePermission('cloud.read');
const write = requirePermission('cloud.write');
const admin = requirePermission('cloud.admin');

/** GET /api/assets — list assets for org */
assetRoutes.get('/', read, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ data: [], hasMore: false });

  const query = listAssetsQuerySchema.safeParse(c.req.query());
  if (!query.success) {
    return c.json({ error: 'Validation failed', message: query.error.issues[0]?.message ?? 'Invalid query' }, 400);
  }
  const { assetType, sensitivity, status, crownJewel, cursor, limit } = query.data;
  const conditions = [eq(assets.orgId, orgId)];
  if (assetType) conditions.push(eq(assets.assetType, assetType));
  if (sensitivity) conditions.push(eq(assets.sensitivity, sensitivity));
  if (status) conditions.push(eq(assets.status, status));
  if (crownJewel !== undefined) conditions.push(eq(assets.isCrownJewel, crownJewel === 'true'));
  if (cursor) conditions.push(lt(assets.id, cursor));

  const rows = await db.select().from(assets)
    .where(and(...conditions))
    .orderBy(desc(assets.createdAt))
    .limit(limit + 1);

  const hasMore = rows.length > limit;
  const data = hasMore ? rows.slice(0, limit) : rows;
  return c.json({ data, hasMore, nextCursor: hasMore ? data[data.length - 1]?.id : undefined });
});

/** GET /api/assets/:id — get single asset */
assetRoutes.get('/:id', read, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const [row] = await db.select().from(assets)
    .where(and(eq(assets.id, c.req.param('id')), orgId ? eq(assets.orgId, orgId) : undefined));
  if (!row) return c.json({ error: 'Not found', message: 'Asset not found' }, 404);
  return c.json({ data: row });
});

/** POST /api/assets — create asset */
assetRoutes.post('/', write, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Bad Request', message: 'Organization context required' }, 400);

  const parsed = createAssetSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid body' }, 400);
  }
  const now = new Date().toISOString();
  const id = `asset-${crypto.randomUUID()}`;
  const metadata = parsed.data.metadata ? JSON.stringify(parsed.data.metadata) : null;

  await db.insert(assets).values({
    id, orgId, ...parsed.data, metadata,
    firstSeenAt: now, lastSeenAt: now,
  });
  return c.json({ data: { id, ...parsed.data } }, 201);
});

/** PUT /api/assets/:id — update asset */
assetRoutes.put('/:id', write, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const assetId = c.req.param('id');
  const [existing] = await db.select().from(assets)
    .where(and(eq(assets.id, assetId), orgId ? eq(assets.orgId, orgId) : undefined));
  if (!existing) return c.json({ error: 'Not found', message: 'Asset not found' }, 404);

  const parsed = updateAssetSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid body' }, 400);
  }
  const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
  if (parsed.data.name !== undefined) updates.name = parsed.data.name;
  if (parsed.data.sensitivity !== undefined) updates.sensitivity = parsed.data.sensitivity;
  if (parsed.data.status !== undefined) updates.status = parsed.data.status;
  if (parsed.data.metadata !== undefined) updates.metadata = JSON.stringify(parsed.data.metadata);
  if (parsed.data.isCrownJewel !== undefined) updates.isCrownJewel = parsed.data.isCrownJewel;

  await db.update(assets).set(updates).where(eq(assets.id, assetId));
  return c.json({ data: { id: assetId, ...updates } });
});

/** DELETE /api/assets/:id */
assetRoutes.delete('/:id', write, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const assetId = c.req.param('id');
  const [existing] = await db.select().from(assets)
    .where(and(eq(assets.id, assetId), orgId ? eq(assets.orgId, orgId) : undefined));
  if (!existing) return c.json({ error: 'Not found', message: 'Asset not found' }, 404);

  await db.delete(assets).where(eq(assets.id, assetId));
  return c.json({ data: { deleted: true } });
});
