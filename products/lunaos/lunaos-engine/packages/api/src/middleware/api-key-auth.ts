/**
 * API Key Auth Middleware — accepts lnos_* API keys as alternative to JWT
 *
 * If the Authorization header contains a JWT, the regular auth middleware handles it.
 * If it contains an API key (lnos_live_*), this middleware validates it and
 * sets the same context variables (userId, userEmail, userTier).
 */

import { createMiddleware } from 'hono/factory';
import type { Env } from '../worker';
import { isApiKey, validateApiKey } from '../services/key-manager';
import { verifyJWT } from '../utils/jwt';

/**
 * Unified auth middleware — accepts JWT tokens OR API keys
 * Replaces requireAuth on routes that should accept both.
 */
export const requireAuthOrApiKey = createMiddleware<{ Bindings: Env }>(async (c, next) => {
    const authHeader = c.req.header('Authorization');

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return c.json({ error: 'Missing or invalid Authorization header' }, 401);
    }

    const token = authHeader.slice(7);

    // Check if it's an API key
    if (isApiKey(token)) {
        const result = await validateApiKey(c.env.DB, token);

        if (!result || !result.valid) {
            return c.json({ error: 'Invalid or revoked API key' }, 401);
        }

        c.set('userId', result.userId!);
        c.set('userEmail', ''); // API keys don't carry email
        c.set('userTier', result.tier!);
        await next();
        return;
    }

    // Otherwise treat as JWT
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
