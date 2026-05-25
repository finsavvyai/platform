/**
 * SOC2 Evidence Routes
 *
 * Manage SOC2 audit evidence items.
 */
import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { soc2Evidence } from '@opensyber/db';
import { collectPlatformEvidence, summarizeEvidence } from '../services/soc2-evidence-collector.js';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { createEvidenceSchema } from './validation/soc2-evidence.js';

export const soc2EvidenceRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

soc2EvidenceRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

soc2EvidenceRoutes.get('/evidence', async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const evidence = await db.select().from(soc2Evidence)
    .where(eq(soc2Evidence.orgId, orgId))
    .orderBy(desc(soc2Evidence.collectedAt))
    .limit(100);
  return c.json({ data: evidence });
});

soc2EvidenceRoutes.post('/evidence', requirePermission('compliance.generate'), async (c) => {
  const orgId = c.get('orgId') ?? c.get('userId');
  const db = c.get('db');
  const parsed = createEvidenceSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: parsed.error.issues[0]?.message ?? 'Invalid input' }, 400);
  const id = crypto.randomUUID();
  await db.insert(soc2Evidence).values({
    id, orgId,
    controlId: parsed.data.controlId,
    tsc: parsed.data.tsc,
    evidenceType: parsed.data.evidenceType,
    title: parsed.data.title,
    description: parsed.data.description ?? null,
    artifactUrl: parsed.data.artifactUrl ?? null,
    validUntil: parsed.data.validUntil ?? null,
  });
  return c.json({ data: { id } }, 201);
});

soc2EvidenceRoutes.get('/evidence/auto-collect', async (c) => {
  const items = collectPlatformEvidence();
  const summary = summarizeEvidence(items);
  return c.json({ data: { items, summary } });
});
