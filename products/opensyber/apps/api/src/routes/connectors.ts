/**
 * Connector Routes
 *
 * CRUD for platform connectors (install, uninstall, status).
 */
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { getConnector, listConnectors, validateConfig } from '../services/connector-registry.js';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';

export const connectorRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

connectorRoutes.use('*', dbMiddleware, authMiddleware);

const installSchema = z.object({
  config: z.record(z.unknown()),
});

/** GET /connectors — list available connectors */
connectorRoutes.get('/', async (c) => {
  const category = c.req.query('category') as Parameters<typeof listConnectors>[0];
  const connectors = listConnectors(category);
  return c.json({
    data: connectors.map((conn) => ({
      slug: conn.slug,
      name: conn.name,
      category: conn.category,
      version: conn.version,
      description: conn.description,
      configSchema: conn.configSchema,
    })),
  });
});

/** POST /connectors/:slug/install — install connector for org */
connectorRoutes.post('/:slug/install', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const slug = c.req.param('slug');

  const connector = getConnector(slug);
  if (!connector) return c.json({ error: `Connector "${slug}" not found` }, 404);

  const parsed = installSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Config object is required' }, 400);

  const validation = validateConfig(slug, parsed.data.config);
  if (!validation.valid) return c.json({ error: 'Invalid config', details: validation.errors }, 400);

  const installId = crypto.randomUUID();
  const installData = {
    id: installId,
    orgId,
    slug,
    name: connector.name,
    config: parsed.data.config,
    status: 'connected' as const,
    installedAt: new Date().toISOString(),
  };

  await c.env.CACHE.put(
    `connector:${orgId}:${slug}`,
    JSON.stringify(installData),
    { expirationTtl: 86400 * 365 },
  );

  return c.json({ data: { id: installId, slug, status: 'connected' } }, 201);
});

/** DELETE /connectors/:slug — uninstall connector */
connectorRoutes.delete('/:slug', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const slug = c.req.param('slug');

  await c.env.CACHE.delete(`connector:${orgId}:${slug}`);
  return c.json({ data: { deleted: true, slug } });
});

/** GET /connectors/:slug/status — connection health */
connectorRoutes.get('/:slug/status', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const slug = c.req.param('slug');

  const connector = getConnector(slug);
  if (!connector) return c.json({ error: `Connector "${slug}" not found` }, 404);

  const stored = await c.env.CACHE.get(`connector:${orgId}:${slug}`);
  if (!stored) {
    return c.json({
      data: { slug, installed: false, status: 'not_installed' },
    });
  }

  const install = JSON.parse(stored) as { installedAt: string; status: string };
  return c.json({
    data: {
      slug,
      installed: true,
      status: install.status,
      installedAt: install.installedAt,
      connectorName: connector.name,
      category: connector.category,
    },
  });
});
