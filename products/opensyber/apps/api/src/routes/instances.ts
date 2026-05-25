import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { instances, users } from '@opensyber/db';
import { generateId, PLAN_INSTANCE_LIMITS, DEFAULT_AGENT_IMAGE, LATEST_AGENT_VERSION } from '@opensyber/shared';
import type { Region } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContextAutoDetect, requirePermission } from '../middleware/rbac.js';
import { agentRuntime } from '../services/agent-runtime.js';
import { buildCloudInit } from '../services/cloud-init.js';
import { encrypt } from '../utils/encryption.js';
import { storeGatewayToken } from '../lib/gateway-token.js';
import { tryCreateTailscaleKey, sendDeployEmail } from '../utils/instance-provisioning.js';
import { verifyInstanceAccess, listInstancesScoped } from '../utils/instance-access.js';
import { enforceResidency } from '../utils/data-residency.js';
import { createInstanceSchema, updateInstanceSchema } from './validation/instances.js';

const instanceRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

instanceRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContextAutoDetect);

// List instances (scoped to user or org)
instanceRoutes.get('/', async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const db = c.get('db');

  const userInstances = await listInstancesScoped(db as any, userId, orgId);

  const sanitized = userInstances.map(({ gatewayTokenEncrypted, ...rest }) => ({
    ...rest,
    hasGatewayToken: !!gatewayTokenEncrypted,
  }));

  return c.json({ instances: sanitized });
});

// Get single instance
instanceRoutes.get('/:id', async (c) => {
  const db = c.get('db');
  const instance = await verifyInstanceAccess(
    db as any, c.req.param('id'), c.get('userId'), c.get('orgId'),
  );

  if (!instance) {
    return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
  }

  const { gatewayTokenEncrypted, ...rest } = instance;
  return c.json({ instance: { ...rest, hasGatewayToken: !!gatewayTokenEncrypted } });
});

// Get instance health from KV cache
instanceRoutes.get('/:id/health', async (c) => {
  const db = c.get('db');
  const instance = await verifyInstanceAccess(
    db as any, c.req.param('id'), c.get('userId'), c.get('orgId'),
  );

  if (!instance) {
    return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
  }

  const cached = await c.env.CACHE.get(`health:${c.req.param('id')}`);
  return c.json({ health: cached ? JSON.parse(cached) : null });
});

// Create new instance
instanceRoutes.post('/', requirePermission('instance.create'), async (c) => {
  const userId = c.get('userId');
  const orgId = c.get('orgId');
  const db = c.get('db');
  const parsed = createInstanceSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }
  const body = parsed.data;

  const [user] = await db.select().from(users).where(eq(users.id, userId));
  if (!user) {
    return c.json({ error: 'Not found', message: 'User not found' }, 404);
  }

  if (user.plan === 'free') {
    return c.json({
      error: 'Upgrade required',
      message: 'Free tier is sandbox-only — browse the marketplace to preview skills, or upgrade to a paid plan to deploy a running agent.',
      upgradeUrl: '/pricing',
      cta: 'View plans',
    }, 402);
  }

  const existing = await listInstancesScoped(db as any, userId, orgId);
  const limit = PLAN_INSTANCE_LIMITS[user.plan] || 1;
  if (existing.length >= limit) {
    return c.json({
      error: 'Limit reached',
      message: `Your ${user.plan} plan allows ${limit} instance(s). Upgrade to create more.`,
    }, 403);
  }

  // Data residency enforcement
  const residencyCheck = await enforceResidency(db as any, orgId, body.region);
  if (!residencyCheck.allowed) {
    return c.json({ error: 'Region restricted', message: residencyCheck.reason }, 403);
  }

  const instanceId = generateId();
  const newInstance = {
    id: instanceId,
    userId,
    orgId,
    name: body.name || 'My Agent',
    region: body.region as Region,
    status: 'provisioning' as const,
    createdAt: new Date().toISOString(),
  };

  await db.insert(instances).values(newInstance);

  const gatewayToken = generateId();
  const apiBaseUrl = c.env.OPENSYBER_API_URL ?? c.env.API_BASE_URL ?? 'https://api.opensyber.cloud';
  const agentImage = `${DEFAULT_AGENT_IMAGE}:${LATEST_AGENT_VERSION}`;

  const tailscaleAuthKey = await tryCreateTailscaleKey(c.env, instanceId, orgId ?? userId);
  const userData = buildCloudInit({
    instanceId, gatewayToken, apiBaseUrl, agentImage, tailscaleAuthKey,
  });

  try {
    const container = await agentRuntime.createInstance({
      instanceId,
      region: body.region,
      plan: user.plan,
      doNamespace: c.env.AGENT_DO,
      envVars: {
        OPENSYBER_INSTANCE_ID: instanceId,
        OPENSYBER_GATEWAY_TOKEN: gatewayToken,
        OPENSYBER_API_URL: apiBaseUrl,
        OPENSYBER_REGION: body.region,
      },
    });

    await storeGatewayToken(c.env.CREDENTIAL_VAULT, instanceId, gatewayToken);
    const encryptedToken = await encrypt(gatewayToken, c.env.ENCRYPTION_KEY);

    await db.update(instances).set({
      containerId: container.containerId,
      hostname: container.hostname,
      gatewayTokenEncrypted: encryptedToken,
      status: 'running',
    }).where(eq(instances.id, instanceId));

    // Send deploy email (best-effort, non-blocking)
    sendDeployEmail({ ...user, name: user.name ?? '' }, body.name, db, c.env.RESEND_API_KEY).catch((err) =>
      console.error('[Instances] Deploy email failed:', err),
    );

    return c.json({
      instance: {
        ...newInstance, status: 'running',
        containerId: container.containerId,
        hostname: container.hostname,
      },
    }, 201);
  } catch (err) {
    console.error('[Instances] Container create failed:', err);
    await db.update(instances).set({ status: 'error' }).where(eq(instances.id, instanceId));
    return c.json({
      error: 'Provisioning failed',
      message: 'Container creation failed.',
      instance: { ...newInstance, status: 'error' },
    }, 500);
  }
});

// Update instance name
instanceRoutes.patch('/:id', requirePermission('instance.update'), async (c) => {
  const db = c.get('db');
  const instance = await verifyInstanceAccess(db as any, c.req.param('id'), c.get('userId'), c.get('orgId'));
  if (!instance) {
    return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
  }

  const parsed = updateInstanceSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  await db.update(instances).set({ name: parsed.data.name }).where(eq(instances.id, c.req.param('id')));
  return c.json({ instance: { ...instance, name: parsed.data.name } });
});

export { instanceRoutes };
