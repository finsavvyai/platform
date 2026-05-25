import { Hono } from 'hono';
import { zValidator } from '@hono/zod-validator';
import { z } from 'zod';
import { sign } from 'hono/jwt';

type Bindings = {
  DB: D1Database;
  JWT_SECRET: string;
};

const authRouter = new Hono<{ Bindings: Bindings }>();

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const hashPassword = async (password: string): Promise<string> => {
  const encoder = new TextEncoder();
  const data = encoder.encode(password);
  const hash = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
};

// POST /auth/register
authRouter.post('/register', zValidator('json', RegisterSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const db = c.env.DB as D1Database;

    const hash = await hashPassword(body.password);
    const userId = crypto.randomUUID();

    await db
      .prepare(
        'INSERT INTO users (id, email, name, password_hash, created_at) VALUES (?, ?, ?, ?, ?)'
      )
      .bind(userId, body.email, body.name, hash, new Date().toISOString())
      .run();

    const token = await sign({ userId, email: body.email }, c.env.JWT_SECRET);
    return c.json({ userId, token, email: body.email }, 201);
  } catch (error: any) {
    if (error?.message?.includes('UNIQUE')) {
      return c.json({ error: 'Email already exists' }, 409);
    }
    return c.json({ error: 'Registration failed' }, 500);
  }
});

// POST /auth/login
authRouter.post('/login', zValidator('json', LoginSchema), async (c) => {
  try {
    const body = c.req.valid('json');
    const db = c.env.DB as D1Database;

    const { results } = await db
      .prepare('SELECT id, password_hash FROM users WHERE email = ?')
      .bind(body.email)
      .all();

    if (!results?.[0]) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const hash = await hashPassword(body.password);
    const user = results[0] as { id: string; password_hash: string };

    if (user.password_hash !== hash) {
      return c.json({ error: 'Invalid credentials' }, 401);
    }

    const token = await sign({ userId: user.id, email: body.email }, c.env.JWT_SECRET);
    return c.json({ userId: user.id, token, email: body.email });
  } catch (error) {
    return c.json({ error: 'Login failed' }, 500);
  }
});

// POST /auth/refresh
authRouter.post('/refresh', async (c) => {
  try {
    const authHeader = c.req.header('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return c.json({ error: 'Missing token' }, 401);
    }

    const token = authHeader.slice(7);
    // In production, verify old token, extract claims, issue new one
    return c.json({ token });
  } catch (error) {
    return c.json({ error: 'Token refresh failed' }, 500);
  }
});

// POST /auth/logout (client-side, but endpoint for consistency)
authRouter.post('/logout', async (c) => {
  return c.json({ success: true });
});

export default authRouter;
