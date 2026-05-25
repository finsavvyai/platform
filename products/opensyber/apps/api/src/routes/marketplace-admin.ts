/**
 * Marketplace Admin Routes
 *
 * GET   /api/admin/marketplace/submissions      — List pending submissions
 * PATCH /api/admin/marketplace/submissions/:id  — Approve/reject submission
 * PATCH /api/admin/marketplace/skills/:id/featured — Toggle featured
 */
import { Hono } from 'hono';
import { eq } from 'drizzle-orm';
import { skills, marketplaceSubmissions, skillVersions } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { scanSkillSubmission } from '../services/skill-scanner.js';
import { reviewSubmissionSchema } from './validation/marketplace-admin.js';
import { createSkillArtifactVerifier } from '../lib/skill-artifact-trust.js';

const marketplaceAdminRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();
const artifactVerifier = createSkillArtifactVerifier();

marketplaceAdminRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// List submissions
marketplaceAdminRoutes.get('/submissions', requirePermission('marketplace.admin'), async (c) => {
  const db = c.get('db');
  const status = c.req.query('status') ?? 'pending';
  const submissions = await db.select().from(marketplaceSubmissions)
    .where(eq(marketplaceSubmissions.status, status as any));
  return c.json({ data: submissions });
});

// Review submission (approve/reject)
marketplaceAdminRoutes.patch('/submissions/:id', requirePermission('marketplace.admin'), async (c) => {
  const db = c.get('db');
  const submissionId = c.req.param('id');
  const parsed = reviewSubmissionSchema.safeParse(await c.req.json());
  if (!parsed.success) return c.json({ error: 'Invalid input', details: parsed.error.issues[0]?.message }, 400);
  const body = parsed.data;

  const [submission] = await db.select().from(marketplaceSubmissions)
    .where(eq(marketplaceSubmissions.id, submissionId));
  if (!submission) return c.json({ error: 'Submission not found' }, 404);

  if (body.action === 'approve') {
    const [skill] = await db.select().from(skills).where(eq(skills.id, submission.skillId));
    if (!skill) return c.json({ error: 'Skill not found for submission' }, 404);

    const [version] = await db.select().from(skillVersions).where(eq(skillVersions.id, submission.versionId));
    if (!version) return c.json({ error: 'Version not found for submission' }, 404);

    const policyMode = (c.env.MARKETPLACE_ARTIFACT_POLICY ?? 'enforce') as 'enforce' | 'warn' | 'off';
    const result = artifactVerifier.verify({
      manifestRaw: skill.manifest,
      checksum: version.checksum ?? null,
      policyMode,
    });
    if (!result.passed) {
      const reason = `[${result.code}] ${result.message}`;
      await db.update(marketplaceSubmissions).set({
        status: 'rejected',
        reviewNotes: `Auto-rejected by trust gate: ${reason}`,
        reviewedBy: c.get('userId'),
        reviewedAt: new Date().toISOString(),
      }).where(eq(marketplaceSubmissions.id, submissionId));
      return c.json({
        error: 'Submission blocked by artifact trust policy',
        code: result.code,
        message: result.message,
      }, 422);
    }
  }

  const newStatus = body.action === 'approve' ? 'approved' : 'rejected';
  await db.update(marketplaceSubmissions).set({
    status: newStatus,
    reviewNotes: body.notes ?? null,
    reviewedBy: c.get('userId'),
    reviewedAt: new Date().toISOString(),
  }).where(eq(marketplaceSubmissions.id, submissionId));

  if (body.action === 'approve') {
    await db.update(skills).set({
      verificationStatus: 'approved', verifiedAt: new Date().toISOString(), isCertified: true,
    }).where(eq(skills.id, submission.skillId));
  }

  return c.json({ data: { status: newStatus } });
});

// Scan a submission (automated security analysis)
marketplaceAdminRoutes.post('/submissions/:id/scan', requirePermission('marketplace.admin'), async (c) => {
  const db = c.get('db');
  const submissionId = c.req.param('id');
  const [submission] = await db.select().from(marketplaceSubmissions)
    .where(eq(marketplaceSubmissions.id, submissionId));
  if (!submission) return c.json({ error: 'Submission not found' }, 404);

  await db.update(marketplaceSubmissions).set({ status: 'scanning' })
    .where(eq(marketplaceSubmissions.id, submissionId));

  const [skill] = await db.select().from(skills).where(eq(skills.id, submission.skillId));
  const manifest = skill?.manifest ? JSON.parse(skill.manifest) : {};
  const result = scanSkillSubmission(manifest, null, 0);

  await db.update(marketplaceSubmissions).set({
    status: result.passed ? 'reviewing' : 'rejected',
    scanResult: JSON.stringify(result),
    reviewNotes: result.passed ? null : `Auto-rejected: ${result.findings.filter((f: any) => f.severity === 'critical' || f.severity === 'high').map((f: any) => f.message).join('; ')}`,
  }).where(eq(marketplaceSubmissions.id, submissionId));

  return c.json({ data: { scanResult: result } });
});

// Toggle featured
marketplaceAdminRoutes.patch('/skills/:id/featured', requirePermission('marketplace.admin'), async (c) => {
  const db = c.get('db');
  const [skill] = await db.select().from(skills).where(eq(skills.id, c.req.param('id')));
  if (!skill) return c.json({ error: 'Skill not found' }, 404);

  await db.update(skills).set({ isFeatured: !skill.isFeatured }).where(eq(skills.id, skill.id));
  return c.json({ data: { isFeatured: !skill.isFeatured } });
});

export { marketplaceAdminRoutes };
