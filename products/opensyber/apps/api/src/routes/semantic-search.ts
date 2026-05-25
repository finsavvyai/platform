/**
 * Semantic Search Routes
 *
 * GET  /api/search/skills    — Semantic skill discovery
 * GET  /api/search/findings  — Similar finding search
 * POST /api/search/reindex   — Reindex all skills (admin only)
 */

import { Hono } from 'hono';
import { eq, and, inArray } from 'drizzle-orm';
import { skills } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import type { Permission } from '@opensyber/shared';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';
import { semanticSearch, indexSkill } from '../services/vector-search.js';
import { semanticSearchQuerySchema } from './validation/semantic-search.js';
import { emitPlatformAudit } from '../lib/platform-audit.js';

const semanticSearchRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

semanticSearchRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

/** Semantic skill search — "find skills for lateral movement detection" */
semanticSearchRoutes.get(
  '/skills',
  rateLimitMiddleware('embedding'),
  requirePermission('marketplace.browse'),
  async (c) => {
  const ai = c.env.AI;
  const vectorize = c.env.VECTORIZE;

  const parsed = semanticSearchQuerySchema.safeParse({
    q: c.req.query('q'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' }, 400);
  }
  const { q, limit } = parsed.data;

  if (!ai || !vectorize) {
    return c.json({ error: 'Vector search not configured' }, 503);
  }

  const results = await semanticSearch(ai, vectorize, q, {
    namespace: 'skills',
    topK: limit,
  }, c.env.CACHE);

  if (results.length === 0) return c.json({ data: [], query: q });

  const db = c.get('db');
  const skillIds = results.map((r) => r.id);
  const skillRows = await db.select().from(skills)
    .where(and(eq(skills.verificationStatus, 'approved'), inArray(skills.id, skillIds)));

  const scored = skillRows.map((s) => ({
    ...s,
    relevanceScore: results.find((r) => r.id === s.id)?.score ?? 0,
  }));
  scored.sort((a, b) => b.relevanceScore - a.relevanceScore);

  return c.json({ data: scored, query: q });
},
);

/** Similar finding search */
semanticSearchRoutes.get(
  '/findings',
  rateLimitMiddleware('embedding'),
  requirePermission('cloud.read'),
  async (c) => {
  const ai = c.env.AI;
  const vectorize = c.env.VECTORIZE;

  const parsed = semanticSearchQuerySchema.safeParse({
    q: c.req.query('q'),
    limit: c.req.query('limit'),
  });
  if (!parsed.success) {
    return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid query' }, 400);
  }
  const { q, limit } = parsed.data;

  if (!ai || !vectorize) {
    return c.json({ error: 'Vector search not configured' }, 503);
  }

  const results = await semanticSearch(ai, vectorize, q, {
    namespace: 'findings',
    topK: limit,
  }, c.env.CACHE);

  emitPlatformAudit({
    action: 'search.findings',
    userId: c.get('userId'),
    orgId: c.get('orgId'),
    metadata: { query: q, resultCount: results.length },
  });

  return c.json({ data: results, query: q });
},
);

/** Reindex all approved skills — admin only */
semanticSearchRoutes.post('/reindex', requirePermission('audit.view' as Permission), async (c) => {
  const ai = c.env.AI;
  const vectorize = c.env.VECTORIZE;
  if (!ai || !vectorize) {
    return c.json({ error: 'Vector search not configured' }, 503);
  }

  const db = c.get('db');
  const allSkills = await db.select().from(skills)
    .where(eq(skills.verificationStatus, 'approved'));

  let indexed = 0;
  for (const skill of allSkills) {
    await indexSkill(ai, vectorize, {
      id: skill.id,
      name: skill.name,
      description: skill.description ?? '',
      category: skill.category ?? 'other',
      tags: skill.tags ?? '',
    });
    indexed++;
  }

  emitPlatformAudit({
    action: 'search.reindex',
    userId: c.get('userId'),
    orgId: c.get('orgId'),
    metadata: { indexed, total: allSkills.length },
  });

  return c.json({ data: { indexed, total: allSkills.length } });
});

export { semanticSearchRoutes };
