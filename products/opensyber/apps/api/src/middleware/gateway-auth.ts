import { createMiddleware } from 'hono/factory';
import type { Env, Variables } from '../types.js';
import { verifyGatewayToken } from '../lib/gateway-token.js';

/**
 * Gateway token authentication middleware for agent-facing endpoints.
 * Reads X-Gateway-Token and X-Instance-Id headers. Validates via the
 * hash-first verification helper in lib/gateway-token.ts.
 */
export const gatewayAuthMiddleware = createMiddleware<{
  Bindings: Env;
  Variables: Variables;
}>(async (c, next) => {
  const token = c.req.header('X-Gateway-Token');
  const instanceId = c.req.header('X-Instance-Id');

  if (!token || !instanceId) {
    return c.json(
      { error: 'Unauthorized', message: 'Missing X-Gateway-Token or X-Instance-Id header' },
      401,
    );
  }

  const ok = await verifyGatewayToken(c.env.CREDENTIAL_VAULT, instanceId, token);
  if (!ok) {
    console.warn(`[GatewayAuth] Token mismatch for instance ${instanceId}`);
    return c.json({ error: 'Unauthorized', message: 'Invalid gateway token' }, 401);
  }

  await next();
});
