import { describe, it, expect, vi } from 'vitest';
import { deliverWebhook, signWebhook, verifyWebhook } from './dispatcher.js';

describe('signWebhook + verifyWebhook', () => {
  it('round-trips with the same secret', async () => {
    const sig = await signWebhook('secret_x', '{"event":"t"}', '1700000000');
    const ok = await verifyWebhook('secret_x', '{"event":"t"}', '1700000000', sig);
    expect(ok).toBe(true);
  });

  it('rejects a tampered body', async () => {
    const sig = await signWebhook('secret_x', '{"event":"t"}', '1700000000');
    const ok = await verifyWebhook('secret_x', '{"event":"X"}', '1700000000', sig);
    expect(ok).toBe(false);
  });

  it('rejects with the wrong secret', async () => {
    const sig = await signWebhook('secret_x', '{}', '1700');
    const ok = await verifyWebhook('secret_y', '{}', '1700', sig);
    expect(ok).toBe(false);
  });
});

describe('deliverWebhook', () => {
  it('succeeds on first 2xx', async () => {
    const fetchImpl = vi.fn(async () => new Response('ok'));
    const r = await deliverWebhook({
      url: 'https://hook.test',
      secret: 'k',
      event: 'risk_signal',
      body: { x: 1 },
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
    });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(1);
  });

  it('retries on 5xx then gives up', async () => {
    const fetchImpl = vi.fn(async () => new Response('boom', { status: 500 }));
    const r = await deliverWebhook({
      url: 'https://hook.test',
      secret: 'k',
      event: 'risk_signal',
      body: {},
      attempts: 2,
      backoffBaseMs: 0,
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(2);
    expect(r.status).toBe(500);
  });

  it('does NOT retry on 4xx (except 429)', async () => {
    const fetchImpl = vi.fn(async () => new Response('nope', { status: 400 }));
    const r = await deliverWebhook({
      url: 'https://hook.test', secret: 'k', event: 'x', body: {},
      attempts: 3, backoffBaseMs: 0,
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.attempts).toBe(1);
    expect(r.error).toBe('client_error');
  });

  it('retries on 429 like a 5xx', async () => {
    let calls = 0;
    const fetchImpl = vi.fn(async () => {
      calls++;
      if (calls < 2) return new Response('', { status: 429 });
      return new Response('ok');
    });
    const r = await deliverWebhook({
      url: 'https://hook.test', secret: 'k', event: 'x', body: {},
      attempts: 3, backoffBaseMs: 0,
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
    });
    expect(r.ok).toBe(true);
    expect(r.attempts).toBe(2);
  });

  it('captures network errors and retries until exhausted', async () => {
    const fetchImpl = vi.fn(async () => { throw new Error('network down'); });
    const r = await deliverWebhook({
      url: 'https://hook.test', secret: 'k', event: 'x', body: {},
      attempts: 2, backoffBaseMs: 0,
      fetchImpl: fetchImpl as unknown as typeof globalThis.fetch,
    });
    expect(r.ok).toBe(false);
    expect(r.error).toBe('network down');
  });
});
