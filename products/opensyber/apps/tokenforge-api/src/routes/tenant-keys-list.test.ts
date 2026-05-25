/**
 * Coverage for GET /v1/tenant/api-keys (untested in tenant-keys.test.ts)
 * + audit-log assertions for PUT/DELETE side effects.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createMockEnv, createMockDb } from '../test/helpers.js';
import type { Env } from '../types.js';

vi.mock('../lib/db.js', () => ({
  createDb: vi.fn(() => (globalThis as Record<string, unknown>).__mockDb),
}));
vi.mock('hono/logger', () => ({
  logger: () => async (_c: unknown, next: () => Promise<void>) => { await next(); },
}));

const { mockLogAudit } = vi.hoisted(() => ({ mockLogAudit: vi.fn(async () => undefined) }));
vi.mock('../services/audit-log.js', () => ({ logAudit: mockLogAudit }));

import worker from '../index.js';

const auth = (): Record<string, string> => ({ Authorization: 'Bearer tf_testkey123' });

async function req(path: string, init: RequestInit, env: Env): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, init),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const apiKeyAuth = { keyId: 'k_auth', tenantId: 't1', isActive: true, expiresAt: null, tenantPlan: 'pro' };

describe('GET /v1/tenant/api-keys', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('returns empty data array when tenant has no API keys', async () => {
    db._setSelectResults([
      [apiKeyAuth],   // tenantAuth select
      [],             // GET keys query
    ]);
    const r = await req('/v1/tenant/api-keys', { headers: auth() }, env);
    expect(r.status).toBe(200);
    expect(((await r.json()) as { data: unknown[] }).data).toEqual([]);
  });

  it('enriches each key with allowedDomains from KV cache when present', async () => {
    db._setSelectResults([
      [apiKeyAuth],
      [{ id: 'k_a', name: 'Prod', prefix: 'tf_a', isActive: true, lastUsedAt: null, expiresAt: null, createdAt: 'now' }],
    ]);
    await env.CACHE.put('domains:k_a', JSON.stringify(['a.example.com', 'b.example.com']));
    const r = await req('/v1/tenant/api-keys', { headers: auth() }, env);
    const data = ((await r.json()) as { data: Array<{ id: string; allowedDomains: string[] }> }).data;
    expect(data).toHaveLength(1);
    expect(data[0]!.id).toBe('k_a');
    expect(data[0]!.allowedDomains).toEqual(['a.example.com', 'b.example.com']);
  });

  it('returns empty allowedDomains when KV has no entry for the key id', async () => {
    db._setSelectResults([
      [apiKeyAuth],
      [{ id: 'k_b', name: 'Dev', prefix: 'tf_b', isActive: true, lastUsedAt: null, expiresAt: null, createdAt: 'now' }],
    ]);
    // No env.CACHE.put for 'domains:k_b' → KV miss
    const r = await req('/v1/tenant/api-keys', { headers: auth() }, env);
    const data = ((await r.json()) as { data: Array<{ allowedDomains: string[] }> }).data;
    expect(data[0]!.allowedDomains).toEqual([]);
  });

  it('preserves the column projection (only id/name/prefix/isActive/lastUsedAt/expiresAt/createdAt + allowedDomains)', async () => {
    db._setSelectResults([
      [apiKeyAuth],
      [{ id: 'k_c', name: 'X', prefix: 'tf_c', isActive: true, lastUsedAt: '2026-05-08T00:00:00Z', expiresAt: null, createdAt: 'now' }],
    ]);
    const r = await req('/v1/tenant/api-keys', { headers: auth() }, env);
    const data = ((await r.json()) as { data: Array<Record<string, unknown>> }).data;
    expect(Object.keys(data[0]!).sort()).toEqual(
      ['allowedDomains', 'createdAt', 'expiresAt', 'id', 'isActive', 'lastUsedAt', 'name', 'prefix'],
    );
  });
});

describe('Audit log side effects', () => {
  let env: Env;
  let db: ReturnType<typeof createMockDb>;

  beforeEach(() => {
    vi.clearAllMocks();
    env = createMockEnv();
    db = createMockDb();
    (globalThis as Record<string, unknown>).__mockDb = db;
  });
  afterEach(() => { vi.restoreAllMocks(); });

  it('PUT /api-keys/:id/domains writes api_key.domains_updated audit event with keyId+domain list', async () => {
    db._setSelectResults([[apiKeyAuth], [{ id: 'k_d' }]]);
    await req('/v1/tenant/api-keys/k_d/domains', {
      method: 'PUT',
      headers: { ...auth(), 'Content-Type': 'application/json' },
      body: JSON.stringify({ allowedDomains: ['x.com'] }),
    }, env);
    expect(mockLogAudit).toHaveBeenCalled();
    const call = mockLogAudit.mock.calls[0]!;
    expect(call[1]).toBe('api_key.domains_updated');
    expect(call[2]).toBe('t1');
    expect(call[3]).toMatchObject({ keyId: 'k_d', allowedDomains: ['x.com'] });
  });

  it('DELETE /api-keys/:id writes api_key.revoked audit + DB.update sets isActive=false', async () => {
    db._setSelectResults([
      [apiKeyAuth],
      [{ id: 'k_e', tenantId: 't1', isActive: true }],
    ]);
    await req('/v1/tenant/api-keys/k_e', { method: 'DELETE', headers: auth() }, env);
    expect(mockLogAudit).toHaveBeenCalled();
    expect(mockLogAudit.mock.calls[0]![1]).toBe('api_key.revoked');
    expect(mockLogAudit.mock.calls[0]![3]).toMatchObject({ keyId: 'k_e' });
    expect(db._updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ isActive: false }));
  });

  it('DELETE /api-keys/:id removes the domain allowlist from KV (waitUntil cache.delete)', async () => {
    db._setSelectResults([
      [apiKeyAuth],
      [{ id: 'k_f', tenantId: 't1', isActive: true }],
    ]);
    await env.CACHE.put('domains:k_f', JSON.stringify(['old.example']));
    await req('/v1/tenant/api-keys/k_f', { method: 'DELETE', headers: auth() }, env);
    expect(env.CACHE.delete).toHaveBeenCalledWith('domains:k_f');
  });
});
