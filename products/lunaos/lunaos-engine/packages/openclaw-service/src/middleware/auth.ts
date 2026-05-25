/**
 * Auth middleware for OpenClaw service
 *
 * Supports multiple auth methods:
 *   1. JWT (Bearer token) — from LunaOS users
 *   2. API Key (X-API-Key header) — from CLI / external consumers
 *   3. Service Key (X-Service-Key header) — from LunaOS engine / OpenHands
 *   4. Internal (no auth for health/public endpoints)
 */

import type { Context, Next } from 'hono';
import type { AppEnv, AuthContext } from '../types';

/**
 * Require authentication via any supported method.
 * Sets 'authContext' variable on the Hono context.
 */
export async function requireAuth(c: Context<AppEnv>, next: Next) {
    const authContext = await resolveAuth(c);

    if (!authContext) {
        return c.json({ error: 'Authentication required' }, 401);
    }

    c.set('authContext', authContext);
    c.set('userId', authContext.userId);
    await next();
}

/**
 * Require service-level authentication (for cross-service calls).
 * Only accepts Service Key or internal binding auth.
 */
export async function requireServiceAuth(c: Context<AppEnv>, next: Next) {
    const serviceKey = c.req.header('X-Service-Key');

    if (serviceKey && c.env.SERVICE_SECRET && serviceKey === c.env.SERVICE_SECRET) {
        const userId = c.req.header('X-User-Id') || 'service';
        c.set('authContext', {
            userId,
            source: 'service-binding',
        } as AuthContext);
        c.set('userId', userId);
        await next();
        return;
    }

    // Fall back to normal auth
    return requireAuth(c, next);
}

/**
 * Resolve auth from request headers.
 */
async function resolveAuth(c: Context<AppEnv>): Promise<AuthContext | null> {
    // 1. Service Key (highest priority — service-to-service)
    const serviceKey = c.req.header('X-Service-Key');
    if (serviceKey && c.env.SERVICE_SECRET && serviceKey === c.env.SERVICE_SECRET) {
        return {
            userId: c.req.header('X-User-Id') || 'service',
            source: 'service-binding',
        };
    }

    // 2. API Key
    const apiKey = c.req.header('X-API-Key');
    if (apiKey) {
        try {
            const keyRecord = await c.env.DB.prepare(
                'SELECT user_id FROM api_keys WHERE key_hash = ? AND revoked_at IS NULL'
            ).bind(await hashKey(apiKey)).first<{ user_id: string }>();

            if (keyRecord) {
                return {
                    userId: keyRecord.user_id,
                    source: 'api-key',
                };
            }
        } catch {
            // API key table may not exist yet — fall through
        }
    }

    // 3. JWT Bearer token
    const authHeader = c.req.header('Authorization');
    if (authHeader?.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        try {
            const payload = await verifyJWT(token, c.env.JWT_SECRET || '');
            if (payload?.sub) {
                return {
                    userId: payload.sub,
                    email: payload.email,
                    tier: payload.tier,
                    source: 'jwt',
                };
            }
        } catch {
            // Invalid JWT — fall through
        }
    }

    return null;
}

/**
 * Simple JWT verification (matches LunaOS engine implementation)
 */
async function verifyJWT(token: string, secret: string): Promise<any> {
    if (!secret) return null;

    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        'raw',
        encoder.encode(secret),
        { name: 'HMAC', hash: 'SHA-256' },
        false,
        ['verify'],
    );

    const data = encoder.encode(`${parts[0]}.${parts[1]}`);
    const signature = base64UrlDecode(parts[2]);

    const valid = await crypto.subtle.verify('HMAC', key, signature, data);
    if (!valid) return null;

    const payload = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));

    // Check expiry
    if (payload.exp && Date.now() / 1000 > payload.exp) return null;

    return payload;
}

function base64UrlDecode(str: string): ArrayBuffer {
    const padded = str.replace(/-/g, '+').replace(/_/g, '/');
    const binary = atob(padded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
}

async function hashKey(key: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(key);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Simple rate limiter using KV.
 */
export async function rateLimit(c: Context<AppEnv>, next: Next) {
    const userId = c.get('userId') || c.req.header('CF-Connecting-IP') || 'anon';
    const key = `rl:oc:${userId}:${Math.floor(Date.now() / 60000)}`; // 1-min window

    try {
        const current = parseInt(await c.env.KV.get(key) || '0');
        if (current >= 60) { // 60 req/min
            return c.json({ error: 'Rate limit exceeded', retryAfterMs: 60000 }, 429);
        }
        await c.env.KV.put(key, String(current + 1), { expirationTtl: 120 });
    } catch {
        // KV failure — allow through
    }

    await next();
}
