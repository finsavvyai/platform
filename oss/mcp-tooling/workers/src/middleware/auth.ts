/**
 * Cloudflare Access JWT Validation Middleware
 * Validates CF-Access-JWT-Assertion header and extracts user info
 */

import { Context, Next } from 'hono';
import * as jose from 'jose';

export interface AccessUser {
    id: string;
    email: string;
    name?: string;
    groups?: string[];
}

export interface Env {
    MCP_DB: D1Database;
    MCP_KV: KVNamespace;
    MCP_STORAGE: R2Bucket;
    MCP_QUEUE: Queue;
    CF_ACCESS_TEAM_DOMAIN: string;
    CF_ACCESS_AUD: string;
    ENVIRONMENT: string;
}

// Forward declaration for FeatureFlagService (avoid circular import)
export interface IFeatureFlagService {
    isEnabled(flagName: string, context?: { userId?: string; plan?: string }): Promise<boolean>;
}

// Extend Hono context with user and feature flags
declare module 'hono' {
    interface ContextVariableMap {
        user: AccessUser;
        featureFlags: IFeatureFlagService;
        userId: string | undefined;
        userPlan: string | undefined;
    }
}

/**
 * Validate Cloudflare Access JWT and extract user info
 */
export async function authMiddleware(c: Context<{ Bindings: Env }>, next: Next) {
    const jwt = c.req.header('CF-Access-JWT-Assertion');

    // Allow unauthenticated access in development
    if (c.env.ENVIRONMENT === 'development' && !jwt) {
        c.set('user', {
            id: 'dev-user-001',
            email: 'dev@localhost',
            name: 'Development User',
        });
        return next();
    }

    if (!jwt) {
        return c.json({ error: 'Unauthorized', message: 'Missing access token' }, 401);
    }

    try {
        // Fetch Cloudflare Access public keys
        const certsUrl = `https://${c.env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`;
        const JWKS = jose.createRemoteJWKSet(new URL(certsUrl));

        // Verify the JWT
        const { payload } = await jose.jwtVerify(jwt, JWKS, {
            audience: c.env.CF_ACCESS_AUD,
            issuer: `https://${c.env.CF_ACCESS_TEAM_DOMAIN}`,
        });

        // Extract user info from JWT claims
        const user: AccessUser = {
            id: payload.sub || (payload.email as string),
            email: payload.email as string,
            name: payload.name as string | undefined,
            groups: payload.groups as string[] | undefined,
        };

        // Ensure user exists in database
        await ensureUserExists(c.env.MCP_DB, user);

        c.set('user', user);
        return next();
    } catch (error) {
        console.error('JWT verification failed:', error);
        return c.json({ error: 'Unauthorized', message: 'Invalid access token' }, 401);
    }
}

/**
 * Create or update user in D1 on first login
 */
async function ensureUserExists(db: D1Database, user: AccessUser) {
    const existing = await db
        .prepare('SELECT id FROM users WHERE id = ?')
        .bind(user.id)
        .first();

    if (!existing) {
        // Create new user
        await db
            .prepare(`
        INSERT INTO users (id, email, display_name, last_sign_in_at)
        VALUES (?, ?, ?, datetime('now'))
      `)
            .bind(user.id, user.email, user.name || user.email.split('@')[0])
            .run();
    } else {
        // Update last sign in
        await db
            .prepare("UPDATE users SET last_sign_in_at = datetime('now'), updated_at = datetime('now') WHERE id = ?")
            .bind(user.id)
            .run();
    }
}

/**
 * Optional auth - allows unauthenticated access but sets user if present
 */
export async function optionalAuth(c: Context<{ Bindings: Env }>, next: Next) {
    const jwt = c.req.header('CF-Access-JWT-Assertion');

    if (!jwt) {
        return next();
    }

    // Try to validate, but don't fail if invalid
    try {
        const certsUrl = `https://${c.env.CF_ACCESS_TEAM_DOMAIN}/cdn-cgi/access/certs`;
        const JWKS = jose.createRemoteJWKSet(new URL(certsUrl));

        const { payload } = await jose.jwtVerify(jwt, JWKS, {
            audience: c.env.CF_ACCESS_AUD,
        });

        c.set('user', {
            id: payload.sub || (payload.email as string),
            email: payload.email as string,
            name: payload.name as string | undefined,
        });
    } catch {
        // Ignore errors, proceed without user
    }

    return next();
}

/**
 * API Key authentication for programmatic access
 */
export async function apiKeyAuth(c: Context<{ Bindings: Env }>, next: Next) {
    const authHeader = c.req.header('Authorization');

    if (!authHeader?.startsWith('Bearer mcp_')) {
        return authMiddleware(c, next); // Fall back to Access JWT
    }

    const apiKey = authHeader.slice(7); // Remove 'Bearer '
    const keyPrefix = apiKey.slice(0, 8);

    // Hash the key for lookup
    const encoder = new TextEncoder();
    const data = encoder.encode(apiKey);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const keyHash = Array.from(new Uint8Array(hashBuffer))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');

    // Look up the API key
    const result = await c.env.MCP_DB
        .prepare(`
      SELECT ak.*, u.email, u.display_name 
      FROM api_keys ak
      JOIN users u ON ak.user_id = u.id
      WHERE ak.key_hash = ? AND ak.key_prefix = ? AND ak.is_active = 1
        AND (ak.expires_at IS NULL OR ak.expires_at > datetime('now'))
    `)
        .bind(keyHash, keyPrefix)
        .first<{ user_id: string; email: string; display_name: string }>();

    if (!result) {
        return c.json({ error: 'Unauthorized', message: 'Invalid API key' }, 401);
    }

    // Update last used timestamp
    await c.env.MCP_DB
        .prepare("UPDATE api_keys SET last_used_at = datetime('now') WHERE key_hash = ?")
        .bind(keyHash)
        .run();

    c.set('user', {
        id: result.user_id,
        email: result.email,
        name: result.display_name,
    });

    return next();
}
