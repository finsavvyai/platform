/** Auth routes — register, login, session management (email/password). */

import type { Env } from '../types';
import { hashPassword, verifyPassword } from './password';
import { createToken, verifyToken, extractToken, sessionCookie, clearSessionCookie } from './jwt';

/** POST /auth/register — create a new user with email/password. */
export async function handleRegister(request: Request, env: Env): Promise<Response> {
  const secret = env.AUTH_SECRET;
  if (!secret) return Response.json({ error: 'Auth not configured' }, { status: 500 });

  let body: { email: string; password: string; name?: string };
  try { body = await request.json() as typeof body; } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.email || !body.password) return Response.json({ error: 'Email and password required' }, { status: 400 });
  if (body.password.length < 8) return Response.json({ error: 'Password must be at least 8 characters' }, { status: 400 });
  if (!isValidEmail(body.email)) return Response.json({ error: 'Invalid email format' }, { status: 400 });

  const existing = await env.DB.prepare('SELECT id FROM users WHERE email = ?').bind(body.email.toLowerCase()).first();
  if (existing) return Response.json({ error: 'Email already registered' }, { status: 409 });

  const id = crypto.randomUUID();
  const passwordHash = await hashPassword(body.password);

  await env.DB.prepare(
    'INSERT INTO users (id, email, name, password_hash) VALUES (?, ?, ?, ?)',
  ).bind(id, body.email.toLowerCase(), body.name ?? null, passwordHash).run();

  const token = await createToken({ sub: id, email: body.email.toLowerCase(), name: body.name }, secret);
  return Response.json(
    { user: { id, email: body.email.toLowerCase(), name: body.name } },
    { status: 201, headers: { 'Set-Cookie': sessionCookie(token) } },
  );
}

/** POST /auth/login — authenticate with email/password. */
export async function handleLogin(request: Request, env: Env): Promise<Response> {
  const secret = env.AUTH_SECRET;
  if (!secret) return Response.json({ error: 'Auth not configured' }, { status: 500 });

  let body: { email: string; password: string };
  try { body = await request.json() as typeof body; } catch {
    return Response.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  if (!body.email || !body.password) return Response.json({ error: 'Email and password required' }, { status: 400 });

  const user = await env.DB.prepare(
    'SELECT id, email, name, password_hash FROM users WHERE email = ?',
  ).bind(body.email.toLowerCase()).first<{ id: string; email: string; name: string; password_hash: string }>();

  if (!user || !user.password_hash) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

  const valid = await verifyPassword(body.password, user.password_hash);
  if (!valid) return Response.json({ error: 'Invalid credentials' }, { status: 401 });

  const token = await createToken({ sub: user.id, email: user.email, name: user.name }, secret);
  return Response.json(
    { user: { id: user.id, email: user.email, name: user.name } },
    { status: 200, headers: { 'Set-Cookie': sessionCookie(token) } },
  );
}

/** POST /auth/logout — clear session cookie. */
export function handleLogout(): Response {
  return Response.json({ ok: true }, { status: 200, headers: { 'Set-Cookie': clearSessionCookie() } });
}

/** GET /auth/me — get current user from session. */
export async function handleMe(request: Request, env: Env): Promise<Response> {
  const secret = env.AUTH_SECRET;
  if (!secret) return Response.json({ error: 'Auth not configured' }, { status: 500 });

  const token = extractToken(request);
  if (!token) return Response.json({ error: 'Not authenticated' }, { status: 401 });

  const payload = await verifyToken(token, secret);
  if (!payload) return Response.json({ error: 'Invalid or expired session' }, { status: 401 });

  const user = await env.DB.prepare(
    'SELECT id, email, name, avatar_url, created_at FROM users WHERE id = ?',
  ).bind(payload.sub).first();

  if (!user) return Response.json({ error: 'User not found' }, { status: 404 });
  return Response.json({ user });
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}
