import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { cloudAccounts } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext } from '../middleware/rbac.js';
import { loadPlanConfig } from '../middleware/plan-enforcement.js';
import { hasPermission } from '@opensyber/shared';
import type { Role } from '@opensyber/shared';
import { encrypt } from '../utils/encryption.js';
import { createCloudAccountSchema, updateCloudAccountSchema } from './validation/cloud-accounts.js';

export const cloudAccountRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
cloudAccountRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext, loadPlanConfig);

function canWrite(role: Role | null): boolean {
  return !role || hasPermission(role, 'cloud.write');
}

function canAdmin(role: Role | null): boolean {
  return !role || hasPermission(role, 'cloud.admin');
}

// GET /api/cloud/accounts — list cloud accounts
cloudAccountRoutes.get('/accounts', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');

  const condition = orgId
    ? eq(cloudAccounts.orgId, orgId)
    : eq(cloudAccounts.userId, userId);

  const accounts = await db.select().from(cloudAccounts).where(condition);
  return c.json({ data: accounts });
});

// POST /api/cloud/accounts — create cloud account
cloudAccountRoutes.post('/accounts', async (c) => {
  const role = c.get('role');
  if (!canWrite(role)) {
    return c.json({ error: 'Forbidden', message: 'cloud.write required' }, 403);
  }

  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const planConfig = c.get('planConfig');

  if (!planConfig) {
    return c.json({ error: 'Internal Error', message: 'Plan config not loaded' }, 500);
  }

  // Check CSPM account limit
  const cspmLimit = planConfig.config.cspmAccounts as number;
  if (cspmLimit > 0) {
    const scope = orgId ? eq(cloudAccounts.orgId, orgId) : eq(cloudAccounts.userId, userId);
    const [countResult] = await db.select({ count: cloudAccounts.id }).from(cloudAccounts).where(scope);
    const currentCount = (countResult?.count ?? 0) as number;

    if (currentCount >= cspmLimit) {
      return c.json({
        error: 'Forbidden',
        message: `Cloud account limit reached (${cspmLimit}). Upgrade to connect more accounts.`,
        upgradeRequired: true,
        currentPlan: planConfig.plan,
        limitKey: 'cspmAccounts',
        current: currentCount,
        limit: cspmLimit,
      }, 403);
    }
  } else if (cspmLimit === 0) {
    return c.json({
      error: 'Forbidden',
      message: 'Cloud accounts not available on your current plan.',
      upgradeRequired: true,
      currentPlan: planConfig.plan,
      feature: 'cspmAccounts',
    }, 403);
  }

  const parsed = createCloudAccountSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  let encryptedCreds: string | null = null;
  if (body.credentials) {
    encryptedCreds = await encrypt(JSON.stringify(body.credentials), c.env.ENCRYPTION_KEY);
  }

  const id = crypto.randomUUID();
  const now = new Date().toISOString();

  await db.insert(cloudAccounts).values({
    id,
    orgId,
    userId,
    provider: body.provider,
    name: body.name,
    externalId: body.externalId ?? null,
    roleArn: body.roleArn ?? null,
    credentials: encryptedCreds,
    status: 'active',
    scanSchedule: body.scanSchedule,
    nextScanAt: body.scanSchedule !== 'manual' ? now : null,
    createdAt: now,
  });

  const [account] = await db.select().from(cloudAccounts).where(eq(cloudAccounts.id, id));
  return c.json({ data: account }, 201);
});

// PATCH /api/cloud/accounts/:id — update account
cloudAccountRoutes.patch('/accounts/:id', async (c) => {
  const role = c.get('role');
  if (!canWrite(role)) {
    return c.json({ error: 'Forbidden', message: 'cloud.write required' }, 403);
  }

  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  const condition = orgId
    ? and(eq(cloudAccounts.id, accountId), eq(cloudAccounts.orgId, orgId))
    : and(eq(cloudAccounts.id, accountId), eq(cloudAccounts.userId, userId));

  const [existing] = await db.select().from(cloudAccounts).where(condition);
  if (!existing) return c.json({ error: 'Not found', message: 'Account not found' }, 404);

  const parsed = updateCloudAccountSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const updates: Record<string, unknown> = {};
  if (body.name) updates.name = body.name;
  if (body.status) updates.status = body.status;
  if (body.scanSchedule) {
    updates.scanSchedule = body.scanSchedule;
    updates.nextScanAt = body.scanSchedule === 'manual' ? null : new Date().toISOString();
  }

  if (Object.keys(updates).length === 0) {
    return c.json({ error: 'Bad request', message: 'No valid fields to update' }, 400);
  }

  await db.update(cloudAccounts).set(updates).where(eq(cloudAccounts.id, accountId));
  const [updated] = await db.select().from(cloudAccounts).where(eq(cloudAccounts.id, accountId));
  return c.json({ data: updated });
});

// DELETE /api/cloud/accounts/:id — remove account
cloudAccountRoutes.delete('/accounts/:id', async (c) => {
  const role = c.get('role');
  if (!canAdmin(role)) {
    return c.json({ error: 'Forbidden', message: 'cloud.admin required' }, 403);
  }

  const db = c.get('db');
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const accountId = c.req.param('id');

  const condition = orgId
    ? and(eq(cloudAccounts.id, accountId), eq(cloudAccounts.orgId, orgId))
    : and(eq(cloudAccounts.id, accountId), eq(cloudAccounts.userId, userId));

  const [existing] = await db.select().from(cloudAccounts).where(condition);
  if (!existing) return c.json({ error: 'Not found', message: 'Account not found' }, 404);

  await db.delete(cloudAccounts).where(eq(cloudAccounts.id, accountId));
  return c.json({ data: { deleted: true } });
});
