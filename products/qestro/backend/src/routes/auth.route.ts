/**
 * Auth routes -- login, register, /me, logout.
 * Uses Workers-compatible JWT + PBKDF2 (no Node.js deps).
 */
import { Hono } from 'hono';
import { z } from 'zod';
import { drizzle } from 'drizzle-orm/d1';
import { eq } from 'drizzle-orm';
import * as schema from '../db/schema';
import { signJWT, verifyJWT } from '../auth/jwt';
import { hashPassword, verifyPassword } from '../auth/password';
import { rateLimiters } from '../middleware/rateLimit';
import { parseJsonBody } from '../utils/validateJsonBody';

type AuthBindings = {
  Bindings: { DB: D1Database; ENVIRONMENT: string; JWT_SECRET: string };
};

const authRoute = new Hono<AuthBindings>();

const fallbackUsers = new Map<string, {
  id: string;
  email: string;
  name: string;
  role: string;
  subscription: string;
  passwordHash: string;
  createdAt: Date;
  updatedAt: Date;
}>();

const isMissingUsersTableError = (error: unknown) => {
  const message = error instanceof Error ? error.message : String(error);
  return message.includes('no such table: users') || message.includes('SQLITE_ERROR');
};

// ---------- schemas ----------

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  name: z.string().min(1),
  role: z.enum(['admin', 'user', 'viewer', 'developer', 'tester', 'manager']).optional(),
});

const forgotPasswordSchema = z.object({
  email: z.string().email(),
});

// ---------- POST /login ----------

authRoute.post('/login', rateLimiters.auth(), async (c) => {
  const parsed = await parseJsonBody(c, loginSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const { email, password } = parsed.data;
  const db = drizzle(c.env.DB);

  // Demo credential fallback (non-production only)
  const isDemoAccount =
    c.env.ENVIRONMENT !== 'production' &&
    email === 'test@questro.io' &&
    password === 'testpassword123';

  let userId = 'user-demo-001';
  let role = 'admin';
  let userName = 'Demo User';
  let subscription = 'pro';

  if (!isDemoAccount) {
    try {
      const rows = await db
        .select()
        .from(schema.users)
        .where(eq(schema.users.email, email))
        .limit(1);

      if (rows.length === 0) {
        return c.json({ success: false, error: 'Invalid credentials' }, 401);
      }

      const user = rows[0];

      if (user.passwordHash) {
        const valid = await verifyPassword(password, user.passwordHash);
        if (!valid) {
          return c.json({ success: false, error: 'Invalid credentials' }, 401);
        }
      } else if (c.env.ENVIRONMENT === 'production') {
        return c.json({ success: false, error: 'Invalid credentials' }, 401);
      }

      userId = user.id;
      role = user.role;
      userName = user.name;
      subscription = user.subscription;
    } catch (error) {
      if (!isMissingUsersTableError(error)) {
        throw error;
      }

      const user = Array.from(fallbackUsers.values()).find((entry) => entry.email === email);
      if (!user) {
        return c.json({ success: false, error: 'Invalid credentials' }, 401);
      }

      const valid = await verifyPassword(password, user.passwordHash);
      if (!valid) {
        return c.json({ success: false, error: 'Invalid credentials' }, 401);
      }

      userId = user.id;
      role = user.role;
      userName = user.name;
      subscription = user.subscription;
    }
  }

  const accessToken = await signJWT(
    { userId, email, role },
    c.env.JWT_SECRET,
    86400,
  );
  const refreshToken = await signJWT(
    { userId, type: 'refresh' },
    c.env.JWT_SECRET,
    604800,
  );

  return c.json({
    success: true,
    data: {
      user: {
        id: userId,
        email,
        name: userName,
        firstName: userName.split(' ')[0],
        lastName: userName.split(' ').slice(1).join(' ') || 'User',
        role,
        subscription,
        avatar: null,
        preferences: {},
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      },
      tokens: { accessToken, refreshToken, expiresIn: 86400 },
    },
  });
});

// ---------- POST /register ----------

authRoute.post('/register', rateLimiters.auth(), async (c) => {
  const parsed = await parseJsonBody(c, registerSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const { email, password, name, role } = parsed.data;
  const db = drizzle(c.env.DB);

  const hashed = await hashPassword(password);
  const userId = crypto.randomUUID();
  const now = new Date();
  const userRecord = {
    id: userId,
    email,
    name,
    role: role ?? 'user',
    subscription: 'free',
    passwordHash: hashed,
    createdAt: now,
    updatedAt: now,
  };

  try {
    const existing = await db
      .select({ id: schema.users.id })
      .from(schema.users)
      .where(eq(schema.users.email, email))
      .limit(1);

    if (existing.length > 0) {
      return c.json({ success: false, error: 'Email already registered' }, 409);
    }

    await db.insert(schema.users).values(userRecord);
  } catch (error) {
    if (!isMissingUsersTableError(error)) {
      throw error;
    }

    const existingFallback = Array.from(fallbackUsers.values()).find((entry) => entry.email === email);
    if (existingFallback) {
      return c.json({ success: false, error: 'Email already registered' }, 409);
    }

    fallbackUsers.set(userId, userRecord);
  }

  const accessToken = await signJWT(
    { userId, email, role: role ?? 'user' },
    c.env.JWT_SECRET,
    86400,
  );

  return c.json({
    success: true,
    data: {
      user: { id: userId, email, name, role: role ?? 'user', subscription: 'free' },
      tokens: { accessToken, expiresIn: 86400 },
    },
  }, 201);
});

// ---------- POST /forgot-password ----------

authRoute.post('/forgot-password', rateLimiters.auth(), async (c) => {
  const parsed = await parseJsonBody(c, forgotPasswordSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  return c.json({
    success: true,
    message: 'If an account exists with this email, you will receive password reset instructions.',
  });
});

// ---------- POST /refresh ----------

const refreshSchema = z.object({
  refreshToken: z.string(),
});

authRoute.post('/refresh', async (c) => {
  const parsed = await parseJsonBody(c, refreshSchema);
  if ('response' in parsed) {
    return parsed.response;
  }

  const { refreshToken } = parsed.data;

  try {
    const payload = await verifyJWT(refreshToken, c.env.JWT_SECRET);
    if (payload.type !== 'refresh') {
      return c.json({ success: false, error: 'Invalid token type' }, 401);
    }

    const userId = payload.userId as string;
    const db = drizzle(c.env.DB);

    // If it's the demo account
    if (c.env.ENVIRONMENT !== 'production' && userId === 'user-demo-001') {
      const newAccessToken = await signJWT(
        { userId, email: 'test@questro.io', role: 'admin' },
        c.env.JWT_SECRET,
        86400,
      );
      const newRefreshToken = await signJWT(
        { userId, type: 'refresh' },
        c.env.JWT_SECRET,
        604800,
      );

      return c.json({
        success: true,
        data: {
          tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 86400 },
        },
      });
    }

    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, userId))
      .limit(1);

    if (rows.length === 0) {
      return c.json({ success: false, error: 'User not found' }, 404);
    }

    const user = rows[0];

    const newAccessToken = await signJWT(
      { userId, email: user.email, role: user.role },
      c.env.JWT_SECRET,
      86400,
    );
    const newRefreshToken = await signJWT(
      { userId, type: 'refresh' },
      c.env.JWT_SECRET,
      604800,
    );

    return c.json({
      success: true,
      data: {
        tokens: { accessToken: newAccessToken, refreshToken: newRefreshToken, expiresIn: 86400 },
      },
    });
  } catch (error) {
    return c.json({ success: false, error: 'Invalid or expired refresh token' }, 401);
  }
});

// ---------- GET /me ----------

authRoute.get('/me', async (c) => {
  const authHeader = c.req.header('Authorization');
  if (!authHeader?.startsWith('Bearer ')) {
    return c.json({ success: false, error: 'Unauthorized' }, 401);
  }

  let payload;
  try {
    payload = await verifyJWT(authHeader.slice(7), c.env.JWT_SECRET);
  } catch {
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }

  try {
    const db = drizzle(c.env.DB);

    const rows = await db
      .select()
      .from(schema.users)
      .where(eq(schema.users.id, payload.userId as string))
      .limit(1);

    if (rows.length === 0) {
      const fallbackUser = fallbackUsers.get(payload.userId as string);
      if (fallbackUser) {
        return c.json({
          success: true,
          data: {
            id: fallbackUser.id,
            email: fallbackUser.email,
            name: fallbackUser.name,
            role: fallbackUser.role,
            subscription: fallbackUser.subscription,
            preferences: {},
            createdAt: fallbackUser.createdAt,
            updatedAt: fallbackUser.updatedAt,
          },
        });
      }

      return c.json({
        success: true,
        data: {
          id: payload.userId,
          email: payload.email,
          name: String(payload.email).split('@')[0],
          role: payload.role,
          subscription: 'free',
          preferences: {},
        },
      });
    }

    const u = rows[0];
    return c.json({
      success: true,
      data: {
        id: u.id,
        email: u.email,
        name: u.name,
        role: u.role,
        subscription: u.subscription,
        preferences: {},
        createdAt: u.createdAt,
        updatedAt: u.updatedAt,
      },
    });
  } catch (error) {
    if (isMissingUsersTableError(error)) {
      const fallbackUser = fallbackUsers.get(payload.userId as string);
      if (fallbackUser) {
        return c.json({
          success: true,
          data: {
            id: fallbackUser.id,
            email: fallbackUser.email,
            name: fallbackUser.name,
            role: fallbackUser.role,
            subscription: fallbackUser.subscription,
            preferences: {},
            createdAt: fallbackUser.createdAt,
            updatedAt: fallbackUser.updatedAt,
          },
        });
      }

      return c.json({
        success: true,
        data: {
          id: payload.userId,
          email: payload.email,
          name: String(payload.email).split('@')[0],
          role: payload.role,
          subscription: 'free',
          preferences: {},
        },
      });
    }
    return c.json({ success: false, error: 'Invalid token' }, 401);
  }
});

// ---------- POST /logout ----------

authRoute.post('/logout', (c) =>
  c.json({ success: true, message: 'Logged out successfully' }),
);

export default authRoute;
