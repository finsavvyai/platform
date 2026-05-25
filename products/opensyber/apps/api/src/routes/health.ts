/**
 * Health check endpoint.
 *
 * GET /health — public, no auth required.
 * Returns service status with D1, KV, and R2 subsystem checks.
 */

import { Hono } from 'hono';
import type { Env, Variables } from '../types.js';

interface SubsystemStatus {
  status: 'ok' | 'degraded' | 'error';
  latencyMs?: number;
  error?: string;
}

interface HealthResponse {
  status: 'healthy' | 'degraded' | 'unhealthy';
  timestamp: string;
  version: string;
  subsystems: {
    d1: SubsystemStatus;
    kv: SubsystemStatus;
    r2: SubsystemStatus;
  };
}

type AppEnv = { Bindings: Env; Variables: Variables };

export const health = new Hono<AppEnv>();

async function checkD1(db: D1Database): Promise<SubsystemStatus> {
  const start = Date.now();
  try {
    await db.prepare('SELECT 1').first();
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: 'unreachable',
    };
  }
}

async function checkKV(kv: KVNamespace): Promise<SubsystemStatus> {
  const start = Date.now();
  try {
    await kv.get('__health_check__');
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: 'unreachable',
    };
  }
}

async function checkR2(bucket: R2Bucket): Promise<SubsystemStatus> {
  const start = Date.now();
  try {
    await bucket.head('__health_check__');
    return { status: 'ok', latencyMs: Date.now() - start };
  } catch (err) {
    return {
      status: 'error',
      latencyMs: Date.now() - start,
      error: 'unreachable',
    };
  }
}

function overallStatus(
  subsystems: HealthResponse['subsystems'],
): HealthResponse['status'] {
  const statuses = Object.values(subsystems).map((s) => s.status);
  if (statuses.every((s) => s === 'ok')) return 'healthy';
  if (statuses.some((s) => s === 'error')) return 'unhealthy';
  return 'degraded';
}

health.get('/', async (c) => {
  const [d1, kv, r2] = await Promise.all([
    checkD1(c.env.DB),
    checkKV(c.env.CACHE),
    checkR2(c.env.STORAGE),
  ]);

  const subsystems = { d1, kv, r2 };
  const status = overallStatus(subsystems);

  const body: HealthResponse = {
    status,
    timestamp: new Date().toISOString(),
    version: '0.3.0',
    subsystems,
  };

  const httpStatus = status === 'healthy' ? 200 : 503;
  return c.json(body, httpStatus);
});
