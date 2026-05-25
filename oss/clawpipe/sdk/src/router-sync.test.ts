/** @vitest-environment node */
import { describe, it, expect, vi, afterEach } from 'vitest';
import { fetchRemoteWeights, pushRemoteWeights, pushQualityScore } from './router-sync';
import type { SyncConfig } from './router-sync';
import type { LearnedWeight } from './router';

const BASE_CONFIG: SyncConfig = {
  gatewayUrl: 'https://api.clawpipe.ai',
  apiKey: 'test-api-key',
  globalLearning: true,
};

const SAMPLE_WEIGHTS: Record<string, LearnedWeight> = {
  'openai:gpt-4': { provider: 'openai', model: 'gpt-4', score: 0.9, calls: 10, wins: 9 },
};

const ORIGINAL_FETCH = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH;
  vi.restoreAllMocks();
});

describe('fetchRemoteWeights', () => {
  it('returns null when globalLearning is false', async () => {
    const result = await fetchRemoteWeights({ globalLearning: false, gatewayUrl: 'https://x.com', apiKey: 'k' }, SAMPLE_WEIGHTS);
    expect(result).toBeNull();
  });

  it('returns null when gatewayUrl is missing', async () => {
    const result = await fetchRemoteWeights({ globalLearning: true, apiKey: 'k' }, SAMPLE_WEIGHTS);
    expect(result).toBeNull();
  });

  it('returns merged weights on 200 response', async () => {
    const remoteWeights: Record<string, LearnedWeight> = {
      'anthropic:claude': { provider: 'anthropic', model: 'claude', score: 0.8, calls: 5, wins: 4 },
    };
    globalThis.fetch = async () => new Response(JSON.stringify({ weights: remoteWeights }), { status: 200 });
    const result = await fetchRemoteWeights(BASE_CONFIG, SAMPLE_WEIGHTS);
    expect(result).not.toBeNull();
    expect(result!['anthropic:claude']).toBeTruthy();
  });

  it('returns null on non-ok response', async () => {
    globalThis.fetch = async () => new Response('error', { status: 500 });
    const result = await fetchRemoteWeights(BASE_CONFIG, SAMPLE_WEIGHTS);
    expect(result).toBeNull();
  });

  it('returns null when response has no weights field', async () => {
    globalThis.fetch = async () => new Response(JSON.stringify({}), { status: 200 });
    const result = await fetchRemoteWeights(BASE_CONFIG, SAMPLE_WEIGHTS);
    expect(result).toBeNull();
  });

  it('returns null on network error (swallows exception)', async () => {
    globalThis.fetch = async () => { throw new Error('ECONNREFUSED'); };
    const result = await fetchRemoteWeights(BASE_CONFIG, SAMPLE_WEIGHTS);
    expect(result).toBeNull();
  });

  it('sends Authorization header', async () => {
    let capturedHeaders: Record<string, string> = {};
    globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>;
      return new Response(JSON.stringify({ weights: {} }), { status: 200 });
    };
    await fetchRemoteWeights(BASE_CONFIG, {});
    expect(capturedHeaders['Authorization']).toBe('Bearer test-api-key');
  });
});

describe('pushRemoteWeights', () => {
  it('does nothing when globalLearning is false', async () => {
    let called = false;
    globalThis.fetch = async () => { called = true; return new Response('ok', { status: 200 }); };
    await pushRemoteWeights({ globalLearning: false, gatewayUrl: 'https://x.com', apiKey: 'k' }, SAMPLE_WEIGHTS);
    expect(called).toBe(false);
  });

  it('does nothing when gatewayUrl is missing', async () => {
    let called = false;
    globalThis.fetch = async () => { called = true; return new Response('ok', { status: 200 }); };
    await pushRemoteWeights({ globalLearning: true, apiKey: 'k' }, SAMPLE_WEIGHTS);
    expect(called).toBe(false);
  });

  it('does nothing when apiKey is missing', async () => {
    let called = false;
    globalThis.fetch = async () => { called = true; return new Response('ok', { status: 200 }); };
    await pushRemoteWeights({ globalLearning: true, gatewayUrl: 'https://x.com' }, SAMPLE_WEIGHTS);
    expect(called).toBe(false);
  });

  it('sends PUT to /v1/weights with weights in body', async () => {
    let capturedBody = '';
    let capturedMethod = '';
    globalThis.fetch = async (_url: RequestInfo | URL, init?: RequestInit) => {
      capturedBody = init?.body as string;
      capturedMethod = init?.method ?? '';
      return new Response('ok', { status: 200 });
    };
    await pushRemoteWeights(BASE_CONFIG, SAMPLE_WEIGHTS);
    expect(capturedMethod).toBe('PUT');
    const parsed = JSON.parse(capturedBody) as { weights: unknown };
    expect(parsed.weights).toBeTruthy();
  });

  it('swallows network errors (never throws)', async () => {
    globalThis.fetch = async () => { throw new Error('network fail'); };
    await expect(pushRemoteWeights(BASE_CONFIG, SAMPLE_WEIGHTS)).resolves.toBeUndefined();
  });

  it('swallows non-ok responses without throwing', async () => {
    globalThis.fetch = async () => new Response('server error', { status: 500 });
    await expect(pushRemoteWeights(BASE_CONFIG, SAMPLE_WEIGHTS)).resolves.toBeUndefined();
  });
});

describe('pushQualityScore', () => {
  it('does nothing when globalLearning is false', () => {
    let called = false;
    globalThis.fetch = async () => { called = true; return new Response('ok', { status: 200 }); };
    pushQualityScore({ globalLearning: false, gatewayUrl: 'https://x.com', apiKey: 'k' }, {
      request_id: 'r1', model: 'gpt-4', provider: 'openai', score: 0.9,
    });
    // fire-and-forget — just verify no immediate fetch
    expect(called).toBe(false);
  });

  it('does nothing when gatewayUrl is missing', () => {
    let called = false;
    globalThis.fetch = async () => { called = true; return new Response('ok', { status: 200 }); };
    pushQualityScore({ globalLearning: true, apiKey: 'k' }, {
      request_id: 'r1', model: 'gpt-4', provider: 'openai', score: 0.9,
    });
    expect(called).toBe(false);
  });

  it('does nothing when apiKey is missing', () => {
    let called = false;
    globalThis.fetch = async () => { called = true; return new Response('ok', { status: 200 }); };
    pushQualityScore({ globalLearning: true, gatewayUrl: 'https://x.com' }, {
      request_id: 'r1', model: 'gpt-4', provider: 'openai', score: 0.9,
    });
    expect(called).toBe(false);
  });

  it('fires a POST to /v1/quality when fully configured', async () => {
    const callInfo: Array<{ url: string; method: string }> = [];
    globalThis.fetch = async (url: RequestInfo | URL, init?: RequestInit) => {
      callInfo.push({ url: String(url), method: init?.method ?? '' });
      return new Response('ok', { status: 200 });
    };
    pushQualityScore(BASE_CONFIG, { request_id: 'r1', model: 'gpt-4', provider: 'openai', score: 0.95 });
    // Give the micro-task a tick
    await new Promise((r) => setTimeout(r, 10));
    expect(callInfo.length).toBeGreaterThanOrEqual(1);
    expect(callInfo[0].url).toContain('/v1/quality');
    expect(callInfo[0].method).toBe('POST');
  });
});
