/**
 * Authentication Middleware for Cloudflare Workers
 * 
 * Validates JWT tokens issued by the backend auth service
 * and attaches user information to the request context.
 */

import { Context, Next } from 'hono';
import { Env } from '../index';

interface JWTPayload {
  userId: string;
  type: string;
  iat?: number;
  exp?: number;
}

interface User {
  userId: string;
  email: string;
  role: string;
  name?: string;
  teamId?: string;
}

// Extend Hono context to include user
declare module 'hono' {
  interface ContextVariableMap {
    user: User;
  }
}

/**
 * Verify JWT token using Web Crypto API (available in Workers)
 */
async function verifyJWT(token: string, secret: string): Promise<JWTPayload | null> {
  try {
    // Split the JWT into parts
    const parts = token.split('.');
    if (parts.length !== 3) {
      return null;
    }

    const [headerB64, payloadB64, signatureB64] = parts;

    // Decode payload
    const payloadJson = atob(payloadB64.replace(/-/g, '+').replace(/_/g, '/'));
    const payload = JSON.parse(payloadJson) as JWTPayload;

    // Check expiration
    if (payload.exp && payload.exp < Date.now() / 1000) {
      return null;
    }

    // Verify signature using Web Crypto API
    const encoder = new TextEncoder();
    const data = encoder.encode(`${headerB64}.${payloadB64}`);
    const secretKey = await crypto.subtle.importKey(
      'raw',
      encoder.encode(secret),
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['verify']
    );

    const signature = Uint8Array.from(
      atob(signatureB64.replace(/-/g, '+').replace(/_/g, '/')),
      c => c.charCodeAt(0)
    );

    const isValid = await crypto.subtle.verify(
      'HMAC',
      secretKey,
      signature,
      data
    );

    if (!isValid) {
      return null;
    }

    return payload;
  } catch (error) {
    console.error('JWT verification error:', error);
    return null;
  }
}

/**
 * Authentication middleware - requires valid JWT token
 */
export async function requireAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return c.json({ error: 'Access token required' }, 401);
  }

  const token = authHeader.substring(7); // Remove 'Bearer ' prefix

  // Check if token is in session cache (KV)
  const cachedSession = await c.env.SESSIONS.get(`session:${token}`, 'json');
  
  if (cachedSession) {
    // Use cached session data
    c.set('user', cachedSession as User);
    return next();
  }

  // Verify JWT token
  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    console.error('JWT_SECRET not configured');
    return c.json({ error: 'Internal server error' }, 500);
  }

  const payload = await verifyJWT(token, jwtSecret);
  
  if (!payload || payload.type !== 'access') {
    return c.json({ error: 'Invalid or expired token' }, 401);
  }

  // Fetch user data from D1 database
  const user = await c.env.DB.prepare(
    'SELECT id, email, role, firstName, lastName FROM users WHERE id = ?'
  )
    .bind(payload.userId)
    .first();

  if (!user) {
    return c.json({ error: 'User not found' }, 401);
  }

  const userData: User = {
    userId: user.id as string,
    email: user.email as string,
    role: user.role as string,
    name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
  };

  // Cache session in KV for 15 minutes (token expiry)
  await c.env.SESSIONS.put(
    `session:${token}`,
    JSON.stringify(userData),
    { expirationTtl: 900 } // 15 minutes
  );

  c.set('user', userData);
  return next();
}

/**
 * Optional authentication middleware - doesn't fail if no token
 */
export async function optionalAuth(c: Context<{ Bindings: Env }>, next: Next) {
  const authHeader = c.req.header('Authorization');
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.substring(7);

  // Check session cache
  const cachedSession = await c.env.SESSIONS.get(`session:${token}`, 'json');
  
  if (cachedSession) {
    c.set('user', cachedSession as User);
    return next();
  }

  // Try to verify JWT
  const jwtSecret = c.env.JWT_SECRET;
  if (!jwtSecret) {
    return next();
  }

  const payload = await verifyJWT(token, jwtSecret);
  
  if (payload && payload.type === 'access') {
    const user = await c.env.DB.prepare(
      'SELECT id, email, role, firstName, lastName FROM users WHERE id = ?'
    )
      .bind(payload.userId)
      .first();

    if (user) {
      const userData: User = {
        userId: user.id as string,
        email: user.email as string,
        role: user.role as string,
        name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      };

      await c.env.SESSIONS.put(
        `session:${token}`,
        JSON.stringify(userData),
        { expirationTtl: 900 }
      );

      c.set('user', userData);
    }
  }

  return next();
}

/**
 * Role-based access control middleware
 */
export function requireRole(...allowedRoles: string[]) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    
    if (!user) {
      return c.json({ error: 'Authentication required' }, 401);
    }

    if (!allowedRoles.includes(user.role) && user.role !== 'admin') {
      return c.json({ 
        error: 'Insufficient permissions',
        required: allowedRoles,
        current: user.role
      }, 403);
    }

    return next();
  };
}

/**
 * Check if user has verified email
 */
export async function requireVerifiedEmail(c: Context<{ Bindings: Env }>, next: Next) {
  const user = c.get('user');
  
  if (!user) {
    return c.json({ error: 'Authentication required' }, 401);
  }

  const dbUser = await c.env.DB.prepare(
    'SELECT isEmailVerified FROM users WHERE id = ?'
  )
    .bind(user.userId)
    .first();

  if (!dbUser || !dbUser.isEmailVerified) {
    return c.json({ 
      error: 'Email verification required',
      message: 'Please verify your email address to access this feature'
    }, 403);
  }

  return next();
}

/**
 * Rate limiting middleware using KV
 */
export function rateLimit(options: {
  maxRequests: number;
  windowMs: number;
  keyPrefix?: string;
}) {
  return async (c: Context<{ Bindings: Env }>, next: Next) => {
    const user = c.get('user');
    const ip = c.req.header('CF-Connecting-IP') || 'unknown';
    const key = `${options.keyPrefix || 'ratelimit'}:${user?.userId || ip}`;

    // Get current count from KV
    const current = await c.env.RATE_LIMIT.get(key);
    const count = current ? parseInt(current) : 0;

    if (count >= options.maxRequests) {
      return c.json({
        error: 'Rate limit exceeded',
        message: `Maximum ${options.maxRequests} requests per ${options.windowMs / 1000} seconds`,
        retryAfter: options.windowMs / 1000
      }, 429);
    }

    // Increment counter
    await c.env.RATE_LIMIT.put(
      key,
      (count + 1).toString(),
      { expirationTtl: Math.ceil(options.windowMs / 1000) }
    );

    return next();
  };
}
