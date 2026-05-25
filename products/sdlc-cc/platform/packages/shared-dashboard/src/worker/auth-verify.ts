/**
 * Authentication verification methods for SDLC Dashboard
 * Handles JWT, API key, and Cloudflare Access verification
 */

import { Context } from 'hono';
import { verifyTokenSafe, extractTokenFromHeader } from '@finsavvyai/auth';
import { hashAPIKey, getJWTSecret } from './crypto-utils';

import type { User, AuthContext } from './auth-secure';

/**
 * Verify JWT token using @finsavvyai/auth
 */
export async function verifyJWTToken(token: string): Promise<User | null> {
  try {
    const secret = getJWTSecret();
    const payload = verifyTokenSafe(token, secret);
    if (!payload) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: (payload as unknown as Record<string, unknown>).name as string || payload.email,
      role: (payload.role as 'admin' | 'user' | 'viewer') || 'user',
      permissions: (payload as unknown as Record<string, unknown>).permissions as string[] || [],
      organizationId: (payload as unknown as Record<string, unknown>).org as string | undefined,
      createdAt: payload.iat
        ? new Date(payload.iat * 1000).toISOString()
        : new Date().toISOString(),
    };
  } catch (error) {
    console.error('JWT verification failed:', error);
    return null;
  }
}

/**
 * Verify API key from database using secure hashing
 */
export async function verifyAPIKey(apiKey: string, db: D1Database): Promise<User | null> {
  try {
    const keyHash = await hashAPIKey(apiKey);

    const result = await db.prepare(`
      SELECT
        k.user_id,
        k.permissions,
        u.email,
        u.name,
        u.role
      FROM dashboard_api_keys k
      LEFT JOIN dashboard_users u ON k.user_id = u.id
      WHERE k.key_hash = ?
        AND k.is_active = 1
        AND (k.expires_at IS NULL OR k.expires_at > datetime('now'))
    `).bind(keyHash).first();

    if (!result) {
      return null;
    }

    await db.prepare(`
      UPDATE dashboard_api_keys
      SET last_used_at = datetime('now')
      WHERE key_hash = ?
    `).bind(keyHash).run();

    return {
      id: result.user_id as string,
      email: result.email as string,
      name: result.name as string,
      role: (result.role as 'admin' | 'user' | 'viewer') || 'user',
      permissions: JSON.parse(result.permissions as string || '[]'),
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('API key verification failed:', error);
    return null;
  }
}

/**
 * Verify Cloudflare Access JWT
 */
export async function verifyCloudflareAccess(
  request: Request,
): Promise<User | null> {
  try {
    const cfAccessJWT = request.headers.get('Cf-Access-Jwt-Assertion');
    if (!cfAccessJWT) {
      return null;
    }

    const secret = getJWTSecret();
    const payload = verifyTokenSafe(cfAccessJWT, secret);
    if (!payload) {
      return null;
    }

    return {
      id: payload.sub,
      email: payload.email,
      name: (payload as unknown as Record<string, unknown>).name as string || payload.email,
      role: 'user',
      permissions: [],
      createdAt: new Date().toISOString(),
    };
  } catch (error) {
    console.error('Cloudflare Access verification failed:', error);
    return null;
  }
}

/**
 * Extract authentication from request using multiple methods
 */
export async function authenticateRequest(c: Context): Promise<AuthContext> {
  const db = c.env.DASHBOARD_DB as D1Database;

  // 1. Check for Authorization header (Bearer token)
  const authHeader = c.req.header('Authorization');
  const token = extractTokenFromHeader(authHeader);
  if (token) {
    const user = await verifyJWTToken(token);
    if (user) {
      return { user, isAuthenticated: true, token };
    }
  }

  // 2. Check for API key header
  const apiKey = c.req.header('X-API-Key');
  if (apiKey) {
    const user = await verifyAPIKey(apiKey, db);
    if (user) {
      return { user, isAuthenticated: true };
    }
  }

  // 3. Check for Cloudflare Access
  const cfUser = await verifyCloudflareAccess(c.req.raw);
  if (cfUser) {
    return { user: cfUser, isAuthenticated: true };
  }

  return { user: null, isAuthenticated: false };
}
