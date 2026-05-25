/** @vitest-environment node */
/** Provider adapters with non-OpenAI wire shapes:
 *  openai (its own), perplexity (OpenAI-compat — adding here for symmetry),
 *  anthropic, gemini, cohere, replicate, huggingface. */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { openaiAdapter } from './openai';
import { perplexityAdapter } from './perplexity';
import { anthropicAdapter } from './anthropic';
import { geminiAdapter } from './gemini';
import { cohereAdapter } from './cohere';
import { replicateAdapter } from './replicate';
import { huggingfaceAdapter } from './huggingface';
import type { PromptRequest } from '../types';

const ORIGINAL_FETCH = globalThis.fetch;
let lastCall: { url: string; init: RequestInit } | null = null;

function mockFetch(body: object, status = 200): void {
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    lastCall = { url: String(url), init: init ?? {} };
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

beforeEach(() => { lastCall = null; });
afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

const baseReq: PromptRequest = {
  prompt: 'hi', provider: 'x', model: 'm', system: 'be brief',
  maxTokens: 100, temperature: 0.5,
};

describe('openaiAdapter', () => {
  it('parses OpenAI choices/usage shape', async () => {
    mockFetch({ choices: [{ message: { content: 'pong' } }], usage: { prompt_tokens: 7, completion_tokens: 3 } });
    const r = await openaiAdapter.call(baseReq, 'sk-x');
    expect(r.text).toBe('pong');
    expect(r.tokensIn).toBe(7);
    expect(r.tokensOut).toBe(3);
    expect(lastCall!.url).toBe('https://api.openai.com/v1/chat/completions');
    expect((lastCall!.init.headers as Record<string, string>)['Authorization']).toBe('Bearer sk-x');
  });
  it('throws on non-2xx', async () => {
    mockFetch({}, 500);
    await expect(openaiAdapter.call(baseReq, 'sk-x')).rejects.toThrow(/OpenAI 500/);
  });
});

describe('perplexityAdapter', () => {
  it('parses OpenAI shape via /chat/completions', async () => {
    mockFetch({ choices: [{ message: { content: 'p-resp' } }], usage: { prompt_tokens: 4, completion_tokens: 2 } });
    const r = await perplexityAdapter.call(baseReq, 'sk-p');
    expect(r.text).toBe('p-resp');
    expect(lastCall!.url).toContain('perplexity.ai');
  });
  it('throws on non-2xx', async () => {
    mockFetch({}, 429);
    await expect(perplexityAdapter.call(baseReq, 'sk-p')).rejects.toThrow();
  });
});

describe('anthropicAdapter', () => {
  it('uses x-api-key + anthropic-version + content[0].text', async () => {
    mockFetch({
      content: [{ text: 'claude says hi' }],
      usage: { input_tokens: 9, output_tokens: 5 },
    });
    const r = await anthropicAdapter.call(baseReq, 'sk-ant');
    expect(r.text).toBe('claude says hi');
    expect(r.tokensIn).toBe(9);
    expect(r.tokensOut).toBe(5);
    const headers = lastCall!.init.headers as Record<string, string>;
    expect(headers['x-api-key']).toBe('sk-ant');
    expect(headers['anthropic-version']).toBe('2023-06-01');
  });
  it('throws on non-2xx', async () => {
    mockFetch({}, 502);
    await expect(anthropicAdapter.call(baseReq, 'sk-ant')).rejects.toThrow(/Anthropic 502/);
  });
});

describe('geminiAdapter', () => {
  it('uses URL key + parses candidates[0].content.parts[0].text', async () => {
    mockFetch({
      candidates: [{ content: { parts: [{ text: 'gem' }] } }],
      usageMetadata: { promptTokenCount: 4, candidatesTokenCount: 2 },
    });
    const r = await geminiAdapter.call(baseReq, 'AIzaXYZ');
    expect(r.text).toBe('gem');
    expect(r.tokensIn).toBe(4);
    expect(r.tokensOut).toBe(2);
    expect(lastCall!.url).toContain('generativelanguage.googleapis.com');
    expect(lastCall!.url).toContain('key=AIzaXYZ');
  });
  it('throws on non-2xx', async () => {
    mockFetch({}, 500);
    await expect(geminiAdapter.call(baseReq, 'AIz')).rejects.toThrow(/Gemini 500/);
  });
});

describe('cohereAdapter', () => {
  it('parses { text } and uses preamble for system', async () => {
    mockFetch({
      text: 'cohere reply',
      meta: { tokens: { input_tokens: 3, output_tokens: 1 } },
    });
    const r = await cohereAdapter.call(baseReq, 'sk-co');
    expect(r.text).toBe('cohere reply');
    const body = JSON.parse(lastCall!.init.body as string) as { preamble: string; message: string };
    expect(body.preamble).toBe('be brief');
    expect(body.message).toBe('hi');
  });
  it('throws on non-2xx', async () => {
    mockFetch({}, 503);
    await expect(cohereAdapter.call(baseReq, 'sk-co')).rejects.toThrow();
  });
});

describe('replicateAdapter', () => {
  it('parses output[] and joins to string', async () => {
    mockFetch({
      output: ['hello ', 'replicate'],
      metrics: { input_token_count: 2, output_token_count: 4 },
    });
    const r = await replicateAdapter.call(baseReq, 'r8-token');
    expect(r.text).toBe('hello replicate');
    expect(lastCall!.url).toContain('api.replicate.com');
  });
  it('throws on non-2xx', async () => {
    mockFetch({}, 422);
    await expect(replicateAdapter.call(baseReq, 'r8-token')).rejects.toThrow(/Replicate 422/);
  });
});

describe('huggingfaceAdapter', () => {
  it('concatenates system+prompt and parses array response', async () => {
    mockFetch([{ generated_text: 'hf reply' }]);
    const r = await huggingfaceAdapter.call(baseReq, 'hf-token');
    expect(r.text).toBe('hf reply');
    const body = JSON.parse(lastCall!.init.body as string) as { inputs: string };
    expect(body.inputs).toContain('be brief');
    expect(body.inputs).toContain('hi');
  });
  it('throws on non-2xx', async () => {
    mockFetch({}, 503);
    await expect(huggingfaceAdapter.call(baseReq, 'hf')).rejects.toThrow(/HuggingFace 503/);
  });
  it('uses prompt only when system not provided', async () => {
    mockFetch([{ generated_text: 'ok' }]);
    await huggingfaceAdapter.call({ prompt: 'just-prompt', provider: 'hf', model: 'm' }, 'hf');
    const body = JSON.parse(lastCall!.init.body as string) as { inputs: string };
    expect(body.inputs).toBe('just-prompt');
  });
});

describe('no-system + default-arg branches across non-OpenAI adapters', () => {
  it('anthropicAdapter: omits system + falls back to default maxTokens/temperature', async () => {
    mockFetch({ content: [{ text: 'ok' }], usage: { input_tokens: 0, output_tokens: 0 } });
    await anthropicAdapter.call({ prompt: 'hi', provider: 'anthropic', model: 'm' }, 'sk-x');
    const body = JSON.parse(lastCall!.init.body as string) as { system: string | undefined; max_tokens: number; temperature: number };
    expect(body.system).toBeUndefined();
    expect(body.max_tokens).toBe(4096);
    expect(body.temperature).toBe(0.7);
  });

  it('geminiAdapter: omits systemInstruction when no system + default config', async () => {
    mockFetch({
      candidates: [{ content: { parts: [{ text: 'g' }] } }],
      usageMetadata: { promptTokenCount: 1, candidatesTokenCount: 1 },
    });
    await geminiAdapter.call({ prompt: 'hi', provider: 'gemini', model: 'm' }, 'AIz');
    const body = JSON.parse(lastCall!.init.body as string) as { systemInstruction?: unknown; generationConfig: { maxOutputTokens: number } };
    expect(body.systemInstruction).toBeUndefined();
    expect(body.generationConfig.maxOutputTokens).toBe(4096);
  });

  it('cohereAdapter: omits preamble when no system + default tokens', async () => {
    mockFetch({ text: 'c', meta: { tokens: { input_tokens: 0, output_tokens: 0 } } });
    await cohereAdapter.call({ prompt: 'hi', provider: 'cohere', model: 'm' }, 'sk-c');
    const body = JSON.parse(lastCall!.init.body as string) as { preamble?: string; max_tokens: number };
    expect(body.preamble).toBeUndefined();
    expect(body.max_tokens).toBe(4096);
  });

  it('replicateAdapter: omits system_prompt when no system + defaults', async () => {
    mockFetch({ output: ['ok'], metrics: { input_token_count: 0, output_token_count: 0 } });
    await replicateAdapter.call({ prompt: 'hi', provider: 'replicate', model: 'm' }, 'r8');
    const body = JSON.parse(lastCall!.init.body as string) as { input: { system_prompt?: unknown; max_tokens: number } };
    expect(body.input.system_prompt).toBeUndefined();
    expect(body.input.max_tokens).toBe(4096);
  });

  it('openaiAdapter: omits system + uses defaults', async () => {
    mockFetch({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 0, completion_tokens: 0 } });
    await openaiAdapter.call({ prompt: 'hi', provider: 'openai', model: 'm' }, 'sk-x');
    const body = JSON.parse(lastCall!.init.body as string) as { messages: Array<{ role: string }>; max_tokens: number; temperature: number };
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
    expect(body.max_tokens).toBe(4096);
    expect(body.temperature).toBe(0.7);
  });

  it('perplexityAdapter: omits system + uses defaults', async () => {
    mockFetch({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 0, completion_tokens: 0 } });
    await perplexityAdapter.call({ prompt: 'hi', provider: 'perplexity', model: 'm' }, 'sk-p');
    const body = JSON.parse(lastCall!.init.body as string) as { messages: Array<{ role: string }> };
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });
});
