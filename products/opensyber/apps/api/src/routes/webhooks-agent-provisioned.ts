import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { instances } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { gatewayAuthMiddleware } from '../middleware/gateway-auth.js';
import { agentProvisionedSchema } from './validation/webhooks-agent.js';

const agentProvisionedRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

/**
 * POST /webhooks/agent/provisioned
 *
 * Called by the cloud-init script once Docker + agent container
 * are running on the Hetzner VM. Transitions the instance from
 * "provisioning" → "running".
 */
agentProvisionedRoutes.post(
  '/agent/provisioned',
  gatewayAuthMiddleware,
  async (c) => {
    const db = c.get('db');
    const parsed = agentProvisionedSchema.safeParse(await c.req.json());
    if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
    const headerInstanceId = c.req.header('X-Instance-Id');

    if (parsed.data.instanceId !== headerInstanceId) {
      return c.json(
        { error: 'Forbidden', message: 'Instance ID mismatch' },
        403,
      );
    }

    await db
      .update(instances)
      .set({ status: 'running' })
      .where(eq(instances.id, parsed.data.instanceId));

    return c.json({ received: true, status: 'running' });
  },
);

export { agentProvisionedRoutes };
