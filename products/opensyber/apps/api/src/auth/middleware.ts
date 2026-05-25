/**
 * Hono middleware for JWT verification and role-based access control.
 * Verifies tokens, injects authenticated user, and enforces role permissions.
 */

import { createMiddleware } from 'hono/factory';
import type { Context, MiddlewareHandler } from 'hono';
import { verifyToken, JWTError } from './jwt.js';
import type { TokenPayload } from './types.js';

export interface AuthContext {
  user?: TokenPayload;
  error?: string;
}

export class AuthError extends Error {
  constructor(message: string, public statusCode: number = 401) {
    super(message);
    this.name = 'AuthError';
  }
}

export const requireAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    throw new AuthError('Missing or invalid Authorization header', 401);
  }

  const token = authHeader.slice(7);
  const secret = c.env?.JWT_SECRET || 'fallback-secret';

  try {
    const payload = await verifyToken(token, { secret });
    c.set('user', payload);
    await next();
  } catch (err) {
    if (err instanceof JWTError) {
      throw new AuthError(`Token verification failed: ${err.message}`, 401);
    }
    throw err;
  }
});

export const requireRole = (allowedRoles: string[]) => {
  return createMiddleware(async (c, next) => {
    const user = c.get('user') as TokenPayload | undefined;
    if (!user) {
      throw new AuthError('User not authenticated', 401);
    }

    if (!allowedRoles.includes(user.role)) {
      throw new AuthError(`Insufficient permissions. Required: ${allowedRoles.join(', ')}`, 403);
    }

    await next();
  });
};

export const optionalAuth = createMiddleware(async (c, next) => {
  const authHeader = c.req.header('Authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    const secret = c.env?.JWT_SECRET || 'fallback-secret';
    try {
      const payload = await verifyToken(token, { secret });
      c.set('user', payload);
    } catch {
      // Silent fail for optional auth
    }
  }
  await next();
});
