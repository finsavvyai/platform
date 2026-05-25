/**
 * Hono auth middleware -- verifies JWT bearer tokens on protected routes.
 */
import { createMiddleware } from 'hono/factory';
import { verifyJWT } from '../auth/jwt';

type AuthEnv = {
  Bindings: { DB: D1Database; ENVIRONMENT: string; JWT_SECRET: string };
  Variables: { userId: string; userRole: string };
};

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json(
      { success: false, error: 'Missing or invalid authorization header' },
      401,
    );
  }

  const token = authHeader.slice(7);

  try {
    const payload = await verifyJWT(token, c.env.JWT_SECRET);
    c.set('userId', payload.userId as string);
    c.set('userRole', (payload.role as string) ?? 'user');
    await next();
  } catch {
    return c.json({ success: false, error: 'Invalid or expired token' }, 401);
  }
});
