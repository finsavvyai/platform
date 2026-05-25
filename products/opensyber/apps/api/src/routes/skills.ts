import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { skills } from '@opensyber/db';
import { generateId } from '@opensyber/shared';
import type { SkillCategory } from '@opensyber/shared';
import type { Env, Variables } from '../types.js';
import { dbMiddleware } from '../middleware/db.js';
import { authMiddleware } from '../middleware/auth.js';
import { submitSkillSchema } from './validation/skills.js';
import { getTrustIndicators } from '../lib/skill-artifact-trust.js';

const skillRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

function withTrustIndicators<T extends { manifest: string | null }>(skill: T): T & { isSigned: boolean; hasSbom: boolean } {
  const indicators = getTrustIndicators(skill.manifest);
  return { ...skill, ...indicators };
}

skillRoutes.use('*', dbMiddleware);

// List verified skills (public)
skillRoutes.get('/', async (c) => {
  const db = c.get('db');
  const category = c.req.query('category');

  let query = db
    .select()
    .from(skills)
    .where(eq(skills.verificationStatus, 'approved'))
    .orderBy(desc(skills.installCount));

  const allSkills = await query;

  // Filter by category in-memory (D1 limitation with dynamic where)
  const filtered = category
    ? allSkills.filter((s) => s.category === category)
    : allSkills;

  return c.json({ skills: filtered.map(withTrustIndicators) });
});

// Get single skill (public)
skillRoutes.get('/:slug', async (c) => {
  const db = c.get('db');
  const slug = c.req.param('slug');

  const [skill] = await db.select().from(skills).where(eq(skills.slug, slug));

  if (!skill) {
    return c.json({ error: 'Not found', message: 'Skill not found' }, 404);
  }

  return c.json({ skill: withTrustIndicators(skill) });
});

// Submit a new skill (authenticated)
skillRoutes.post('/submit', authMiddleware, async (c) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const parsed = submitSkillSchema.safeParse(await c.req.json());
  if (!parsed.success) {
    return c.json(
      { error: 'Bad request', message: parsed.error.issues[0]?.message ?? 'Invalid input' },
      400,
    );
  }
  const body = parsed.data;

  // Check slug uniqueness
  const [existing] = await db.select().from(skills).where(eq(skills.slug, body.slug));
  if (existing) {
    return c.json(
      { error: 'Conflict', message: 'A skill with this slug already exists' },
      409,
    );
  }

  const id = generateId();
  const skill = {
    id,
    slug: body.slug,
    name: body.name,
    description: body.description || null,
    category: body.category as SkillCategory,
    githubUrl: body.githubUrl || null,
    currentVersion: body.version,
    authorId: userId,
    verificationStatus: 'pending' as const,
    installCount: 0,
    ratingAvg: 0,
    ratingCount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  await db.insert(skills).values(skill);

  return c.json({ skill }, 201);
});

export { skillRoutes };
