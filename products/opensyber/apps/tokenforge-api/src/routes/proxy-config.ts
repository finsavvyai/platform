import { Hono } from 'hono';
import { z } from 'zod';
import type { Env, Variables } from '../types.js';
import {
  registerCustomHostname,
  deleteCustomHostname,
  getDnsInstructions,
} from '../services/custom-hostname.js';

export const proxyConfigRoutes = new Hono<{
  Bindings: Env;
  Variables: Variables;
}>();

const configSchema = z.object({
  hostname: z.string().min(1).max(253),
  origin: z.string().url().refine(
    (u) => u.startsWith('https://') || u.startsWith('http://'),
    { message: 'Origin must use http or https protocol' },
  ),
  verifyPaths: z.array(z.string()).optional().default(['/api/*']),
  skipPaths: z.array(z.string()).optional().default([]),
  blockOnFail: z.boolean().optional().default(true),
});

/** POST /v1/proxy/config — set up proxy + register custom hostname */
proxyConfigRoutes.post('/config', async (c) => {
  const tenantId = c.get('tenantId');
  const tenantPlan = c.get('tenantPlan');

  // Proxy is Team+ only
  if (tenantPlan !== 'team' && tenantPlan !== 'enterprise') {
    return c.json({
      error: 'plan_required',
      message: 'Zero-code proxy requires Team or Enterprise plan',
    }, 403);
  }

  const body = await c.req.json();
  const parsed = configSchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: 'validation_error', message: 'Invalid proxy configuration' }, 400);
  }

  const { hostname, origin, verifyPaths, skipPaths, blockOnFail } = parsed.data;

  // Check existing config count before creating
  const indexJson = await c.env.CACHE.get(`proxy_index:${tenantId}`);
  const index: string[] = indexJson ? JSON.parse(indexJson) : [];

  if (!index.includes(hostname) && index.length >= 10) {
    return c.json({
      error: 'limit_exceeded',
      message: 'Maximum 10 proxy domains per tenant',
    }, 429);
  }

  // Store proxy config in KV — never store raw API keys
  const config = { origin, tenantId, verifyPaths, skipPaths, blockOnFail };
  await c.env.CACHE.put(`proxy:${hostname}`, JSON.stringify(config));

  // Update tenant hostname index
  if (!index.includes(hostname)) {
    index.push(hostname);
    await c.env.CACHE.put(`proxy_index:${tenantId}`, JSON.stringify(index));
  }

  // Register with Cloudflare Custom Hostnames (for SSL)
  let cfResult = null;
  if (c.env.CF_API_TOKEN && c.env.CF_ZONE_ID) {
    cfResult = await registerCustomHostname(hostname, c.env.CF_API_TOKEN, c.env.CF_ZONE_ID);
  }

  const dns = getDnsInstructions(hostname);

  return c.json({
    data: {
      hostname,
      origin,
      status: cfResult?.success ? 'registered' : 'pending_dns',
      ssl: cfResult?.status ?? 'pending',
      verificationTxt: cfResult?.verificationTxt ?? null,
      dns: {
        cname: dns.cname,
        providers: dns.providers,
      },
    },
  });
});

/** GET /v1/proxy/config — list proxy configs for this tenant */
proxyConfigRoutes.get('/config', async (c) => {
  const tenantId = c.get('tenantId');

  const indexJson = await c.env.CACHE.get(`proxy_index:${tenantId}`);
  const hostnames: string[] = indexJson ? JSON.parse(indexJson) : [];

  const configs = [];
  for (const hostname of hostnames) {
    const configJson = await c.env.CACHE.get(`proxy:${hostname}`);
    if (configJson) {
      const parsed = JSON.parse(configJson);
      configs.push({ hostname, origin: parsed.origin, status: 'active' });
    }
  }

  return c.json({ data: configs });
});

/** DELETE /v1/proxy/config/:hostname — remove proxy config */
proxyConfigRoutes.delete('/config/:hostname', async (c) => {
  const tenantId = c.get('tenantId');
  const hostname = c.req.param('hostname');

  const configJson = await c.env.CACHE.get(`proxy:${hostname}`);
  if (!configJson) {
    return c.json({ error: 'not_found', message: 'Proxy config not found' }, 404);
  }

  const config = JSON.parse(configJson);
  if (config.tenantId !== tenantId) {
    return c.json({ error: 'forbidden', message: 'Not your proxy config' }, 403);
  }

  await c.env.CACHE.delete(`proxy:${hostname}`);

  // Remove from index
  const indexJson = await c.env.CACHE.get(`proxy_index:${tenantId}`);
  const index: string[] = indexJson ? JSON.parse(indexJson) : [];
  const filtered = index.filter((h) => h !== hostname);
  await c.env.CACHE.put(`proxy_index:${tenantId}`, JSON.stringify(filtered));

  // Remove from Cloudflare Custom Hostnames
  if (c.env.CF_API_TOKEN && c.env.CF_ZONE_ID) {
    await deleteCustomHostname(hostname, c.env.CF_API_TOKEN, c.env.CF_ZONE_ID)
      .catch(console.error);
  }

  return c.json({ data: { hostname, status: 'removed' } });
});
