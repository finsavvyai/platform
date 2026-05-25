/**
 * Mutation-path coverage for /v1/webhooks (PATCH happy + POST/DELETE
 * audit + provided-secret path). Sibling of webhooks-config.test.ts
 * (173L, near cap) which focused on listing + 404s + creation shape.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const { mockLogAudit } = vi.hoisted(() => ({ mockLogAudit: vi.fn(async () => undefined) }));
vi.mock('../services/audit-log.js', () => ({ logAudit: mockLogAudit }));

import worker from '../index.js';

async function api(method: string, path: string, env: Env, body?: unknown): Promise<Response> {
  return worker.fetch(
    new Request(`http://localhost${path}`, {
      method,
      headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    }),
    env,
    { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
  );
}

const okHook = (over: Record<string, unknown> = {}) => ({
  id: 'wh_1', tenantId: 't1', name: 'siem', endpointUrl: 'https://siem.x/y',
  events: 'session.bound', enabled: 1, lastDeliveryAt: null, lastDeliveryStatus: null,
  createdAt: 'a', updatedAt: 'b', ...over,
});

let env: Env;
let db: ReturnType<typeof createMockDb>;

beforeEach(() => {
  vi.clearAllMocks();
  env = createMockEnv();
  db = createMockDb();
  (globalThis as Record<string, unknown>).__mockDb = db;
});
afterEach(() => { vi.restoreAllMocks(); });

describe('POST /v1/webhooks — secret + audit shape', () => {
  it('uses provided secret verbatim when body.secret is set (does NOT auto-generate)', async () => {
    db._setSelectResults([[]]); // count check returns no existing rows
    const customSecret = 'whsec_' + 'a'.repeat(64);
    const r = await api('POST', '/v1/webhooks', env, {
      endpointUrl: 'https://x/y', events: ['session.bound'], secret: customSecret,
    });
    expect(r.status).toBe(201);
    const j = (await r.json()) as { data: { secret: string } };
    expect(j.data.secret).toBe(customSecret);
  });

  it('defaults name to empty string when omitted in request body', async () => {
    db._setSelectResults([[]]);
    const r = await api('POST', '/v1/webhooks', env, {
      endpointUrl: 'https://x/y', events: ['session.bound'],
    });
    expect(((await r.json()) as { data: { name: string } }).data.name).toBe('');
  });

  it('audit log payload includes webhookId + endpointUrl + events array', async () => {
    db._setSelectResults([[]]);
    await api('POST', '/v1/webhooks', env, {
      endpointUrl: 'https://siem.example/ingest', events: ['session.bound', 'trust_score.degraded'],
    });
    expect(mockLogAudit).toHaveBeenCalled();
    const call = mockLogAudit.mock.calls.find((c) => c[1] === 'webhook.created');
    expect(call).toBeDefined();
    const payload = call![3] as Record<string, unknown>;
    expect(payload.webhookId).toBeTruthy();
    expect(payload.endpointUrl).toBe('https://siem.example/ingest');
    expect(payload.events).toEqual(['session.bound', 'trust_score.degraded']);
  });
});

describe('PATCH /v1/webhooks/:id — mutation paths', () => {
  it('400 invalid_json when body is not parseable', async () => {
    const r = await worker.fetch(
      new Request('http://localhost/v1/webhooks/wh_1', {
        method: 'PATCH',
        headers: { 'content-type': 'application/json', authorization: 'Bearer tf_test' },
        body: '{not-json',
      }),
      env,
      { waitUntil: vi.fn(), passThroughOnException: vi.fn() } as unknown as ExecutionContext,
    );
    expect(r.status).toBe(400);
    expect(((await r.json()) as { error: string }).error).toBe('invalid_json');
  });

  it('enabled=false transitions DB.update to {enabled: 0} and response shows enabled: false', async () => {
    // Existing-lookup, then post-patch re-select
    db._setSelectResults([[okHook()], [okHook({ enabled: 0 })]]);
    const r = await api('PATCH', '/v1/webhooks/wh_1', env, { enabled: false });
    expect(r.status).toBe(200);
    expect(db._updateChain.set).toHaveBeenCalledWith(expect.objectContaining({ enabled: 0 }));
    const j = (await r.json()) as { data: { enabled: boolean } };
    expect(j.data.enabled).toBe(false);
  });

  it('partial update of events only flattens to comma-list in DB, leaves other fields off the patch', async () => {
    db._setSelectResults([[okHook()], [okHook({ events: 'session.bound,trust_score.critical' })]]);
    await api('PATCH', '/v1/webhooks/wh_1', env, { events: ['session.bound', 'trust_score.critical'] });
    const patchArg = (db._updateChain.set.mock.calls[0]![0]) as Record<string, unknown>;
    expect(patchArg.events).toBe('session.bound,trust_score.critical');
    expect(patchArg.endpointUrl).toBeUndefined();
    expect(patchArg.name).toBeUndefined();
    expect(patchArg.enabled).toBeUndefined();
    expect(patchArg.updatedAt).toBeDefined();
  });
});

describe('DELETE /v1/webhooks/:id — db.delete invocation', () => {
  it('actually invokes db.delete + writes webhook.deleted audit with webhookId', async () => {
    db._setSelectResult([{ id: 'wh_x' }]);
    await api('DELETE', '/v1/webhooks/wh_x', env);
    expect(db.delete).toHaveBeenCalled();
    const call = mockLogAudit.mock.calls.find((c) => c[1] === 'webhook.deleted');
    expect(call).toBeDefined();
    expect((call![3] as { webhookId: string }).webhookId).toBe('wh_x');
  });
});
