/**
 * Auth Routes - User registration
 */

import { Hono } from 'hono';
import '../types';
import {
  generateToken,
  createSession,
  getUserByEmail,
} from '../auth-secure';
import { hashPassword } from '../crypto-utils';
import type { Env } from './types';

const registerRoutes = new Hono<{ Bindings: Env }>();

/** POST /register - Register new user */
registerRoutes.post('/register', async (c) => {
  try {
    const { email, name, password, organizationId } = await c.req.json();

    if (!email || !name || !password) {
      return c.json({
        error: 'Invalid request',
        message: 'Email, name, and password are required',
      }, 400);
    }

    const existingUser = await getUserByEmail(email, c.env.DASHBOARD_DB);
    if (existingUser) {
      return c.json({
        error: 'User already exists',
        message: 'An account with this email already exists',
      }, 409);
    }

    if (password.length < 8) {
      return c.json({
        error: 'Weak password',
        message: 'Password must be at least 8 characters long',
      }, 400);
    }

    const userId = crypto.randomUUID();
    const passwordHash = await hashPassword(password);

    await c.env.DASHBOARD_DB.prepare(`
      INSERT INTO dashboard_users (
        id, email, name, password_hash, role, permissions, organization_id, is_active
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).bind(
      userId,
      email,
      name,
      passwordHash,
      'user',
      JSON.stringify([]),
      organizationId || null,
      1
    ).run();

    const user = await getUserByEmail(email, c.env.DASHBOARD_DB);

    if (!user) {
      throw new Error('Failed to create user');
    }

    const token = await generateToken(user);

    const userAgent = c.req.header('User-Agent');
    const ipAddress = c.req.header('CF-Connecting-IP') || c.req.header('X-Forwarded-For');
    const sessionId = await createSession(user, c.env.DASHBOARD_DB, userAgent, ipAddress);

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

export default registerRoutes;
