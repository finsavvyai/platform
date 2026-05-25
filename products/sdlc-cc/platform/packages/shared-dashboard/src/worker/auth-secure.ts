/**
 * Secure Authentication middleware for Unified Dashboard
 * Uses @finsavvyai/auth for JWT and RBAC, with SDLC-specific
 * API key, Cloudflare Access, and session fallback auth.
 */

import { createMiddleware } from 'hono/factory';
import { authenticateRequest } from './auth-verify';

// Re-export user management functions
export {
  generateToken,
  createSession,
  destroySession,
  getUserById,
  getUserByEmail,
} from './auth-users';

// Re-export crypto utilities for use in auth routes
export { hashPassword, verifyPassword, hashAPIKey, setJWTSecret, getJWTSecret } from './crypto-utils';

// ── Types ────────────────────────────────────────────────────

export interface User {
  id: string;
  email: string;
  name: string;
  password_hash?: string;
  role: 'admin' | 'user' | 'viewer';
  permissions: string[];
  organizationId?: string;
  email_verified?: number;
  createdAt: string;
}

export interface AuthContext {
  user: User | null;
  isAuthenticated: boolean;
  token?: string;
}

// ── Middleware ────────────────────────────────────────────────

/**
 * Authentication middleware - requires authentication
 * Supports JWT, API key, and Cloudflare Access via authenticateRequest
 */
export const requireAuth = createMiddleware(async (c, next) => {
  const auth = await authenticateRequest(c);

  if (!auth.isAuthenticated || !auth.user) {
    return c.json(
      { error: 'Unauthorized', message: 'Authentication required' },
      401,
    );
  }

  c.set('auth', auth);
  c.set('user', auth.user);

  await next();
  return;
});

/**
 * Optional authentication middleware - allows anonymous access
 */
export const optionalAuth = createMiddleware(async (c, next) => {
  const auth = await authenticateRequest(c);

  c.set('auth', auth);
  c.set('user', auth.user);

  await next();
  return;
});

/**
 * Role-based authorization middleware
 * Mirrors @finsavvyai/auth createRoleMiddleware with SDLC's User type
 */
export const requireRole = (...roles: Array<'admin' | 'user' | 'viewer'>) => {
  return createMiddleware(async (c, next) => {
    const user = c.get('user') as User | null;

    if (!user) {
      return c.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        401,
      );
    }

    if (!roles.includes(user.role)) {
      return c.json(
        { error: 'Forbidden', message: `Required role: ${roles.join(' or ')}` },
        403,
      );
    }

    await next();
    return;
  });
};

/**
 * Permission-based authorization middleware
 * SDLC uses flat permission strings rather than resource/action pairs,
 * so this wraps the check locally instead of delegating to @finsavvyai/auth.
 */
export const requirePermission = (...permissions: string[]) => {
  return createMiddleware(async (c, next) => {
    const user = c.get('user') as User | null;

    if (!user) {
      return c.json(
        { error: 'Unauthorized', message: 'Authentication required' },
        401,
      );
    }

    if (user.role === 'admin') {
      await next();
      return;
    }

    const hasPermission = permissions.some(
      perm => user.permissions.includes(perm) || user.permissions.includes('*'),
    );

    if (!hasPermission) {
      return c.json(
        {
          error: 'Forbidden',
          message: `Required permission: ${permissions.join(' or ')}`,
        },
        403,
      );
    }

    await next();
    return;
  });
};
