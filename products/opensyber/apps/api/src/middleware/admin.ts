import { createMiddleware } from 'hono/factory';
import { eq } from 'drizzle-orm';
import { users } from '@opensyber/db';
import type { Env, Variables } from '../types.js';

type AppEnv = { Bindings: Env; Variables: Variables };

/**
 * Admin middleware — checks `users.isAdmin === 1` for the authenticated user.
 * Returns 403 for non-admin users.
 * Must be placed after authMiddleware + dbMiddleware.
 */
export const adminMiddleware = createMiddleware<AppEnv>(async (c, next) => {
  const userId = c.get('userId');
  const db = c.get('db');

  const [user] = await db
    .select({ isAdmin: users.isAdmin })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);

  if (!user) {
    return c.json({ error: 'Unauthorized', message: 'User not found' }, 401);
  }

  if (!user.isAdmin) {
    return c.json({ error: 'Forbidden', message: 'Admin access required' }, 403);
  }

  return next();
});
