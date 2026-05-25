import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { gatewayAuthMiddleware } from '../middleware/gateway-auth.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { vaultService } from '../services/vault.js';
import { storeSecretSchema } from './validation/vault.js';

const vaultRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
vaultRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// List secret keys (no values returned)
vaultRoutes.get('/instances/:id/secrets', async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const instanceId = c.req.param('id');
  const instance = await verifyInstanceAccess(db as any, instanceId, userId, c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const secrets = await vaultService.listSecrets({ db, userId, instanceId });
  return c.json({ secrets });
});

// Store a secret
vaultRoutes.post('/instances/:id/secrets', requirePermission('vault.write'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const instanceId = c.req.param('id');
  const instance = await verifyInstanceAccess(db as any, instanceId, userId, c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const parsed = storeSecretSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  }

  const secret = await vaultService.storeSecret({
    db, userId, instanceId, key: parsed.data.key, value: parsed.data.value, encryptionKey: c.env.ENCRYPTION_KEY,
  });
  return c.json({ secret }, 201);
});

// Delete a secret
vaultRoutes.delete('/instances/:id/secrets/:key', requirePermission('vault.delete'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const instanceId = c.req.param('id');
  const key = c.req.param('key');
  const instance = await verifyInstanceAccess(db as any, instanceId, userId, c.get('orgId'));
  if (!instance) return c.json({ error: 'Not found', message: 'Instance not found' }, 404);

  const deleted = await vaultService.deleteSecret({ db, userId, instanceId, key });
  if (!deleted) return c.json({ error: 'Not found', message: 'Secret not found' }, 404);
  return c.json({ message: 'Secret deleted', key });
});

// Agent-facing vault routes (gateway token auth)
const gatewayVaultRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
gatewayVaultRoutes.use('*', dbMiddleware, gatewayAuthMiddleware);

gatewayVaultRoutes.get('/instances/:id/secrets', async (c) => {
  const db = c.get('db');
  const instanceId = c.req.param('id');
  const authenticatedInstanceId = c.req.header('X-Instance-Id');
  if (instanceId !== authenticatedInstanceId) {
    return c.json({ error: 'Forbidden', message: 'Cannot access secrets for a different instance' }, 403);
  }
  const secrets = await vaultService.getDecryptedSecrets({ db, instanceId, encryptionKey: c.env.ENCRYPTION_KEY });
  return c.json({ secrets });
});

export { vaultRoutes, gatewayVaultRoutes };
