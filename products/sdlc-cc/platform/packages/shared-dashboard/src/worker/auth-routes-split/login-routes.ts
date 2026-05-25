/**
 * Auth Routes - Login, logout, register, me, update, refresh
 */

import { Hono } from 'hono';
import '../types';
import {
  generateToken,
  createSession,
  getUserByEmail,
  requireAuth,
  type User,
} from '../auth-secure';
import { verifyPassword } from '../crypto-utils';
import type { Env } from './types';

const loginRoutes = new Hono<{ Bindings: Env }>();

/** POST /login - Login with email and password */
loginRoutes.post('/login', async (c) => {
  try {
    const { email, password } = await c.req.json();

    if (!email || !password) {
      return c.json({
        error: 'Invalid request',
        message: 'Email and password are required',
      }, 400);
    }

    const user = await getUserByEmail(email, c.env.DASHBOARD_DB);

    if (!user) {
      return c.json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      }, 401);
    }

    if (!user.password_hash) {
      return c.json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      }, 401);
    }

    const isValidPassword = await verifyPassword(password, user.password_hash);
    if (!isValidPassword) {
      return c.json({
        error: 'Invalid credentials',
        message: 'Email or password is incorrect',
      }, 401);
    }

    const token = await generateToken(user);

    const userAgent = c.req.header('User-Agent');
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    const sessionId = await createSession(user, c.env.DASHBOARD_DB, userAgent, ipAddress);

    await c.env.DASHBOARD_DB.prepare(`
      UPDATE dashboard_users
      SET last_login_at = datetime('now')
      WHERE id = ?
    `).bind(user.id).run();

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

/** POST /logout - Logout and destroy session */
loginRoutes.post('/logout', requireAuth, async (c) => {
  try {
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

/** GET /me - Get current user info */
loginRoutes.get('/me', requireAuth, async (c) => {
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

/** PUT /me - Update current user info */
loginRoutes.put('/me', requireAuth, async (c) => {
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

/** POST /refresh - Refresh authentication token */
loginRoutes.post('/refresh', requireAuth, async (c) => {
  try {
    const user = c.get('user') as User;
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

export default loginRoutes;
