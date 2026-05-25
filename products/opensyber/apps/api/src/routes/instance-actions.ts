import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { instances } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { agentRuntime } from '../services/agent-runtime.js';
import { deleteDevice, type TailscaleServiceDeps } from '../services/tailscale.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';

const instanceActionRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

instanceActionRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Restart instance
instanceActionRoutes.post(
  '/:id/restart',
  requirePermission('instance.restart'),
  async (c) => {
    const db = c.get('db');
    const instance = await verifyInstanceAccess(
      db as any, c.req.param('id'), c.get('userId'), c.get('orgId'),
    );

    if (!instance) {
      return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
    }

    if (!instance.containerId) {
      return c.json({ error: 'Not ready', message: 'Instance is not yet provisioned' }, 400);
    }

    await agentRuntime.restartInstance({
      containerId: instance.containerId,
      doNamespace: c.env.AGENT_DO,
    });

    return c.json({ message: 'Restart initiated', instanceId: c.req.param('id') });
  },
);

// Delete instance
instanceActionRoutes.delete(
  '/:id',
  requirePermission('instance.delete'),
  async (c) => {
    const db = c.get('db');
    const instanceId = c.req.param('id');
    const instance = await verifyInstanceAccess(
      db as any, instanceId, c.get('userId'), c.get('orgId'),
    );

    if (!instance) {
      return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
    }

    await db.update(instances).set({ status: 'destroying' }).where(eq(instances.id, instanceId));

    if (instance.containerId) {
      try {
        await agentRuntime.deleteInstance({
          containerId: instance.containerId,
          doNamespace: c.env.AGENT_DO,
        });
      } catch (err) {
        console.error('[Instances] Container delete failed:', err);
        await db.update(instances).set({ status: 'error' }).where(eq(instances.id, instanceId));
        return c.json({
          error: 'Deletion failed',
          message: 'Container deletion failed. Instance marked as error.',
          instanceId,
        }, 500);
      }
    }

    await c.env.CREDENTIAL_VAULT.delete(`gateway:${instanceId}`);

    // Remove Tailscale device from tailnet (if configured)
    if (instance.tailscaleNodeId && c.env.TAILSCALE_API_KEY && c.env.TAILSCALE_TAILNET) {
      try {
        const tsDeps: TailscaleServiceDeps = {
          apiKey: c.env.TAILSCALE_API_KEY,
          tailnet: c.env.TAILSCALE_TAILNET,
        };
        await deleteDevice(tsDeps, instance.tailscaleNodeId);
      } catch (err) {
        console.error('[Instances] Tailscale device cleanup failed:', err);
        // Non-blocking — ephemeral devices auto-expire anyway
      }
    }

    // Finalize — remove instance record from DB
    await db.delete(instances).where(eq(instances.id, instanceId));

    return c.json({ message: 'Instance deleted', instanceId });
  },
);

export { instanceActionRoutes };
