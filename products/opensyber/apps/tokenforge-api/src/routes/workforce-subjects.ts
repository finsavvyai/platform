/**
 * Workforce subjects — GET /v1/workforce/subjects.
 *
 * Lists OIDC-attested users for the tenant, ordered by last seen.
 * Read-only; subjects are created/updated via the SSO exchange flow.
 */

import { Hono } from 'hono';
import { eq, desc } from 'drizzle-orm';
import { tfSubjects } from '@opensyber/db';
import type { Env, Variables } from '../types.js';

export const workforceSubjectRoutes = new Hono<{ Bindings: Env; Variables: Variables }>();

workforceSubjectRoutes.get('/', async (c) => {
  const db = c.get('db');
  const tenantId = c.get('tenantId');
  const limitParam = parseInt(c.req.query('limit') ?? '50', 10);
  const limit = Math.min(Math.max(limitParam, 1), 200);

  const rows = await db
    .select()
    .from(tfSubjects)
    .where(eq(tfSubjects.tenantId, tenantId))
    .orderBy(desc(tfSubjects.lastSeenAt))
    .limit(limit);

  return c.json({ data: rows });
});
