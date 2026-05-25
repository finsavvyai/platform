import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContextAutoDetect, requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { emitPlatformAudit } from '../lib/platform-audit.js';
import { getLegacyRawGatewayToken } from '../lib/gateway-token.js';
import { decrypt } from '../utils/encryption.js';

/**
 * Owner-only endpoint that returns the gateway token the user needs to
 * configure their local CLI / MCP / VS Code client. Required to bootstrap
 * the ConnectAgentCard flow on the dashboard — without it, users can
 * deploy an agent and have literally no way to pair their machine to it.
 *
 * Recovery order:
 *   1. Decrypt `gatewayTokenEncrypted` from the D1 instances row (primary
 *      source of truth since the hashed-KV migration).
 *   2. Fall back to the legacy raw KV slot (`gateway:{instanceId}`) for
 *      instances provisioned before the DB column existed.
 *
 * Both paths emit a platform audit event.
 */

const instanceTokenRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

instanceTokenRoutes.use('/:id/gateway-token', dbMiddleware, authMiddleware, resolveOrgContextAutoDetect);

instanceTokenRoutes.get(
  '/:id/gateway-token',
  requirePermission('instance.view'),
  async (c) => {
    const db = c.get('db');
    const instanceId = c.req.param('id');
    const userId = c.get('userId');
    const orgId = c.get('orgId');

    const instance = await verifyInstanceAccess(
      db as never,
      instanceId,
      userId,
      orgId,
    );
    if (!instance) return c.json({ error: 'Not found' }, 404);

    let token: string | null = null;
    let source: 'db' | 'legacy-kv' = 'db';

    const encrypted = (instance as { gatewayTokenEncrypted?: string | null }).gatewayTokenEncrypted;
    if (encrypted) {
      try {
        token = await decrypt(encrypted, c.env.ENCRYPTION_KEY);
      } catch (err) {
        console.error('[InstanceToken] Decrypt failed, falling back to KV:', err);
      }
    }

    if (!token) {
      token = await getLegacyRawGatewayToken(c.env.CREDENTIAL_VAULT, instanceId);
      source = 'legacy-kv';
    }

    if (!token) {
      return c.json(
        {
          error: 'Token not retrievable',
          message:
            'Gateway token is not available for retrieval. Rotate the instance token to receive a new one.',
        },
        409,
      );
    }

    emitPlatformAudit({
      userId,
      orgId,
      action: 'instance.gateway_token.retrieve',
      metadata: { instanceId, source },
    });

    c.header('Cache-Control', 'no-store');
    return c.json({
      data: { instanceId, gatewayToken: token, source },
    });
  },
);

export { instanceTokenRoutes };
