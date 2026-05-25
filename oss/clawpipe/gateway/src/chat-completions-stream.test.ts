/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { streamChatCompletions } from './chat-completions-stream';
import type { Env, PromptRequest } from './types';

vi.mock('./rate-limit', () => ({
  withProviderTimeout: vi.fn((p: Promise<unknown>) => p),
  PROVIDER_TIMEOUT_MS: 30_000,
}));
vi.mock('./providers/registry', () => ({
  getAdapter: vi.fn(),
  getApiKey: vi.fn(),
}));

import { getAdapter } from './providers/registry';

const makeEnv = (): Env => ({
  DB: {} as D1Database,
  CACHE: {} as KVNamespace,
  ENVIRONMENT: 'test',
});

const baseReq: PromptRequest = {
  prompt: 'user: hello',
  provider: 'openai',
  model: 'gpt-4o',
};

describe('streamChatCompletions', () => {
  beforeEach(() => vi.restoreAllMocks());

  it('returns text/event-stream content-type', async () => {
    vi.mocked(getAdapter).mockReturnValue({
      name: 'openai',
      call: vi.fn().mockResolvedValue({ text: 'hi', tokensIn: 2, tokensOut: 1, latencyMs: 10 }),
    });

    // Use a provider not in STREAM_URLS so we hit fallback path (no real fetch)
    const res = await streamChatCompletions(
      { ...baseReq, provider: 'anthropic', model: 'claude-3-5-sonnet-20241022' },
      'anthropic', 'sk-ant', 'claude-3-5-sonnet-20241022', makeEnv(),
    );
    expect(res.headers.get('Content-Type')).toContain('text/event-stream');
  });

  it('fallback path: emits single chunk + data: [DONE]', async () => {
    vi.mocked(getAdapter).mockReturnValue({
      name: 'gemini',
      call: vi.fn().mockResolvedValue({ text: 'world', tokensIn: 3, tokensOut: 2, latencyMs: 20 }),
    });

    const res = await streamChatCompletions(
      { ...baseReq, provider: 'gemini', model: 'gemini-1.5-pro' },
      'gemini', 'key', 'gemini-1.5-pro', makeEnv(),
    );
    expect(res.status).toBe(200);
    const text = await res.text();
    expect(text).toContain('chat.completion.chunk');
    expect(text).toContain('"content":"world"');
    expect(text).toContain('data: [DONE]');
  });

  it('final event in fallback is data: [DONE]\\n\\n', async () => {
    vi.mocked(getAdapter).mockReturnValue({
      name: 'gemini',
      call: vi.fn().mockResolvedValue({ text: 'ok', tokensIn: 1, tokensOut: 1, latencyMs: 5 }),
    });
    const res = await streamChatCompletions(
      { ...baseReq, provider: 'gemini', model: 'gemini-1.5-pro' },
      'gemini', 'key', 'gemini-1.5-pro', makeEnv(),
    );
    const text = await res.text();
    expect(text.trimEnd()).toMatch(/data: \[DONE\]$/);
  });

  it('returns 502 when adapter throws', async () => {
    vi.mocked(getAdapter).mockReturnValue({
      name: 'gemini',
      call: vi.fn().mockRejectedValue(new Error('timeout')),
    });
    const res = await streamChatCompletions(
      { ...baseReq, provider: 'gemini', model: 'gemini-1.5-pro' },
      'gemini', 'key', 'gemini-1.5-pro', makeEnv(),
    );
    expect(res.status).toBe(502);
  });

  it('returns 502 when no adapter found', async () => {
    vi.mocked(getAdapter).mockReturnValue(undefined);
    const res = await streamChatCompletions(
      { ...baseReq, provider: 'unknown', model: 'x' },
      'unknown', 'key', 'x', makeEnv(),
    );
    expect(res.status).toBe(502);
  });
});
