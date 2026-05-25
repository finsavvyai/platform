/**
 * Onboarding progress routes.
 *
 * Persists the Day 1 / Week 1 / Month 1 checklist in the `user_onboarding`
 * D1 table, keyed by the authenticated user id. Completed steps are stored
 * as a JSON array of string ids so we can evolve the catalogue on the
 * frontend without a migration.
 *
 * All routes require a valid JWT (requireAuth); unauthenticated clients
 * fall back to localStorage on the frontend.
 */
import { Hono } from 'hono';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { requireAuth } from '../middleware/honoAuth';

type Env = {
  Bindings: { DB: D1Database; ENVIRONMENT: string; JWT_SECRET: string };
  Variables: { userId: string; userRole: string };
};

// Known step ids. Kept permissive (any non-empty slug under 64 chars) so the
// frontend can introduce new steps without a backend deploy. We only persist
// what the frontend sends; rendering is still driven by the frontend catalogue.
const STEP_ID_PATTERN = /^[a-z0-9_]{1,64}$/;

const onboardingRoute = new Hono<Env>();
onboardingRoute.use('*', requireAuth);

function parseSteps(raw: string | null | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((x): x is string => typeof x === 'string' && STEP_ID_PATTERN.test(x));
  } catch {
    return [];
  }
}

function serializeSteps(steps: string[]): string {
  const deduped = Array.from(new Set(steps.filter((s) => STEP_ID_PATTERN.test(s))));
  return JSON.stringify(deduped);
}

async function readProgress(
  db: ReturnType<typeof drizzle>,
  userId: string,
): Promise<{ completedSteps: string[]; updatedAt: number }> {
  const rows = await db
    .select()
    .from(schema.userOnboarding)
    .where(eq(schema.userOnboarding.userId, userId))
    .limit(1);

  if (rows.length === 0) {
    return { completedSteps: [], updatedAt: 0 };
  }

  const row = rows[0];
  const updatedAt = row.updatedAt instanceof Date
    ? row.updatedAt.getTime()
    : Number(row.updatedAt) || 0;
  return { completedSteps: parseSteps(row.completedSteps), updatedAt };
}

// GET /progress — return the current user's completed step ids.
onboardingRoute.get('/progress', async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId');

  try {
    const data = await readProgress(db, userId);
    return c.json({ success: true, data });
  } catch {
    // Table missing (pre-migration) — treat as empty state so the UI still works.
    return c.json({ success: true, data: { completedSteps: [], updatedAt: 0 } });
  }
});

// POST /progress/:stepId/complete — mark a single step done. Idempotent.
onboardingRoute.post('/progress/:stepId/complete', async (c) => {
  const stepId = c.req.param('stepId');
  if (!STEP_ID_PATTERN.test(stepId)) {
    return c.json({ success: false, error: 'Invalid step id' }, 400);
  }

  const db = drizzle(c.env.DB);
  const userId = c.get('userId');
  const now = new Date();

  try {
    const existing = await readProgress(db, userId);
    if (existing.completedSteps.includes(stepId)) {
      return c.json({ success: true, data: existing });
    }

    const nextSteps = [...existing.completedSteps, stepId];
    const payload = serializeSteps(nextSteps);

    if (existing.updatedAt === 0) {
      await db.insert(schema.userOnboarding).values({
        userId,
        completedSteps: payload,
        updatedAt: now,
      });
    } else {
      await db
        .update(schema.userOnboarding)
        .set({ completedSteps: payload, updatedAt: now })
        .where(eq(schema.userOnboarding.userId, userId));
    }

    return c.json({
      success: true,
      data: { completedSteps: nextSteps, updatedAt: now.getTime() },
    });
  } catch (err) {
    console.error('[onboarding] complete failed:', err);
    return c.json({ success: false, error: 'Failed to record progress' }, 500);
  }
});

// DELETE /progress — reset the checklist (used by the "Reset" button).
onboardingRoute.delete('/progress', async (c) => {
  const db = drizzle(c.env.DB);
  const userId = c.get('userId');

  try {
    await db.delete(schema.userOnboarding).where(eq(schema.userOnboarding.userId, userId));
    return c.json({ success: true, data: { completedSteps: [], updatedAt: 0 } });
  } catch (err) {
    console.error('[onboarding] reset failed:', err);
    return c.json({ success: false, error: 'Failed to reset progress' }, 500);
  }
});

export default onboardingRoute;
