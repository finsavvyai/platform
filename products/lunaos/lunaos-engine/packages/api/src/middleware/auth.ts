/**
 * Auth middleware — verifies JWT from Authorization header
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';
import { verifyJWT } from '../utils/jwt';

// Extend Hono context with user info
declare module 'hono' {
    interface ContextVariableMap {
        userId: string;
        userEmail: string;
        userTier: string;
        orgId: string;
        authMethod: string;
        tenantId: string;
    }
}

/**
 * Require authentication — rejects with 401 if no valid JWT
 */
export const requireAuth = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.slice(7);

    try {
        const payload = await verifyJWT(token, c.env.JWT_SECRET);
        c.set('userId', payload.sub);
        c.set('userEmail', payload.email);
        c.set('userTier', payload.tier);
        await next();
    } catch (err: unknown) {
        console.error('JWT verification failed:', err);
        return c.json({ error: 'Invalid or expired token' }, 401);
    }
});
