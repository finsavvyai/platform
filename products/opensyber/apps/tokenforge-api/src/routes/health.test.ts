import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));

vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => {
    await next();
  },
}));

import worker from '../index.js';

async function workerRequest(
  path: string,
  init: RequestInit = {},
  env: Env,
): Promise<Response> {
  const url = `http://localhost${path}`;
  const req = new Request(url, init);
  return worker.fetch(
    req,
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

describe('Health Routes', () => {
  let mockEnv: Env;

  beforeEach(() => {
    vi.clearAllMocks();
    mockEnv = createMockEnv();
    const mockDb = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = mockDb;
  });

  it('GET /health — returns healthy status', async () => {
    const res = await workerRequest('/health', {}, mockEnv);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.status).toBe('healthy');
    expect(body.service).toBe('tokenforge-api');
    expect(body.timestamp).toBeDefined();
  });

  it('GET /health — does not require auth', async () => {
    const res = await workerRequest('/health', {}, mockEnv);
    expect(res.status).toBe(200);
  });
});
