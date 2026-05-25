import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { assets } from '@opensyber/db';
import type { Env, Variables } from '../../types.js';
import { authMiddleware } from '../../middleware/auth.js';
import { dbMiddleware } from '../../middleware/db.js';
import { requirePermission } from '../../middleware/rbac.js';
import { loadOrgGraph, bfsTraverse, computeBlastRadius, findCrownJewelPaths } from '../../services/attack-path/index.js';
import { attackPathQuerySchema } from './validation.js';
import { instanceGraphRoute } from './instance.js';

export const attackPathRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
attackPathRoutes.use('*', dbMiddleware, authMiddleware);

const read = requirePermission('cloud.read');

// Mount the instance graph sub-router so it inherits auth + RBAC middleware.
attackPathRoutes.use('/graph/*', read);
attackPathRoutes.route('/', instanceGraphRoute);

/** POST /api/attack-paths/query — compute attack paths */
attackPathRoutes.post('/query', read, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ error: 'Bad Request', message: 'Organization context required' }, 400);

  const parsed = attackPathQuerySchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Validation failed', message: parsed.error.issues[0]?.message ?? 'Invalid body' }, 400);
  }

  const graph = await loadOrgGraph(db, orgId);
  if (!graph.has(parsed.data.entryAssetId)) {
    return c.json({ error: 'Not found', message: 'Entry asset not found in graph' }, 404);
  }

  const bfsResult = bfsTraverse(graph, parsed.data.entryAssetId, parsed.data);
  const blastRadius = computeBlastRadius(bfsResult.reachable);
  const crownJewels = findCrownJewelPaths(bfsResult.reachable);

  const reachableList = Array.from(bfsResult.reachable.entries()).map(([id, r]) => ({
    id,
    name: r.asset.name,
    assetType: r.asset.assetType,
    sensitivity: r.asset.sensitivity,
    isCrownJewel: r.asset.isCrownJewel,
    hops: r.depth,
    path: r.path,
  }));

  return c.json({
    data: {
      entryAssetId: parsed.data.entryAssetId,
      blastRadius,
      crownJewelPaths: crownJewels.paths,
      totalCrownJewels: crownJewels.totalCrownJewels,
      reachableAssets: reachableList,
    },
  });
});

/** GET /api/attack-paths/blast-radius/:sessionId — blast radius for agent session */
attackPathRoutes.get('/blast-radius/:sessionId', read, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  const sessionId = c.req.param('sessionId');
  if (!orgId) return c.json({ error: 'Bad Request', message: 'Organization context required' }, 400);

  const [sessionAsset] = await db.select().from(assets)
    .where(and(eq(assets.id, sessionId), eq(assets.orgId, orgId), eq(assets.assetType, 'agent_session')));
  if (!sessionAsset) return c.json({ error: 'Not found', message: 'Agent session asset not found' }, 404);

  const graph = await loadOrgGraph(db, orgId);
  const bfsResult = bfsTraverse(graph, sessionId);
  const blastRadius = computeBlastRadius(bfsResult.reachable);
  const crownJewels = findCrownJewelPaths(bfsResult.reachable, 5);

  return c.json({ data: { sessionId, ...blastRadius, topPaths: crownJewels.paths } });
});

/** GET /api/attack-paths/crown-jewels — all crown jewel assets with reachability */
attackPathRoutes.get('/crown-jewels', read, async (c) => {
  const db = c.get('db');
  const orgId = c.get('orgId');
  if (!orgId) return c.json({ data: [] });

  const crownJewels = await db.select().from(assets)
    .where(and(eq(assets.orgId, orgId), eq(assets.isCrownJewel, true)));

  return c.json({ data: crownJewels });
});
