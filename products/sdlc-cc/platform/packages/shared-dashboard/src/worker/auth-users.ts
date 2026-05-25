/**
 * User management and session operations for SDLC Dashboard
 * Handles user lookups, session creation/destruction, and token generation
 */

import { signToken } from '@finsavvyai/auth';
import { getJWTSecret } from './crypto-utils';
import type { User } from './auth-secure';

const JWT_EXPIRATION = '24h';

/**
 * Generate JWT token for user using @finsavvyai/auth
 * Uses the module-level JWT secret set via setJWTSecret()
 */
export async function generateToken(user: User): Promise<string> {
  const secret = getJWTSecret();
  return signToken(
    {
      sub: user.id,
      email: user.email,
      role: user.role,
    },
    secret,
    { expiresIn: JWT_EXPIRATION },
  );
}

/**
 * Create session for user
 */
export async function createSession(
  user: User,
  db: D1Database,
  userAgent?: string,
  ipAddress?: string,
): Promise<string> {
  const sessionId = crypto.randomUUID();
  const sessionToken = crypto.randomUUID();

  // Hash the session token for storage (SHA-256)
  const encoder = new TextEncoder();
  const data = encoder.encode(sessionToken);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const tokenHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  // Session expires in 7 days
  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + 7);

  await db.prepare(`
    INSERT INTO dashboard_sessions (
      id, user_id, token_hash, user_agent, ip_address, expires_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).bind(
    sessionId,
    user.id,
    tokenHash,
    userAgent || 'Unknown',
    ipAddress || 'Unknown',
    expiresAt.toISOString(),
  ).run();

  return sessionId;
}

/**
 * Destroy session
 */
export async function destroySession(sessionId: string, db: D1Database): Promise<void> {
  await db.prepare(`
    UPDATE dashboard_sessions
    SET session_end = datetime('now'),
        duration_seconds = cast(
          (julianday(datetime('now')) - julianday(session_start)) * 86400
          as integer
        )
    WHERE id = ?
  `).bind(sessionId).run();
}

/**
 * Get user by ID
 */
export async function getUserById(userId: string, db: D1Database): Promise<User | null> {
  const result = await db.prepare(`
    SELECT id, email, name, role, permissions, organization_id, created_at
    FROM dashboard_users
    WHERE id = ?
  `).bind(userId).first();

  if (!result) {
    return null;
  }

  return {
    id: result.id as string,
    email: result.email as string,
    name: result.name as string,
    role: (result.role as 'admin' | 'user' | 'viewer') || 'user',
    permissions: JSON.parse(result.permissions as string || '[]'),
    organizationId: result.organization_id as string | undefined,
    createdAt: result.created_at as string,
  };
}

/**
 * Get user by email
 */
export async function getUserByEmail(email: string, db: D1Database): Promise<User | null> {
  const result = await db.prepare(`
    SELECT id, email, name, password_hash, role, permissions, organization_id, created_at
    FROM dashboard_users
    WHERE email = ? AND is_active = 1
  `).bind(email).first();

  if (!result) {
    return null;
  }

  return {
    id: result.id as string,
    email: result.email as string,
    name: result.name as string,
    password_hash: result.password_hash as string | undefined,
    role: (result.role as 'admin' | 'user' | 'viewer') || 'user',
    permissions: JSON.parse(result.permissions as string || '[]'),
    organizationId: result.organization_id as string | undefined,
    createdAt: result.created_at as string,
  };
}
