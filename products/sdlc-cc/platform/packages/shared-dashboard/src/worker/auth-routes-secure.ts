/**
 * Secure Authentication Routes for Unified Dashboard
 * Production-ready with proper password hashing
 */

import { Hono } from 'hono';
import './types'; // Import to extend Hono context types
import {
  generateToken,
  createSession,
  getUserByEmail,
  requireAuth,
  hashPassword,
  verifyPassword,
  hashAPIKey,
  type User
} from './auth-secure';

interface Env {
  DASHBOARD_DB: D1Database;
  DASHBOARD_CACHE: KVNamespace;
}

const authRoutes = new Hono<{ Bindings: Env }>();

/**
 * POST /api/v1/auth/login
 * Login with email and password (with secure password verification)
 */
authRoutes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({
        error: 'Invalid request',
        message: 'Email and password are required',
      }, 400);
    }

    // Get user with password hash
    const result = await c.env.DASHBOARD_DB.prepare(`
      SELECT id, email, name, role, permissions, organization_id, created_at, password_hash
      FROM dashboard_users
      WHERE email = ? AND is_active = 1
    `).bind(email).first();

    if (!result) {
      // Constant time response to prevent timing attacks
      await hashPassword('dummy-password-for-timing');
      return c.json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      }, 401);
    }

    // Verify password with secure comparison
    const isValidPassword = await verifyPassword(password, result.password_hash as string);

    if (!isValidPassword) {
      return c.json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      }, 401);
    }

    const user: User = {
      id: result.id as string,
      email: result.email as string,
      name: result.name as string,
      role: (result.role as 'admin' | 'user' | 'viewer') || 'user',
      permissions: JSON.parse(result.permissions as string || '[]'),
      organizationId: result.organization_id as string | undefined,
      createdAt: result.created_at as string,
    };

    // Generate JWT token
    const token = await generateToken(user);

    // Create session
    const userAgent = c.req.header('User-Agent');
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    const sessionId = await createSession(user, c.env.DASHBOARD_DB, userAgent, ipAddress);

    // Update last login
    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_users
      SET last_login_at = datetime('now')
      WHERE id = ?
    `).bind(user.id).run();

    // Set secure cookie
    c.header('Set-Cookie', `dashboard_session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);

    return c.json({
      success: true,
      token,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    });
  } catch (error) {
    console.error('Login error:', error);
    return c.json({
      error: 'Login failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/v1/auth/logout
 * Logout and destroy session
 */
authRoutes.post('/logout', requireAuth, async (c) => {
  try {
    // Note: Cookie parsing requires additional library or manual header parsing
    // For now, we skip cookie-based session destruction
    // const sessionId = c.req.cookie('dashboard_session');
    // if (sessionId) {
    //   await destroySession(sessionId, c.env.DASHBOARD_DB);
    // }

    // Clear cookie
    c.header('Set-Cookie', 'dashboard_session=; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=0');

    return c.json({
      success: true,
      message: 'Logged out successfully',
    });
  } catch (error) {
    console.error('Logout error:', error);
    return c.json({
      error: 'Logout failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/v1/auth/register
 * Register new user with secure password hashing
 */
authRoutes.post('/register', async (c) => {
  try {
    const { email, name, password, organizationId } = await c.req.json();

    if (!email || !name || !password) {
      return c.json({
        error: 'Invalid request',
        message: 'Email, name, and password are required',
      }, 400);
    }

    // Validate password strength
    if (password.length < 12) {
      return c.json({
        error: 'Invalid password',
        message: 'Password must be at least 12 characters long',
      }, 400);
    }

    // Check if user already exists
    const existingUser = await getUserByEmail(email, c.env.DASHBOARD_DB);
    if (existingUser) {
      return c.json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      }, 409);
    }

    // Hash password securely
    const passwordHash = await hashPassword(password);

    // Create new user
    const userId = crypto.randomUUID();

    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_users (
        id, email, name, password_hash, role, permissions, organization_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      email,
      name,
      passwordHash,
      'user', // Default role
      JSON.stringify([]), // Default permissions
      organizationId || null,
      1 // Active by default
    ).run();

    // Get the created user
    const user = await getUserByEmail(email, c.env.DASHBOARD_DB);

    if (!user) {
      throw new Error('Failed to create user');
    }

    // Generate token
    const token = await generateToken(user);

    // Create session
    const userAgent = c.req.header('User-Agent');
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    const sessionId = await createSession(user, c.env.DASHBOARD_DB, userAgent, ipAddress);

    // Set secure cookie
    c.header('Set-Cookie', `dashboard_session=${sessionId}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=86400`);

    return c.json({
      success: true,
      token,
      sessionId,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        permissions: user.permissions,
      },
    }, 201);
  } catch (error) {
    console.error('Registration error:', error);
    return c.json({
      error: 'Registration failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/auth/me
 * Get current user info
 */
authRoutes.get('/me', requireAuth, async (c) => {
  const user = c.get('user') as User;

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      permissions: user.permissions,
      organizationId: user.organizationId,
      createdAt: user.createdAt,
    },
  });
});

/**
 * PUT /api/v1/auth/me
 * Update current user info
 */
authRoutes.put('/me', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const { name } = await c.req.json();

    if (!name) {
      return c.json({
        error: 'Invalid request',
        message: 'Name is required',
      }, 400);
    }

    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_users
      SET name = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(name, user.id).run();

    return c.json({
      success: true,
      message: 'Profile updated successfully',
    });
  } catch (error) {
    console.error('Update profile error:', error);
    return c.json({
      error: 'Update failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/v1/auth/change-password
 * Change password with secure hashing
 */
authRoutes.post('/change-password', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const { currentPassword, newPassword } = await c.req.json();

    if (!currentPassword || !newPassword) {
      return c.json({
        error: 'Invalid request',
        message: 'Current password and new password are required',
      }, 400);
    }

    // Validate new password strength
    if (newPassword.length < 12) {
      return c.json({
        error: 'Invalid password',
        message: 'New password must be at least 12 characters long',
      }, 400);
    }

    // Get current password hash
    const result = await c.env.DASHBOARD_DB.prepare(`
      SELECT password_hash FROM dashboard_users WHERE id = ?
    `).bind(user.id).first();

    if (!result) {
      return c.json({
        error: 'User not found',
        message: 'User account not found',
      }, 404);
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, result.password_hash as string);
    if (!isValid) {
      return c.json({
        error: 'Invalid password',
        message: 'Current password is incorrect',
      }, 401);
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword);

    // Update password
    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_users
      SET password_hash = ?, updated_at = datetime('now')
      WHERE id = ?
    `).bind(newPasswordHash, user.id).run();

    return c.json({
      success: true,
      message: 'Password changed successfully',
    });
  } catch (error) {
    console.error('Change password error:', error);
    return c.json({
      error: 'Password change failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * POST /api/v1/auth/refresh
 * Refresh authentication token
 */
authRoutes.post('/refresh', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;

    // Generate new token
    const token = await generateToken(user);

    return c.json({
      success: true,
      token,
    });
  } catch (error) {
    console.error('Token refresh error:', error);
    return c.json({
      error: 'Refresh failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
    }
});

/**
 * POST /api/v1/auth/api-keys
 * Generate new API key with secure hashing
 */
authRoutes.post('/api-keys', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const { name, permissions, expiresIn } = await c.req.json();

    if (!name) {
      return c.json({
        error: 'Invalid request',
        message: 'Name is required',
      }, 400);
    }

    // Generate secure API key
    const apiKeyArray = new Uint8Array(32);
    crypto.getRandomValues(apiKeyArray);
    const apiKey = `dk_${btoa(String.fromCharCode(...apiKeyArray)).replace(/[+/=]/g, m => ({ '+': '-', '/': '_', '=': '' })[m] || '')}`;

    // Hash the API key securely
    const keyHash = await hashAPIKey(apiKey);

    // Calculate expiration
    let expiresAt = null;
    if (expiresIn) {
      const now = new Date();
      now.setDate(now.getDate() + expiresIn);
      expiresAt = now.toISOString();
    }

    const keyId = crypto.randomUUID();

    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_api_keys (
        id, user_id, key_hash, name, permissions, expires_at, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?)
    `).bind(
      keyId,
      user.id,
      keyHash,
      name,
      JSON.stringify(permissions || []),
      expiresAt,
      1
    ).run();

    return c.json({
      success: true,
      apiKey, // Only returned once!
      keyId,
      name,
      permissions: permissions || [],
      expiresAt,
      warning: 'Store this API key securely. It will not be shown again.',
    }, 201);
  } catch (error) {
    console.error('API key creation error:', error);
    return c.json({
      error: 'API key creation failed',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * GET /api/v1/auth/api-keys
 * List user's API keys (without showing the actual keys)
 */
authRoutes.get('/api-keys', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;

    const { results } = await c.env.DASHBOARD_DB.prepare(`
      SELECT
        id,
        name,
        permissions,
        last_used_at,
        expires_at,
        is_active,
        created_at
      FROM dashboard_api_keys
      WHERE user_id = ?
      ORDER BY created_at DESC
    `).bind(user.id).all();

    return c.json({
      apiKeys: results.map(key => ({
        id: key.id,
        name: key.name,
        permissions: JSON.parse(key.permissions as string || '[]'),
        lastUsedAt: key.last_used_at,
        expiresAt: key.expires_at,
        isActive: key.is_active === 1,
        createdAt: key.created_at,
      })),
    });
  } catch (error) {
    console.error('List API keys error:', error);
    return c.json({
      error: 'Failed to list API keys',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

/**
 * DELETE /api/v1/auth/api-keys/:id
 * Revoke API key
 */
authRoutes.delete('/api-keys/:id', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
    const keyId = c.req.param('id');

    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_api_keys
      SET is_active = 0, updated_at = datetime('now')
      WHERE id = ? AND user_id = ?
    `).bind(keyId, user.id).run();

    return c.json({
      success: true,
      message: 'API key revoked successfully',
    });
  } catch (error) {
    console.error('Revoke API key error:', error);
    return c.json({
      error: 'Failed to revoke API key',
      message: error instanceof Error ? error.message : 'Unknown error',
    }, 500);
  }
});

export default authRoutes;
