/**
 * Multi-Cloud Routes
 *
 * Manage cloud provider configs and aggregate cross-cloud findings.
 */
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { multiCloudConfigs, cspmFindings, cloudAccounts } from '@opensyber/db';
import { validateCloudConfig, getProviderRegions } from '../services/multi-cloud-manager.js';
import { aggregateFindings } from '../services/multi-cloud-aggregator.js';
import type { CloudFinding } from '../services/multi-cloud-aggregator.js';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { createMultiCloudConfigSchema } from './validation/multi-cloud.js';

export const multiCloudRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

multiCloudRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

multiCloudRoutes.get('/configs', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const configs = await db.select().from(multiCloudConfigs)
    .where(eq(multiCloudConfigs.orgId, orgId));
  return c.json({ data: configs });
});

multiCloudRoutes.post('/configs', requirePermission('cloud.write'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const parsed = createMultiCloudConfigSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const validation = validateCloudConfig(parsed.data);
  if (!validation.valid) return c.json({ error: validation.error }, 400);

  const id = crypto.randomUUID();
  await db.insert(multiCloudConfigs).values({
    id, orgId,
    provider: parsed.data.provider,
    displayName: parsed.data.displayName,
    config: JSON.stringify(parsed.data.config),
    region: parsed.data.region ?? null,
  });
  return c.json({ data: { id } }, 201);
});

multiCloudRoutes.delete('/configs/:id', requirePermission('cloud.write'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  await db.delete(multiCloudConfigs).where(
    and(eq(multiCloudConfigs.id, c.req.param('id')), eq(multiCloudConfigs.orgId, orgId)),
  );
  return c.json({ data: { deleted: true } });
});

multiCloudRoutes.get('/regions/:provider', async (c) => {
  const provider = c.req.param('provider') as 'aws' | 'gcp' | 'azure';
  const regions = getProviderRegions(provider);
  return c.json({ data: regions });
});

/** GET /aggregate — Cross-cloud aggregation with risk correlation */
multiCloudRoutes.get('/aggregate', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');

  const configs = await db.select().from(multiCloudConfigs)
    .where(eq(multiCloudConfigs.orgId, orgId));

  const rows = await db.select({
    id: cspmFindings.id,
    provider: cloudAccounts.provider,
    accountId: cspmFindings.cloudAccountId,
    resourceType: cspmFindings.resourceType,
    resourceId: cspmFindings.resourceId,
    severity: cspmFindings.severity,
    title: cspmFindings.title,
    description: cspmFindings.description,
    region: cspmFindings.region,
  }).from(cspmFindings)
    .innerJoin(cloudAccounts, eq(cspmFindings.cloudAccountId, cloudAccounts.id))
    .where(eq(cspmFindings.orgId, orgId));

  const mapped: CloudFinding[] = rows.map((f) => ({
    id: f.id,
    provider: (f.provider ?? 'aws') as 'aws' | 'gcp' | 'azure',
    accountId: f.accountId ?? '',
    resourceType: f.resourceType ?? '',
    resourceId: f.resourceId ?? f.id,
    severity: (f.severity ?? 'medium') as CloudFinding['severity'],
    title: f.title ?? '',
    description: f.description ?? '',
    region: f.region ?? undefined,
  }));

  const result = aggregateFindings(mapped, configs.length);
  return c.json({ data: result });
});
