/**
 * Marketplace Publish Routes
 *
 * POST  /api/marketplace/publish    — Submit a skill for review
 * GET   /api/marketplace/my-skills  — List publisher's skills
 * PATCH /api/marketplace/my-skills/:id — Update skill metadata
 */
import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { skills, skillVersions, marketplaceSubmissions } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { createSkillTrustManifest } from '../lib/skill-artifact-trust.js';

const publishSkillSchema = z.object({
  name: z.string().min(1),
  slug: z.string().min(1),
  description: z.string().optional(),
  category: z.string().min(1),
  version: z.string().min(1),
  tier: z.string().optional(),
  changelog: z.string().optional(),
  artifact: z.object({
    checksum: z.string().min(8).optional(),
    fileSize: z.number().int().nonnegative().optional(),
    sdkVersion: z.string().optional(),
    dependencies: z.array(z.string().min(1)).optional(),
    entrypoints: z.array(z.string().min(1)).optional(),
    signature: z.object({
      provider: z.string().min(1),
      bundle: z.string().min(1),
      certificateIdentity: z.string().optional(),
      verified: z.boolean().optional(),
    }).optional(),
  }).optional(),
});

const updateSkillSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  homepage: z.string().url().optional(),
  repository: z.string().url().optional(),
});

const marketplacePublishRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

marketplacePublishRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Publish a new skill
marketplacePublishRoutes.post('/publish', requirePermission('marketplace.publish'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const parsed = publishSkillSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  const body = parsed.data;
  const artifactChecksum = body.artifact?.checksum ?? `sha256:pending:${body.slug}:${body.version}`;
  const artifactFileSize = body.artifact?.fileSize ?? 0;
  const manifest = createSkillTrustManifest({
    name: body.name,
    slug: body.slug,
    version: body.version,
    category: body.category,
    checksum: artifactChecksum,
    fileSize: artifactFileSize,
    sdkVersion: body.artifact?.sdkVersion ?? null,
    dependencies: body.artifact?.dependencies ?? [],
    entrypoints: body.artifact?.entrypoints ?? [],
    signature: body.artifact?.signature ?? null,
  });

  const skillId = crypto.randomUUID();
  const versionId = crypto.randomUUID();

  await db.insert(skills).values({
    id: skillId, slug: body.slug, name: body.name,
    description: body.description ?? null,
    category: body.category as any,
    authorId: userId, publisherId: userId,
    currentVersion: body.version,
    tier: (body.tier as any) ?? 'free',
    verificationStatus: 'pending',
    manifest: JSON.stringify(manifest),
  });

  await db.insert(skillVersions).values({
    id: versionId, skillId, version: body.version,
    changelog: body.changelog ?? null, status: 'draft',
    checksum: artifactChecksum,
    fileSize: artifactFileSize,
    sdkVersion: body.artifact?.sdkVersion ?? null,
  });

  await db.insert(marketplaceSubmissions).values({
    id: crypto.randomUUID(), skillId, versionId,
    submittedBy: userId, status: 'pending',
  });

  return c.json({ data: { skillId, versionId } }, 201);
});

// List publisher's own skills
marketplacePublishRoutes.get('/my-skills', requirePermission('marketplace.publish'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const results = await db.select().from(skills).where(eq(skills.publisherId, userId));
  return c.json({ data: results });
});

// Update own skill metadata
marketplacePublishRoutes.patch('/my-skills/:id', requirePermission('marketplace.publish'), async (c) => {
  const db = c.get('db');
  const userId = c.get('userId');
  const skillId = c.req.param('id');

  const [skill] = await db.select().from(skills)
    .where(and(eq(skills.id, skillId), eq(skills.publisherId, userId)));
  if (!skill) return c.json({ error: 'Skill not found' }, 404);

  const parsed2 = updateSkillSchema.safeParse(await c.req.json());
  if (!parsed2.success) {
    return c.json({ error: 'Invalid input' }, 400);
  }
  const body = parsed2.data;
  const updates: Record<string, unknown> = {};
  if (body.name) updates.name = body.name;
  if (body.description !== undefined) updates.description = body.description;
  if (body.homepage !== undefined) updates.homepage = body.homepage;
  if (body.repository !== undefined) updates.repository = body.repository;

  if (Object.keys(updates).length === 0) return c.json({ error: 'No updates provided' }, 400);

  await db.update(skills).set(updates).where(eq(skills.id, skillId));
  return c.json({ data: { updated: true } });
});

export { marketplacePublishRoutes };
