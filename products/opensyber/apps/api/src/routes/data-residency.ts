import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { dataResidencyConfigs } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { REGION_MAP } from '../utils/data-residency.js';

const residencyConfigSchema = z.object({
  region: z.string().min(1),
  enforceStrict: z.boolean().optional(),
});

const dataResidencyRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

dataResidencyRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Get org residency config
dataResidencyRoutes.get('/:orgId/residency', async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Organization context required' }, 400);
  }

  const db = c.get('db');
  const [config] = await db
    .select()
    .from(dataResidencyConfigs)
    .where(eq(dataResidencyConfigs.orgId, orgId));

  return c.json({ data: config || null, regions: REGION_MAP });
});

// Set/update org residency config
dataResidencyRoutes.put('/:orgId/residency', requirePermission('org.update'), async (c) => {
  const orgId = c.get('orgId');
  if (!orgId) {
    return c.json({ error: 'Bad request', message: 'Organization context required' }, 400);
  }

  const db = c.get('db');
  const parsed = residencyConfigSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const validRegions = Object.keys(REGION_MAP);
  if (!validRegions.includes(body.region)) {
    return c.json({
      error: 'Bad request',
      message: `Region must be one of: ${validRegions.join(', ')}`,
    }, 400);
  }

  const computeRegions = REGION_MAP[body.region] ?? [];
  const [existing] = await db
    .select()
    .from(dataResidencyConfigs)
    .where(eq(dataResidencyConfigs.orgId, orgId));

  if (existing) {
    await db.update(dataResidencyConfigs).set({
      region: body.region as 'eu' | 'us' | 'ap',
      storageRegion: body.region,
      computeRegion: computeRegions.join(','),
      enforceStrict: body.enforceStrict ?? existing.enforceStrict,
    }).where(eq(dataResidencyConfigs.orgId, orgId));

    const [updated] = await db
      .select()
      .from(dataResidencyConfigs)
      .where(eq(dataResidencyConfigs.orgId, orgId));
    return c.json({ data: updated });
  }

  const newConfig = {
    id: generateId(),
    orgId,
    region: body.region as 'eu' | 'us' | 'ap',
    storageRegion: body.region,
    computeRegion: computeRegions.join(','),
    enforceStrict: body.enforceStrict ?? false,
    createdAt: new Date().toISOString(),
  };

  await db.insert(dataResidencyConfigs).values(newConfig);
  return c.json({ data: newConfig }, 201);
});

export { dataResidencyRoutes };
