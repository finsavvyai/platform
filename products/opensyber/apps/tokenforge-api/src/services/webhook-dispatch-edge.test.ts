/**
 * Edge-case coverage for dispatchWebhook + crossing helpers.
 * Sibling of webhook-dispatch.test.ts so the original stays focused on
 * the canonical happy/retry/sig paths; this pins fan-out, retry-success,
 * idempotency, and threshold-boundary asymmetry.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  dispatchWebhook,
  crossedDegraded,
  crossedCritical,
} from './webhook-dispatch.js';

interface DbState {
  hooks: Array<Record<string, unknown>>;
  inserts: Array<Record<string, unknown>>;
  updates: Array<Record<string, unknown>>;
}

function makeDb(state: DbState): unknown {
  return {
    select: vi.fn(() => ({
      from: vi.fn(() => ({ where: vi.fn(async () => state.hooks) })),
    })),
    insert: vi.fn(() => ({
      values: vi.fn(async (v: Record<string, unknown>) => { state.inserts.push(v); }),
    })),
    update: vi.fn(() => ({
      set: vi.fn((v: Record<string, unknown>) => ({
        where: vi.fn(async () => { state.updates.push(v); }),
      })),
    })),
  };
}

const okHook = (over: Record<string, unknown> = {}) => ({
  id: 'wh_1', tenantId: 't1', endpointUrl: 'https://hook.example/recv',
  events: 'session.bound', enabled: 1,
  secret: 'whsec_x'.padEnd(64, '0'),
  secretPrevious: null, secretPreviousValidUntil: null, ...over,
});

describe('dispatchWebhook — edge cases', () => {
  let state: DbState;
  let fetchSpy: ReturnType<typeof vi.fn>;
  let setTimeoutSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    state = { hooks: [], inserts: [], updates: [] };
    fetchSpy = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    setTimeoutSpy = vi.spyOn(global, 'setTimeout').mockImplementation(((cb: TimerHandler) => {
      if (typeof cb === 'function') cb();
      return 0 as unknown as NodeJS.Timeout;
    }) as never);
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });
  afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

  it('succeeds on retry: HTTP 500 once, then HTTP 200 → 2 attempts logged, deliveredAt set on the 2nd', async () => {
    state.hooks = [okHook()];
    fetchSpy
      .mockResolvedValueOnce(new Response('err', { status: 500 }))
      .mockResolvedValueOnce(new Response('ok', { status: 200 }));
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    expect(state.inserts).toHaveLength(2);
    expect(state.inserts[0]!.deliveredAt).toBeNull();
    expect(state.inserts[1]!.deliveredAt).toBeTruthy();
    expect(state.updates[0]!.lastDeliveryStatus).toBe(200);
  });

  it('fan-out: two subscribed hooks → two fetch calls + two delivery rows', async () => {
    state.hooks = [
      okHook({ id: 'wh_a', endpointUrl: 'https://a.example/recv' }),
      okHook({ id: 'wh_b', endpointUrl: 'https://b.example/recv' }),
    ];
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    expect(fetchSpy).toHaveBeenCalledTimes(2);
    const urls = fetchSpy.mock.calls.map((c) => c[0]);
    expect(urls.sort()).toEqual(['https://a.example/recv', 'https://b.example/recv']);
    expect(state.inserts).toHaveLength(2);
  });

  it('X-TF-Delivery-Id is STABLE across all retry attempts (receiver-side dedupe key)', async () => {
    state.hooks = [okHook()];
    fetchSpy.mockResolvedValue(new Response('err', { status: 502 }));
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    const ids = fetchSpy.mock.calls.map((c) => (c[1] as { headers: Record<string, string> }).headers['X-TF-Delivery-Id']);
    expect(new Set(ids).size).toBe(1);
  });

  it('backoff timing: setTimeout called with BACKOFF_MS[attempt-1] = 1_000, 4_000, 15_000', async () => {
    state.hooks = [okHook()];
    fetchSpy.mockResolvedValue(new Response('err', { status: 503 }));
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    const delays = setTimeoutSpy.mock.calls.map((c) => c[1]);
    expect(delays).toEqual([1_000, 4_000, 15_000]);
  });

  it('skips signature entirely when both hook.secret and secretPrevious are absent', async () => {
    state.hooks = [okHook({ secret: null, secretPrevious: null, secretPreviousValidUntil: null })];
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    const headers = (fetchSpy.mock.calls[0]![1] as { headers: Record<string, string> }).headers;
    expect(headers['X-TF-Signature']).toBe('');
  });
});

describe('crossedDegraded — boundary asymmetry', () => {
  it('before=70, after=70 → false (after must be strictly < 70)', () => {
    expect(crossedDegraded(70, 70)).toBe(false);
  });

  it('before=70, after=39 → false (drop into critical band, not degraded)', () => {
    expect(crossedDegraded(70, 39)).toBe(false);
  });
});

describe('crossedCritical — boundary asymmetry', () => {
  it('before=40, after=40 → false (after must be strictly < 40)', () => {
    expect(crossedCritical(40, 40)).toBe(false);
  });

  it('before=40, after=39 → true (the smallest valid critical crossing)', () => {
    expect(crossedCritical(40, 39)).toBe(true);
  });
});
