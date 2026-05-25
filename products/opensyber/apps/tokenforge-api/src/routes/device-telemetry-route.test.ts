/**
 * Route-level integration tests for GET /v1/devices/:id/telemetry.
 * Lives in a sibling file so `device-telemetry.test.ts` stays focused
 * on the pure `classifyKey` unit and does not pull in the full worker.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({ createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb) }));
vi.mock('hono/logger', () => ({ logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/tenant-auth.js', () => ({
  tenantAuth: async (c: { set: (k: string, v: unknown) => void }, next: () => Promise<void>) => {
    c.set('tenantId', 't1'); c.set('tenantPlan', 'pro'); await next();
  },
}));
vi.mock('../middleware/usage-limit.js', () => ({ usageLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); } }));
vi.mock('../middleware/rate-limit.js', () => ({
  publicRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  apiRateLimit: async (_c: unknown, next: () => Promise<void>) => { await next(); },
  rateLimit: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));
vi.mock('../middleware/guard.js', () => ({ guardMiddleware: () => async (_c: unknown, next: () => Promise<void>) => { await next(); } }));

import worker from '../index.js';

async function get(path: string, env: Env): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { authorization: 'Bearer tf_test' } }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const baseDevice = (over: Record<string, unknown> = {}) => ({
  id: 'dev_1', tenantId: 't1', sessionId: 'sess_1', userId: 'user_1',
  publicKey: JSON.stringify({ kty: 'EC', crv: 'P-256', x: 'X', y: 'Y' }),
  trustScore: 92, boundAt: '2026-05-06T00:00:00Z', lastVerifiedAt: '2026-05-06T00:00:00Z',
  expiresAt: '2026-05-07T00:00:00Z', revoked: 0, ...over,
});

let env: Env;
let db: ReturnType<typeof createMockDb>;
beforeEach(() => {
  vi.clearAllMocks();
  env = createMockEnv();
  db = createMockDb();
  (globalThis as Record<string, unknown>).__mockDb = db;
});

describe('GET /v1/devices/:id/telemetry', () => {
  it('404 device_not_found when no device matches id+tenant', async () => {
    db._setSelectResult([]);
    const res = await get('/v1/devices/missing/telemetry', env);
    expect(res.status).toBe(404);
    expect(((await res.json()) as { error: string }).error).toBe('device_not_found');
  });

  it('returns full telemetry shape on happy path', async () => {
    db._setSelectResults([[baseDevice()], []]);
    const res = await get('/v1/devices/dev_1/telemetry', env);
    expect(res.status).toBe(200);
    const data = ((await res.json()) as { data: Record<string, unknown> }).data;
    expect(data.deviceId).toBe('dev_1');
    expect(data.keyClass).toBe('browser_software');
    expect(data.isAttested).toBe(false);
    expect(data.channelBound).toBe(false);
    expect(data.trustScore).toBe(92);
    expect(data.revoked).toBe(false);
    expect(data.boundAt).toBe('2026-05-06T00:00:00Z');
    expect(data.lastVerifiedAt).toBe('2026-05-06T00:00:00Z');
    expect(Array.isArray(data.anomalies)).toBe(true);
  });

  it('classifies non-JWK publicKey as keyClass=unknown', async () => {
    db._setSelectResults([[baseDevice({ publicKey: '-----BEGIN PUBLIC KEY-----' })], []]);
    const res = await get('/v1/devices/dev_1/telemetry', env);
    const data = ((await res.json()) as { data: { keyClass: string } }).data;
    expect(data.keyClass).toBe('unknown');
  });

  it('marks revoked=true when device.revoked === 1', async () => {
    db._setSelectResults([[baseDevice({ revoked: 1 })], []]);
    const res = await get('/v1/devices/dev_1/telemetry', env);
    const data = ((await res.json()) as { data: { revoked: boolean } }).data;
    expect(data.revoked).toBe(true);
  });

  it('reads aitm_-prefixed events from tfSecurityEvents and slices the kind suffix', async () => {
    // Production filter is `eventType.startsWith('aitm_')`; the kind is
    // sliced after that prefix. Non-aitm events are dropped.
    const rows = [
      { id: 'ev1', sessionId: 'sess_1', eventType: 'aitm_origin_mismatch', metadata: JSON.stringify({ confidence: 'high' }), createdAt: '2026-05-06T00:01:00Z' },
      { id: 'ev2', sessionId: 'sess_1', eventType: 'aitm_ua_drift', metadata: JSON.stringify({ confidence: 'medium' }), createdAt: '2026-05-06T00:02:00Z' },
      { id: 'ev3', sessionId: 'sess_1', eventType: 'trust.block', metadata: '{}', createdAt: '2026-05-06T00:03:00Z' },
    ];
    db._setSelectResults([[baseDevice()], rows]);
    const res = await get('/v1/devices/dev_1/telemetry', env);
    const data = ((await res.json()) as { data: { anomalies: Array<{ kind: string; confidence?: string }> } }).data;
    expect(data.anomalies).toHaveLength(2);
    expect(data.anomalies.map((a) => a.kind).sort()).toEqual(['origin_mismatch', 'ua_drift']);
    expect(data.anomalies[0]!.confidence).toBeDefined();
  });

  it('keyClass=unknown when publicKey is empty string (degraded session)', async () => {
    db._setSelectResults([[baseDevice({ publicKey: '' })], []]);
    const res = await get('/v1/devices/dev_1/telemetry', env);
    const data = ((await res.json()) as { data: { keyClass: string } }).data;
    expect(data.keyClass).toBe('unknown');
  });

  it('aitm event with malformed metadata JSON → confidence=undefined (line 167 catch)', async () => {
    // Tests JSON.parse failure inside the aitm-event mapping. Without this
    // catch, a corrupted metadata row would 500 the whole route. The catch
    // returns confidence=undefined so the response degrades gracefully.
    db._setSelectResults([
      [baseDevice()],
      [{ id: 'ev1', sessionId: 'sess_1', eventType: 'aitm_origin_mismatch', metadata: 'not{json', createdAt: '2026-05-06T00:01:00Z' }],
    ]);
    const res = await get('/v1/devices/dev_1/telemetry', env);
    const data = ((await res.json()) as { data: { anomalies: Array<{ kind: string; confidence?: string }> } }).data;
    expect(data.anomalies).toHaveLength(1);
    expect(data.anomalies[0]!.confidence).toBeUndefined();
  });
});
