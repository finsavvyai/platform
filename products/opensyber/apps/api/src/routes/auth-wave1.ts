/**
 * Authentication API routes for Wave 1.
 * Handles login, registration, token refresh, and user info endpoints.
 */

import { Hono } from 'hono';
import type { Context } from 'hono';
import { z } from 'zod';
import { createToken, verifyToken } from '../auth/jwt.js';
import { getUserByEmail } from '../db/queries.js';
import type { TokenPayload } from '../auth/types.js';
import { rateLimitMiddleware } from '../middleware/rate-limit.js';

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const RefreshSchema = z.object({
  refreshToken: z.string(),
});

export const createAuthRoutes = () => {
  const router = new Hono();

  // Apply strict rate limiting to auth endpoints (brute-force protection)
  router.use('*', rateLimitMiddleware('public'));

  // POST /auth/login
  router.post('/login', async (c: Context) => {
    try {
      const raw = await c.req.json().catch(() => null);
      const parsed = LoginSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ error: 'Invalid input', message: parsed.error.issues[0]?.message ?? 'Validation failed' }, 400);
      }
      const { email, password } = parsed.data;

      const user = await getUserByEmail(c.var.db, email);
      if (!user || !(user as Record<string, unknown>).passwordHash) {
        return c.json({ error: 'Invalid credentials' }, 401);
      }

      const encoder = new TextEncoder();
      const keyData = await crypto.subtle.importKey(
        'raw', encoder.encode(password), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
      );
      const hashBytes = new Uint8Array(await crypto.subtle.sign('HMAC', keyData, encoder.encode(user.id)));
      const hash = Array.from(hashBytes).map(b => b.toString(16).padStart(2, '0')).join('');
      if (hash !== (user as Record<string, unknown>).passwordHash) {
        return c.json({ error: 'Invalid credentials' }, 401);
      }

      const secret = c.env?.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET environment variable is required'); })();
      const token = await createToken(
        {
          userId: user.id,
          email: user.email,
          role: user.role,
        } as TokenPayload,
        { secret, expiresIn: 3600 },
      );

      return c.json({ token, user: { id: user.id, email: user.email, name: user.name } });
    } catch (error) {
      return c.json(
        { error: error instanceof z.ZodError ? 'Invalid input' : 'Login failed' },
        400,
      );
    }
  });

  // POST /auth/register — OAuth-only; users table has no passwordHash column.
  // Password-based registration is not supported. Use OAuth providers instead.
  router.post('/register', async (c: Context) => {
    return c.json(
      { error: 'Not implemented', message: 'Password registration is not supported. Use OAuth (Google, GitHub, LinkedIn, Microsoft) to create an account.' },
      501,
    );
  });

  // POST /auth/refresh
  router.post('/refresh', async (c: Context) => {
    try {
      const raw = await c.req.json().catch(() => null);
      const parsed = RefreshSchema.safeParse(raw);
      if (!parsed.success) {
        return c.json({ error: 'Invalid input', message: 'refreshToken is required' }, 400);
      }
      const { refreshToken } = parsed.data;

      const secret = c.env?.JWT_SECRET ?? (() => { throw new Error('JWT_SECRET environment variable is required'); })();
      const payload = await verifyToken(refreshToken, { secret });

      const token = await createToken(payload, { secret, expiresIn: 3600 });
      return c.json({ token });
    } catch {
      return c.json({ error: 'Invalid refresh token' }, 401);
    }
  });

  // GET /auth/me
  router.get('/me', async (c: Context) => {
    const user = c.get('user') as TokenPayload | undefined;
    if (!user) {
      return c.json({ error: 'Unauthorized' }, 401);
    }

    return c.json({
      user: {
        id: user.userId,
        email: user.email,
        role: user.role,
        orgId: user.orgId,
      },
    });
  });

  return router;
};
