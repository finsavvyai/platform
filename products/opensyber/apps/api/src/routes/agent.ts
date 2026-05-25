import { Hono } from 'hono';
import { LATEST_AGENT_VERSION } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { gatewayAuthMiddleware } from '../middleware/gateway-auth.js';
import { skillPackageService } from '../services/skill-packages.js';

/**
 * Agent-facing routes — authenticated via gateway token (X-Gateway-Token + X-Instance-Id).
 * These are called by the agent process running on each Hetzner instance.
 */
const agentRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

agentRoutes.use('*', dbMiddleware, gatewayAuthMiddleware);

// GET /api/agent/instances/:id/updates
// Agent calls this on startup and every 5 minutes to check for pending updates.
agentRoutes.get('/instances/:id/updates', async (c) => {
  const instanceId = c.req.param('id');

  // Verify the instance matches the gateway token
  const headerInstanceId = c.req.header('X-Instance-Id');
  if (instanceId !== headerInstanceId) {
    return c.json(
      { error: 'Forbidden', message: 'Instance ID mismatch' },
      403,
    );
  }

  // Compare agent version with latest
  const agentVersion = c.req.header('X-Agent-Version');

  if (agentVersion && agentVersion !== LATEST_AGENT_VERSION) {
    return c.json({
      action: 'update',
      instanceId,
      latestVersion: LATEST_AGENT_VERSION,
      currentVersion: agentVersion,
    });
  }

  return c.json({
    action: 'none',
    instanceId,
  });
});

// GET /api/agent/skills/:slug/:version/package
// Agent downloads a skill package tarball (base64) from R2 storage.
agentRoutes.get('/skills/:slug/:version/package', async (c) => {
  const slug = c.req.param('slug');
  const version = c.req.param('version');

  const payload = await skillPackageService.getBase64(
    slug,
    version,
    c.env.STORAGE,
  );

  if (!payload) {
    return c.json(
      { error: 'Not found', message: `Package ${slug}@${version} not found` },
      404,
    );
  }

  return c.json({
    slug,
    version,
    packageBase64: payload.base64,
    packageSha256: payload.sha256,
    packageSignature: payload.signature,
  });
});

export { agentRoutes };
