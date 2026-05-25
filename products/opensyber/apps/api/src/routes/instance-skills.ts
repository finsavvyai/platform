import { Hono } from 'hono';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';
import { skillInstallations, skills, users } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { Plan } from '@opensyber/shared';

const installSkillSchema = z.object({
  skillId: z.string().min(1),
  version: z.string().min(1),
});
import type { Env, Variables } from '../types.js';
import { authMiddleware } from '../middleware/auth.js';
import { dbMiddleware } from '../middleware/db.js';
import { resolveOrgContext, requirePermission } from '../middleware/rbac.js';
import { verifyInstanceAccess } from '../utils/instance-access.js';
import { checkSkillLimit, checkUnverifiedSkillAllowed } from '../services/plan-enforcement.js';

const instanceSkillRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

instanceSkillRoutes.use('*', dbMiddleware, authMiddleware, resolveOrgContext);

// List installed skills
instanceSkillRoutes.get('/:id/skills', async (c) => {
  const db = c.get('db');
  const instance = await verifyInstanceAccess(
    db as any, c.req.param('id'), c.get('userId'), c.get('orgId'),
  );

  if (!instance) {
    return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
  }

  const installations = await db
    .select({ installation: skillInstallations, skill: skills })
    .from(skillInstallations)
    .innerJoin(skills, eq(skillInstallations.skillId, skills.id))
    .where(eq(skillInstallations.instanceId, c.req.param('id')));

  return c.json({ skills: installations });
});

// Install a skill
instanceSkillRoutes.post(
  '/:id/skills',
  requirePermission('skill.install'),
  async (c) => {
    const db = c.get('db');
    const instanceId = c.req.param('id');
    const instance = await verifyInstanceAccess(
      db as any, instanceId, c.get('userId'), c.get('orgId'),
    );

    if (!instance) {
      return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
    }

    const parsed = installSkillSchema.safeParse(await c.req.json());
    if (!parsed.success) {
      return c.json({ error: 'Invalid input' }, 400);
    }
    const body = parsed.data;

    const [skill] = await db.select().from(skills).where(eq(skills.id, body.skillId));
    if (!skill) {
      return c.json({ error: 'Not found', message: 'Skill not found' }, 404);
    }

    // Duplicate check: prevent installing same skill twice
    const [existing] = await db.select().from(skillInstallations)
      .where(and(eq(skillInstallations.instanceId, instanceId), eq(skillInstallations.skillId, body.skillId)));
    if (existing) {
      return c.json({ error: 'Already installed', message: `${skill.name} is already installed on this instance.` }, 409);
    }

    // Plan enforcement: check skill limits
    const [user] = await db.select().from(users).where(eq(users.id, c.get('userId')));
    if (user) {
      const plan = user.plan as Plan;
      const limitCheck = await checkSkillLimit(db as any, instanceId, plan);
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

    const id = generateId();
    const installation = {
      id, instanceId, skillId: body.skillId, version: body.version,
      installedAt: new Date().toISOString(), isActive: true,
    };

    await db.insert(skillInstallations).values(installation);
    await db.update(skills).set({ installCount: skill.installCount + 1 }).where(eq(skills.id, body.skillId));

    return c.json({ installation }, 201);
  },
);

// Activate / deactivate a skill
instanceSkillRoutes.patch(
  '/:id/skills/:skillId',
  requirePermission('skill.install'),
  async (c) => {
    const db = c.get('db');
    const instanceId = c.req.param('id');
    const skillId = c.req.param('skillId');
    const instance = await verifyInstanceAccess(
      db as any, instanceId, c.get('userId'), c.get('orgId'),
    );
    if (!instance) {
      return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
    }

    const body = await c.req.json().catch(() => ({})) as { isActive?: boolean };
    if (typeof body.isActive !== 'boolean') {
      return c.json({ error: 'Invalid input', message: 'isActive (boolean) is required' }, 400);
    }

    const [installation] = await db.select().from(skillInstallations)
      .where(and(eq(skillInstallations.instanceId, instanceId), eq(skillInstallations.skillId, skillId)));
    if (!installation) {
      return c.json({ error: 'Not found', message: 'Skill not installed' }, 404);
    }

    await db.update(skillInstallations)
      .set({ isActive: body.isActive })
      .where(eq(skillInstallations.id, installation.id));

    return c.json({ installation: { ...installation, isActive: body.isActive } });
  },
);

// Uninstall a skill
instanceSkillRoutes.delete(
  '/:id/skills/:skillId',
  requirePermission('skill.uninstall'),
  async (c) => {
    const db = c.get('db');
    const instanceId = c.req.param('id');
    const skillId = c.req.param('skillId');
    const instance = await verifyInstanceAccess(
      db as any, instanceId, c.get('userId'), c.get('orgId'),
    );

    if (!instance) {
      return c.json({ error: 'Not found', message: 'Instance not found' }, 404);
    }

    const [installation] = await db.select().from(skillInstallations)
      .where(and(eq(skillInstallations.instanceId, instanceId), eq(skillInstallations.skillId, skillId)));

    if (!installation) {
      return c.json({ error: 'Not found', message: 'Skill not installed' }, 404);
    }

    await db.delete(skillInstallations)
      .where(and(eq(skillInstallations.instanceId, instanceId), eq(skillInstallations.skillId, skillId)));

    return c.json({ message: 'Skill uninstalled', skillId });
  },
);

export { instanceSkillRoutes };
