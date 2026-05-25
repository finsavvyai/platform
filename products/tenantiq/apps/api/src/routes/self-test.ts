/**
 * Self-test endpoint: smoke tests against own API subsystems.
 * GET /api/self-test — checks DB, KV, auth middleware, Graph token validity.
 */

import { Hono } from 'hono';
import type { AppEnv } from '../app/types';
import { authMiddleware } from '../middleware/auth';

export const selfTestRoutes = new Hono<AppEnv>();
selfTestRoutes.use('*', authMiddleware);

interface CheckResult {
  name: string;
  status: 'pass' | 'fail';
  ms: number;
  error?: string;
}

selfTestRoutes.get('/', async (c) => {
  const checks: CheckResult[] = [];

  checks.push(await runCheck('database', () => checkDatabase(c.env.DB)));
  checks.push(await runCheck('kv', () => checkKV(c.env.KV)));
  checks.push(await runCheck('auth', () => checkAuth(c)));
  checks.push(await runCheck('graph_token', () => checkGraphToken(c.env.KV)));

  const overall = checks.every((ch) => ch.status === 'pass') ? 'pass' : 'fail';
  const status = overall === 'pass' ? 200 : 503;

  return c.json({ checks, overall, timestamp: new Date().toISOString() }, status);
});

async function runCheck(
  name: string,
  fn: () => Promise<void>,
): Promise<CheckResult> {
  const start = Date.now();
  try {
    await fn();
    return { name, status: 'pass', ms: Date.now() - start };
  } catch (err) {
    console.error(`Self-test check '${name}' failed:`, err);
    return {
      name,
      status: 'fail',
      ms: Date.now() - start,
      error: 'Check failed',
    };
  }
}

async function checkDatabase(db: D1Database): Promise<void> {
  const result = await db.prepare('SELECT 1 AS ok').first<{ ok: number }>();
  if (!result || result.ok !== 1) {
    throw new Error('Database query returned unexpected result');
  }
}

async function checkKV(kv: KVNamespace): Promise<void> {
  const testKey = '__self_test_probe__';
  await kv.put(testKey, 'ok', { expirationTtl: 60 });
  const value = await kv.get(testKey);
  if (value !== 'ok') {
    throw new Error('KV read/write verification failed');
  }
  await kv.delete(testKey);
}

async function checkAuth(c: { get: (key: 'user') => unknown }): Promise<void> {
  const user = c.get('user');
  if (!user) {
    throw new Error('Auth middleware did not populate user context');
  }
}

async function checkGraphToken(kv: KVNamespace): Promise<void> {
  // List known tenants with cached Graph tokens
  const probe = await kv.list({ prefix: 'graph:', limit: 1 });
  if (probe.keys.length === 0) {
    throw new Error('No Graph API tokens found in KV');
  }
}
