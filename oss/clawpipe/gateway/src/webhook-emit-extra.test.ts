/** @vitest-environment node */
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { emitWebhook } from './webhook-emit';
import type { Env } from './types';

interface HookRow { id: string; url: string; events: string; secret: string | null }

function makeDB(hooks: HookRow[]) {
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        all: async <T>(): Promise<{ results: T[] }> => ({ results: hooks as unknown as T[] }),
        first: async <T>(): Promise<T | null> => {
          // attemptDelivery: SELECT url, secret FROM webhooks WHERE id = ?
          if (sql.includes('FROM webhooks WHERE id = ?')) {
            const id = binds[0] as string;
            const found = hooks.find((h) => h.id === id);
            return found ? (found as unknown as T) : null;
          }
          return null;
        },
        run: async (): Promise<{ success: true }> => ({ success: true }),
      }),
    }),
  };
}

let fetchCalls: Array<{ url: string; init: RequestInit }> = [];
const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(responses: Array<{ status: number }>) {
  let i = 0;
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    fetchCalls.push({ url: String(url), init: init ?? {} });
    const r = responses[i] ?? { status: 200 };
    i++;
    return new Response('ok', { status: r.status });
  }) as typeof fetch;
}

function restoreFetch() {
  globalThis.fetch = ORIGINAL_FETCH;
}

function makeEnv(hooks: HookRow[]): Env {
  return {
    DB: makeDB(hooks) as unknown as D1Database,
    CACHE: {} as KVNamespace,
    ENVIRONMENT: 'test',
  } as unknown as Env;
}

describe('emitWebhook', () => {
  beforeEach(() => { fetchCalls = []; });
  afterEach(restoreFetch);

  it('returns 0 sent/failed when no matching hooks', async () => {
    const env = makeEnv([]);
    const result = await emitWebhook(env, 'proj1', 'anomaly.detected', { x: 1 });
    expect(result).toEqual({ sent: 0, failed: 0, queued: 0 });
  });

  it('sends to matching hook and returns sent=1', async () => {
    mockFetch([{ status: 200 }]);
    const env = makeEnv([{ id: 'h1', url: 'https://recv.test/hook', events: 'anomaly.detected', secret: null }]);
    const result = await emitWebhook(env, 'proj1', 'anomaly.detected', { val: 42 });
    expect(result.sent).toBe(1);
    expect(result.failed).toBe(0);
    expect(fetchCalls).toHaveLength(1);
    expect(fetchCalls[0].url).toBe('https://recv.test/hook');
  });

  it('skips hooks that do not match the event', async () => {
    mockFetch([{ status: 200 }]);
    const env = makeEnv([
      { id: 'h1', url: 'https://a.test/', events: 'digest.sent', secret: null },
      { id: 'h2', url: 'https://b.test/', events: 'anomaly.detected', secret: null },
    ]);
    const result = await emitWebhook(env, 'proj1', 'anomaly.detected', {});
    expect(result.sent).toBe(1);
    expect(fetchCalls[0].url).toBe('https://b.test/');
  });

  it('counts failed hook as failed', async () => {
    mockFetch([{ status: 500 }]);
    const env = makeEnv([{ id: 'h1', url: 'https://fail.test/', events: '*', secret: null }]);
    const result = await emitWebhook(env, 'proj1', 'budget.threshold.crossed', {});
    expect(result.sent).toBe(0);
    expect(result.failed).toBe(1);
  });

  it('sets X-ClawPipe-Signature when hook has secret', async () => {
    mockFetch([{ status: 200 }]);
    const env = makeEnv([{ id: 'h1', url: 'https://signed.test/', events: '*', secret: 'mysecret' }]);
    await emitWebhook(env, 'proj1', 'digest.sent', {});
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers['X-ClawPipe-Signature']).toMatch(/^sha256=[0-9a-f]{64}$/);
  });

  it('omits X-ClawPipe-Signature when hook has no secret', async () => {
    mockFetch([{ status: 200 }]);
    const env = makeEnv([{ id: 'h1', url: 'https://unsigned.test/', events: '*', secret: null }]);
    await emitWebhook(env, 'proj1', 'digest.sent', {});
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers['X-ClawPipe-Signature']).toBeUndefined();
  });

  it('sets X-ClawPipe-Event and X-ClawPipe-Webhook-Id headers', async () => {
    mockFetch([{ status: 200 }]);
    const env = makeEnv([{ id: 'hook-abc', url: 'https://x.test/', events: '*', secret: null }]);
    await emitWebhook(env, 'proj1', 'member.invited', { member: 'u1' });
    const headers = fetchCalls[0].init.headers as Record<string, string>;
    expect(headers['X-ClawPipe-Event']).toBe('member.invited');
    expect(headers['X-ClawPipe-Webhook-Id']).toBe('hook-abc');
  });

  it('handles fetch throwing as failed', async () => {
    globalThis.fetch = (async () => { throw new Error('network error'); }) as typeof fetch;
    const env = makeEnv([{ id: 'h1', url: 'https://throw.test/', events: '*', secret: null }]);
    const result = await emitWebhook(env, 'proj1', 'anomaly.detected', {});
    expect(result.failed).toBe(1);
    expect(result.sent).toBe(0);
  });

  it('sends to multiple matching hooks independently', async () => {
    mockFetch([{ status: 200 }, { status: 200 }]);
    const env = makeEnv([
      { id: 'h1', url: 'https://a.test/', events: '*', secret: null },
      { id: 'h2', url: 'https://b.test/', events: 'anomaly.detected', secret: null },
    ]);
    const result = await emitWebhook(env, 'proj1', 'anomaly.detected', {});
    expect(result.sent).toBe(2);
    expect(fetchCalls).toHaveLength(2);
  });
});
