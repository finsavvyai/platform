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
      from: vi.fn(() => ({
        where: vi.fn(async () => state.hooks),
      })),
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
  id: 'wh_1',
  tenantId: 't1',
  endpointUrl: 'https://hook.example/recv',
  events: 'session.bound,session.verified',
  enabled: 1,
  secret: 'whsec_old0000000000000000000000000000000000000000000000000000000000',
  secretPrevious: null,
  secretPreviousValidUntil: null,
  ...over,
});

describe('dispatchWebhook', () => {
  let state: DbState;
  let fetchSpy: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    state = { hooks: [], inserts: [], updates: [] };
    fetchSpy = vi.fn(async () => new Response('ok', { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    // Make backoff timers instant so retry tests don't wait real seconds.
    vi.spyOn(global, 'setTimeout').mockImplementation((cb: TimerHandler) => {
      if (typeof cb === 'function') cb();
      return 0 as unknown as NodeJS.Timeout;
    });
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('returns early when tenant has no enabled webhooks', async () => {
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(state.inserts).toHaveLength(0);
  });

  it('returns early when no webhook is subscribed to the event', async () => {
    state.hooks = [okHook({ events: 'session.revoked' })];
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('delivers once on HTTP 200, records deliveredAt, updates lastDeliveryStatus', async () => {
    state.hooks = [okHook()];
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', { foo: 1 });
    expect(fetchSpy).toHaveBeenCalledTimes(1);
    expect(state.inserts).toHaveLength(1);
    expect(state.inserts[0]!.deliveredAt).toBeDefined();
    expect(state.inserts[0]!.attempt).toBe(1);
    expect(state.updates[0]!.lastDeliveryStatus).toBe(200);
  });

  it('retries up to MAX_ATTEMPTS on HTTP 500, eventually gives up; persists status per attempt', async () => {
    state.hooks = [okHook()];
    fetchSpy.mockResolvedValue(new Response('err', { status: 500 }));
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    // 4 attempts max (MAX_ATTEMPTS = 4)
    expect(fetchSpy).toHaveBeenCalledTimes(4);
    expect(state.inserts).toHaveLength(4);
    // deliveredAt is null on every attempt because none succeeded
    for (const ins of state.inserts) expect(ins.deliveredAt).toBeNull();
    // last attempt has nextRetryAt=null because no more retries available
    expect(state.inserts[3]!.nextRetryAt).toBeNull();
    expect(state.updates[0]!.lastDeliveryStatus).toBe(500);
  });

  it('records status=0 with error string when fetch throws (network failure)', async () => {
    state.hooks = [okHook()];
    fetchSpy.mockRejectedValue(new Error('econn-refused'));
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    expect(state.inserts[0]!.status).toBeNull();
    expect(state.inserts[0]!.error).toBe('econn-refused');
  });

  it('signature includes BOTH v1 entries when previous secret is within grace window', async () => {
    state.hooks = [okHook({
      secret: 'whsec_NEW000000000000000000000000000000000000000000000000000000000000',
      secretPrevious: 'whsec_OLD000000000000000000000000000000000000000000000000000000000000',
      secretPreviousValidUntil: new Date(Date.now() + 60_000).toISOString(),
    })];
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    const headers = (fetchSpy.mock.calls[0]![1] as { headers: Record<string, string> }).headers;
    const sig = headers['X-TF-Signature'];
    // Two space-separated `v1,<hex>` entries
    expect(sig.match(/v1,[a-f0-9]{64}/g)).toHaveLength(2);
  });

  it('signature includes ONLY current v1 when previous secret has expired', async () => {
    state.hooks = [okHook({
      secret: 'whsec_NEW000000000000000000000000000000000000000000000000000000000000',
      secretPrevious: 'whsec_OLD000000000000000000000000000000000000000000000000000000000000',
      secretPreviousValidUntil: new Date(Date.now() - 1000).toISOString(), // past
    })];
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    const headers = (fetchSpy.mock.calls[0]![1] as { headers: Record<string, string> }).headers;
    const sig = headers['X-TF-Signature'];
    expect(sig.match(/v1,[a-f0-9]{64}/g)).toHaveLength(1);
  });

  it('emits the canonical TokenForge headers on every delivery', async () => {
    state.hooks = [okHook()];
    await dispatchWebhook(makeDb(state) as never, 't1', 'session.bound', {});
    const headers = (fetchSpy.mock.calls[0]![1] as { headers: Record<string, string> }).headers;
    expect(headers['Content-Type']).toBe('application/json');
    expect(headers['X-TF-Event']).toBe('session.bound');
    expect(headers['X-TF-Delivery-Id']).toBeTruthy();
    expect(headers['X-TF-Timestamp']).toBeTruthy();
    expect(headers['User-Agent']).toBe('TokenForge-Webhook/1.0');
  });
});

describe('crossedDegraded', () => {
  it('returns true when score crosses from ≥70 to [40, 70)', () => {
    expect(crossedDegraded(85, 65)).toBe(true);
    expect(crossedDegraded(70, 60)).toBe(true);
  });
  it('returns false when before is already below 70', () => {
    expect(crossedDegraded(65, 50)).toBe(false);
  });
  it('returns false when after dips below 40 (that is the critical band)', () => {
    expect(crossedDegraded(80, 30)).toBe(false);
  });
});

describe('crossedCritical', () => {
  it('returns true when score crosses ≥40 → <40', () => {
    expect(crossedCritical(50, 30)).toBe(true);
    expect(crossedCritical(40, 39)).toBe(true);
  });
  it('returns false when before is already below 40', () => {
    expect(crossedCritical(35, 20)).toBe(false);
  });
});
