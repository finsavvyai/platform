import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logAudit } from './audit-log.js';
import { createMockEnv } from '../test/helpers.js';
import type { Env } from '../types.js';

describe('logAudit', () => {
  let env: Env;
  let putCalls: Array<{ key: string; value: string; ttl: number | undefined }>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    env = createMockEnv();
    putCalls = [];
    const realPut = env.CACHE.put;
    env.CACHE.put = vi.fn(async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      putCalls.push({ key, value, ttl: opts?.expirationTtl });
      return realPut.call(env.CACHE, key, value, opts as KVNamespacePutOptions);
    }) as typeof env.CACHE.put;
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => { vi.restoreAllMocks(); });

  it('writes the audit entry to KV with action/tenantId/metadata/timestamp', async () => {
    await logAudit(env, 'api_key.created', 't1', { keyId: 'k_1', keyName: 'prod' });
    expect(putCalls).toHaveLength(1);
    const stored = JSON.parse(putCalls[0]!.value) as Record<string, unknown>;
    expect(stored.action).toBe('api_key.created');
    expect(stored.tenantId).toBe('t1');
    expect(stored.metadata).toEqual({ keyId: 'k_1', keyName: 'prod' });
    expect(typeof stored.timestamp).toBe('string');
  });

  it('uses key shape `audit:<tenantId>:<epoch_ms>:<uuid8>`', async () => {
    await logAudit(env, 'webhook.created', 'tf_acme', { webhookId: 'wh_1' });
    expect(putCalls[0]!.key).toMatch(/^audit:tf_acme:\d{13}:[a-f0-9]{8}$/);
  });

  it('sets expirationTtl to 7776000 (90 days, per SOC2 retention)', async () => {
    await logAudit(env, 'session.revoked', 't1');
    expect(putCalls[0]!.ttl).toBe(7776000);
  });

  it('emits a console.log JSON line with type=audit for log aggregation', async () => {
    await logAudit(env, 'plan.upgraded', 't1', { from: 'free', to: 'pro' });
    expect(logSpy).toHaveBeenCalledTimes(1);
    const logged = JSON.parse((logSpy.mock.calls[0]![0] as string));
    expect(logged.type).toBe('audit');
    expect(logged.action).toBe('plan.upgraded');
    expect(logged.metadata).toEqual({ from: 'free', to: 'pro' });
  });

  it('defaults metadata to empty object when not provided', async () => {
    await logAudit(env, 'session.revoked', 't1');
    const stored = JSON.parse(putCalls[0]!.value) as { metadata: Record<string, unknown> };
    expect(stored.metadata).toEqual({});
  });

  it('persists ip when provided', async () => {
    await logAudit(env, 'api_key.revoked', 't1', { keyId: 'k_x' }, '203.0.113.42');
    const stored = JSON.parse(putCalls[0]!.value) as { ip?: string };
    expect(stored.ip).toBe('203.0.113.42');
  });
});
