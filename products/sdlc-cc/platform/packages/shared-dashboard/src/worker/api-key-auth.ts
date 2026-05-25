/**
 * API Key Authentication Middleware
 * Validates API keys and attaches user context
 */

import { Context, Next } from 'hono';
import './types'; // Import to extend Hono context types
import { hashAPIKey } from './crypto-utils';
import { type User } from './auth-secure';

interface Env {
  DASHBOARD_DB: D1Database;
  DASHBOARD_CACHE: KVNamespace;
}

/**
 * Middleware to require API key authentication
 * Usage: app.get('/api/endpoint', requireAPIKey, async (c) => { ... })
 */
export async function requireAPIKey(c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> {
  try {
    // Get API key from header
    const apiKey = c.req.header('X-API-Key') || c.req.header('Authorization')?.replace('Bearer ', '');

    if (!apiKey) {
      return c.json({
        error: 'Unauthorized',
        message: 'API key is required. Provide it in X-API-Key or Authorization header.',
      }, 401);
    }

    // Check if it looks like an API key (starts with dk_)
    if (!apiKey.startsWith('dk_')) {
      return c.json({
        error: 'Unauthorized',
        message: 'Invalid API key format',
      }, 401);
    }

    // Hash the API key
    const keyHash = await hashAPIKey(apiKey);

    // Look up the API key in database
    const keyRecord = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        k.id, k.user_id, k.scopes, k.rate_limit, k.is_active, k.expires_at, k.last_used_at,
        u.id as user_id, u.email, u.name, u.role, u.permissions, u.organization_id, u.created_at
      FROM dashboard_api_keys k
      JOIN dashboard_users u ON k.user_id = u.id
      WHERE k.key_hash = ?
    `).bind(keyHash).first();

    if (!keyRecord) {
      return c.json({
        error: 'Unauthorized',
        message: 'Invalid API key',
      }, 401);
    }

    // Check if key is active
    if (keyRecord.is_active !== 1) {
      return c.json({
        error: 'Unauthorized',
        message: 'API key has been revoked',
      }, 401);
    }

    // Check expiration
    if (keyRecord.expires_at) {
      const expiresAt = new Date(keyRecord.expires_at as string);
      if (expiresAt < new Date()) {
        return c.json({
          error: 'Unauthorized',
          message: 'API key has expired',
        }, 401);
      }
    }

    // Update last_used_at timestamp (fire and forget)
    c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_api_keys
      SET last_used_at = datetime('now')
      WHERE id = ?
    `).bind(keyRecord.id).run().catch((err) => {
      console.error('Failed to update last_used_at:', err);
    });

    // Build user object
    const user: User = {
      id: keyRecord.user_id as string,
      email: keyRecord.email as string,
      name: keyRecord.name as string,
      role: keyRecord.role as 'admin' | 'user' | 'viewer',
      permissions: JSON.parse(keyRecord.permissions as string || '[]'),
      organizationId: keyRecord.organization_id as string | undefined,
      createdAt: keyRecord.created_at as string,
    };

    // Attach user and API key info to context
    c.set('user', user);
    c.set('apiKey', {
      id: keyRecord.id as string,
      scopes: JSON.parse(keyRecord.scopes as string || '[]'),
      rateLimit: keyRecord.rate_limit as number,
    });

    await next();
  } catch (error) {
    console.error('API key authentication error:', error);
    return c.json({
      error: 'Authentication failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
}

/**
 * Middleware to require specific API key scopes
 * Usage: app.get('/api/endpoint', requireAPIKey, requireScopes(['read:users']), async (c) => { ... })
 */
export function requireScopes(requiredScopes: string[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next): Promise<Response | void> => {
    const apiKey = c.get('apiKey') as { scopes: string[] } | undefined;

    if (!apiKey) {
      return c.json({
        error: 'Forbidden',
        message: 'API key context not found. Use requireAPIKey middleware first.',
      }, 403);
    }

    // Check if API key has required scopes
    const hasAllScopes = requiredScopes.every(scope => apiKey.scopes.includes(scope));

    if (!hasAllScopes) {
      return c.json({
        error: 'Forbidden',
        message: `Missing required scopes: ${requiredScopes.join(', ')}`,
      }, 403);
    }

    await next();
  };
}

/**
 * Middleware for flexible authentication (JWT or API key)
 * Tries JWT first, then API key
 */
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  // Try JWT authentication first
  const authHeader = c.req.header('Authorization');

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.substring(7);

    // If it looks like an API key, use API key auth
    if (token.startsWith('dk_')) {
      return requireAPIKey(c, next);
    }

    // Otherwise, try JWT auth (import from auth-secure if needed)
    // For now, just use API key auth
    return requireAPIKey(c, next);
  }

  // Try API key from X-API-Key header
  const apiKeyHeader = c.req.header('X-API-Key');
  if (apiKeyHeader) {
    return requireAPIKey(c, next);
  }

  return c.json({
    error: 'Unauthorized',
    message: 'Authentication required. Provide JWT or API key.',
  }, 401);
}
