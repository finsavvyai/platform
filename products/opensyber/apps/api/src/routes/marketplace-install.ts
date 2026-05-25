/**
 * Marketplace Install Routes
 *
 * POST   /api/marketplace/:id/install     — Install a skill
 * DELETE /api/marketplace/:id/install     — Uninstall a skill
 * GET    /api/marketplace/installed       — List installed skills
 */
import { Hono } from 'hono';
import { eq, and, sql } from 'drizzle-orm';
import { skills, skillInstallations, users } from '@opensyber/db';
import type { Env, Variables } from '../types.js';
import type { Plan } from '@opensyber/shared';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { marketplaceInstallSchema } from './validation/marketplace-install.js';
import { checkSkillLimit, checkUnverifiedSkillAllowed } from '../services/plan-enforcement.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';

const marketplaceInstallRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

marketplaceInstallRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// Install a skill
marketplaceInstallRoutes.post('/:id/install', requirePermission('marketplace.install'), async (c) => {
  const db = c.get('db');
  const skillId = c.req.param('id');

  const [skill] = await db.select().from(skills).where(eq(skills.id, skillId));
  if (!skill) return c.json({ error: 'Skill not found' }, 404);
  if (skill.verificationStatus !== 'approved') {
    return c.json({ error: 'Skill not approved for installation' }, 400);
  }

  const parsedBody = marketplaceInstallSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsedBody.success) return c.json({ error: 'Invalid input', details: parsedBody.error.issues[0]?.message }, 400);

  // Verify caller owns the target instance (prevents IDOR)
  const instance = await verifyInstanceAccess(db as any, parsedBody.data.instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Instance not found or access denied' }, 403);

  // Plan enforcement (consistent with instance-skills route)
  const [user] = await db.select().from(users).where(eq(users.id, c.get('userId')));
  if (user) {
    const plan = user.plan as Plan;
    const limitCheck = await checkSkillLimit(db as any, parsedBody.data.instanceId, plan);
    if (!limitCheck.allowed) {
      return c.json({
        error: 'Plan limit reached',
        message: `Your ${plan} plan allows ${limitCheck.limit} skill(s). Currently installed: ${limitCheck.current}. Upgrade to install more.`,
      }, 403);
    }
    if (skill.verificationStatus !== 'approved' && !checkUnverifiedSkillAllowed(plan)) {
      return c.json({
        error: 'Plan restriction',
        message: `Your ${plan} plan does not allow unverified skills. Upgrade to Pro or Team.`,
      }, 403);
    }
  }

  // Check for existing installation to prevent duplicates
  const [existing] = await db.select().from(skillInstallations)
    .where(and(eq(skillInstallations.skillId, skillId), eq(skillInstallations.instanceId, parsedBody.data.instanceId)));
  if (existing) {
    return c.json({ error: 'Skill already installed on this instance' }, 409);
  }

  const installation = {
    id: crypto.randomUUID(),
    instanceId: parsedBody.data.instanceId,
    skillId,
    version: skill.currentVersion ?? '0.0.1',
    isActive: true,
  };

  await db.insert(skillInstallations).values(installation);
  await db.update(skills).set({ installCount: sql`install_count + 1` }).where(eq(skills.id, skillId));

  return c.json({ data: installation }, 201);
});

// Uninstall a skill
marketplaceInstallRoutes.delete('/:id/install', requirePermission('marketplace.install'), async (c) => {
  const db = c.get('db');
  const skillId = c.req.param('id');
  const parsedDel = marketplaceInstallSchema.safeParse(await c.req.json().catch(() => ({})));
  if (!parsedDel.success) return c.json({ error: 'Invalid input', details: parsedDel.error.issues[0]?.message }, 400);

  // Verify caller owns the target instance (prevents IDOR)
  const instance = await verifyInstanceAccess(db as any, parsedDel.data.instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ error: 'Instance not found or access denied' }, 403);

  const [installation] = await db.select().from(skillInstallations)
    .where(and(eq(skillInstallations.skillId, skillId), eq(skillInstallations.instanceId, parsedDel.data.instanceId)));
  if (!installation) return c.json({ error: 'Installation not found' }, 404);

  await db.delete(skillInstallations).where(eq(skillInstallations.id, installation.id));
  await db.update(skills).set({ installCount: sql`max(install_count - 1, 0)` }).where(eq(skills.id, skillId));

  return c.json({ data: { deleted: true } });
});

// List installed skills for an instance
marketplaceInstallRoutes.get('/installed', requirePermission('marketplace.browse'), async (c) => {
  const db = c.get('db');
  const instanceId = c.req.query('instanceId');
  if (!instanceId) return c.json({ data: [] });

  // Verify caller owns the target instance
  const instance = await verifyInstanceAccess(db as any, instanceId, c.get('userId'), c.get('orgId'));
  if (!instance) return c.json({ data: [] });

  const installations = await db.select().from(skillInstallations)
    .where(eq(skillInstallations.instanceId, instanceId));
  return c.json({ data: installations });
});

export { marketplaceInstallRoutes };
