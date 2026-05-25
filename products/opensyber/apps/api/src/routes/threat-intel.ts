/**
 * Threat Intelligence Feed Routes
 *
 * Public IOC feed and statistics, with admin-only IOC submission.
 *
 *   GET  /feed  — latest IOCs and threat entries
 *   GET  /stats — feed statistics
 *   POST /iocs  — add IOC (admin only, audit.view permission)
 */
import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { requirePermission } from '../middleware/rbac.js';
import type { Permission } from '@opensyber/shared';
import type { ThreatEntry, IOC } from './threat-intel-types.js';
import { computeFeedMeta, computeFeedStats } from './threat-intel-stats.js';
import { generateSeedEntries } from './threat-intel-seed.js';

const KV_KEY = 'threat-intel:entries';
type AppEnv = { Bindings: Env; Variables: Variables };

const threatIntelRoutes = new Hono<AppEnv>();

/** Load entries from KV, seeding on first access */
async function loadEntries(kv: KVNamespace): Promise<ThreatEntry[]> {
  const raw = await kv.get(KV_KEY, 'json') as ThreatEntry[] | null;
  if (raw && raw.length > 0) return raw;

  const seed = generateSeedEntries();
  await kv.put(KV_KEY, JSON.stringify(seed));
  return seed;
}

/** GET /feed — public IOC feed */
threatIntelRoutes.get('/feed', async (c) => {
  const entries = await loadEntries(c.env.CACHE);
  const meta = computeFeedMeta(entries);

  c.header('Cache-Control', 'public, s-maxage=60');
  return c.json({ data: entries, meta });
});

/** GET /stats — public feed statistics */
threatIntelRoutes.get('/stats', async (c) => {
  const entries = await loadEntries(c.env.CACHE);
  const stats = computeFeedStats(entries);

  c.header('Cache-Control', 'public, s-maxage=60');
  return c.json({ data: stats });
});

/** POST /iocs — admin-only IOC submission */
threatIntelRoutes.post(
  '/iocs',
  dbMiddleware,
  authMiddleware,
  requirePermission('audit.view' as Permission),
  async (c) => {
    const body = await c.req.json().catch(() => null);
    if (!body || !body.type || !body.value || !body.source || !body.severity) {
      return c.json({ error: 'Bad Request', message: 'Missing required fields: type, value, source, severity' }, 400);
    }

    const validTypes = ['domain', 'ip', 'hash', 'url', 'package', 'cve'];
    const validSeverities = ['critical', 'high', 'medium', 'low', 'info'];
    if (!validTypes.includes(body.type)) {
      return c.json({ error: 'Bad Request', message: `Invalid IOC type. Must be one of: ${validTypes.join(', ')}` }, 400);
    }
    if (!validSeverities.includes(body.severity)) {
      return c.json({ error: 'Bad Request', message: `Invalid severity. Must be one of: ${validSeverities.join(', ')}` }, 400);
    }

    const now = new Date().toISOString();
    const indicator: IOC = { type: body.type, value: body.value, confidence: body.confidence ?? 80 };
    const entry: ThreatEntry = {
      id: crypto.randomUUID(),
      type: 'ioc',
      title: body.description ?? `IOC: ${body.value}`,
      description: body.description ?? '',
      severity: body.severity,
      source: body.source,
      indicators: [indicator],
      tags: Array.isArray(body.tags) ? body.tags : [],
      publishedAt: now,
      updatedAt: now,
      autoBlockEnabled: false,
    };

    const entries = await loadEntries(c.env.CACHE);
    entries.unshift(entry);
    await c.env.CACHE.put(KV_KEY, JSON.stringify(entries));

    return c.json({ data: entry }, 201);
  },
);

export { threatIntelRoutes };
