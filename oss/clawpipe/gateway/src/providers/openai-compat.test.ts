/** @vitest-environment node */
/**
 * OpenAI-compatible provider adapters (groq, mistral, together, fireworks,
 * openrouter, perplexity, cerebras, ai21, writer, databricks, deepseek,
 * azure-openai, xai) all share the same wire shape:
 *
 *   POST {url} {Authorization: Bearer <key>, Content-Type: application/json}
 *   body: {model, messages, max_tokens, temperature}
 *   resp: {choices: [{message: {content}}], usage: {prompt_tokens, completion_tokens}}
 *
 * One mock-fetch test per adapter — catches regressions if upstream
 * adapter logic drifts.
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { groqAdapter } from './groq';
import { mistralAdapter } from './mistral';
import { togetherAdapter } from './together';
import { fireworksAdapter } from './fireworks';
import { openrouterAdapter } from './openrouter';
import { cerebrasAdapter } from './cerebras';
import { ai21Adapter } from './ai21';
import { writerAdapter } from './writer';
import { databricksAdapter } from './databricks';
import { deepseekAdapter } from './deepseek';
import { azureOpenaiAdapter } from './azure-openai';
import { xaiAdapter } from './xai';
// azure-openai uses a different key format and url scheme — covered separately.
import type { ProviderAdapter, PromptRequest } from '../types';

const ADAPTERS: Array<{ name: string; adapter: ProviderAdapter; expectedHostFragment: string }> = [
  { name: 'groq',          adapter: groqAdapter,         expectedHostFragment: 'groq.com' },
  { name: 'mistral',       adapter: mistralAdapter,      expectedHostFragment: 'mistral.ai' },
  { name: 'together',      adapter: togetherAdapter,     expectedHostFragment: 'together.xyz' },
  { name: 'fireworks',     adapter: fireworksAdapter,    expectedHostFragment: 'fireworks.ai' },
  { name: 'openrouter',    adapter: openrouterAdapter,   expectedHostFragment: 'openrouter.ai' },
  { name: 'cerebras',      adapter: cerebrasAdapter,     expectedHostFragment: 'cerebras' },
  { name: 'ai21',          adapter: ai21Adapter,         expectedHostFragment: 'ai21' },
  { name: 'writer',        adapter: writerAdapter,       expectedHostFragment: 'writer' },
  { name: 'deepseek',      adapter: deepseekAdapter,     expectedHostFragment: 'deepseek' },
  // Databricks split out — uses HOST|TOKEN key format like azure-openai.
  { name: 'xai',           adapter: xaiAdapter,          expectedHostFragment: 'x.ai' },
];

const AZURE_KEY = 'https://r1.openai.azure.com|2024-02-15-preview|sk-azure';

let lastCall: { url: string; init: RequestInit } | null = null;
const ORIGINAL_FETCH = globalThis.fetch;

function mockFetch(body: object, status: number = 200) {
  globalThis.fetch = (async (url: RequestInfo | URL, init?: RequestInit) => {
    lastCall = { url: String(url), init: init ?? {} };
    return new Response(JSON.stringify(body), { status });
  }) as typeof fetch;
}

describe('OpenAI-compatible adapters', () => {
  beforeEach(() => { lastCall = null; });
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

  const baseReq: PromptRequest = {
    prompt: 'hi', provider: 'x', model: 'm-1',
    maxTokens: 100, temperature: 0.5,
  };

  it.each(ADAPTERS)('$name: parses choices + usage and computes latencyMs', async ({ adapter, expectedHostFragment }) => {
    mockFetch({
      choices: [{ message: { content: 'pong' } }],
      usage: { prompt_tokens: 11, completion_tokens: 3 },
    });
    const res = await adapter.call(baseReq, 'sk-test');
    expect(res.text).toBe('pong');
    expect(res.tokensIn).toBe(11);
    expect(res.tokensOut).toBe(3);
    expect(res.latencyMs).toBeGreaterThanOrEqual(0);
    expect(lastCall!.url).toContain(expectedHostFragment);
  });

  it.each(ADAPTERS)('$name: throws on non-2xx', async ({ adapter }) => {
    mockFetch({ error: 'rate limited' }, 429);
    await expect(adapter.call(baseReq, 'sk-test')).rejects.toThrow();
  });

  it.each(ADAPTERS)('$name: includes Authorization Bearer header', async ({ adapter }) => {
    mockFetch({ choices: [{ message: { content: '' } }], usage: { prompt_tokens: 0, completion_tokens: 0 } });
    await adapter.call(baseReq, 'sk-test');
    const headers = lastCall!.init.headers as Record<string, string>;
    expect(headers['Authorization']).toContain('sk-test');
  });

  it.each(ADAPTERS)('$name: defaults missing tokens fields to 0', async ({ adapter }) => {
    mockFetch({ choices: [{ message: { content: 'ok' } }] });
    const res = await adapter.call(baseReq, 'sk-test');
    expect(res.tokensIn).toBe(0);
    expect(res.tokensOut).toBe(0);
    expect(res.text).toBe('ok');
  });

  it.each(ADAPTERS)('$name: returns empty text when choices missing', async ({ adapter }) => {
    mockFetch({ choices: [], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    const res = await adapter.call(baseReq, 'sk-test');
    expect(res.text).toBe('');
  });

  it.each(ADAPTERS)('$name: omits system message when not provided', async ({ adapter }) => {
    mockFetch({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 1, completion_tokens: 1 } });
    await adapter.call({ ...baseReq, system: undefined }, 'sk-test');
    const body = JSON.parse(lastCall!.init.body as string) as { messages: Array<{ role: string }> };
    expect(body.messages).toEqual([{ role: 'user', content: baseReq.prompt }]);
  });
});

describe('azure-openai adapter (custom key format)', () => {
  beforeEach(() => { lastCall = null; });
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

  it('parses ENDPOINT|API_VERSION|KEY and uses api-key header', async () => {
    mockFetch({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } });
    const res = await azureOpenaiAdapter.call(
      { prompt: 'hi', provider: 'azure-openai', model: 'gpt-4o', maxTokens: 50, temperature: 0.5 },
      AZURE_KEY,
    );
    expect(res.text).toBe('ok');
    expect(lastCall!.url).toContain('https://r1.openai.azure.com/openai/deployments/gpt-4o/chat/completions');
    expect(lastCall!.url).toContain('api-version=2024-02-15-preview');
    const headers = lastCall!.init.headers as Record<string, string>;
    expect(headers['api-key']).toBe('sk-azure');
  });

  it('throws when key is not in ENDPOINT|VERSION|KEY shape', async () => {
    await expect(azureOpenaiAdapter.call(
      { prompt: 'x', provider: 'azure-openai', model: 'm' },
      'just-a-key',
    )).rejects.toThrow(/expected ENDPOINT/);
  });

  it('throws on non-2xx upstream', async () => {
    mockFetch({}, 503);
    await expect(azureOpenaiAdapter.call(
      { prompt: 'hi', provider: 'azure-openai', model: 'm' }, AZURE_KEY,
    )).rejects.toThrow(/Azure OpenAI 503/);
  });

  it('omits system message when not provided', async () => {
    mockFetch({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 0, completion_tokens: 0 } });
    await azureOpenaiAdapter.call({ prompt: 'hi', provider: 'azure-openai', model: 'm' }, AZURE_KEY);
    const body = JSON.parse(lastCall!.init.body as string) as { messages: Array<{ role: string }> };
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });
});

describe('databricks adapter (HOST|TOKEN format)', () => {
  beforeEach(() => { lastCall = null; });
  afterEach(() => { globalThis.fetch = ORIGINAL_FETCH; });

  it('parses HOST|TOKEN and posts to /serving-endpoints/{model}/invocations', async () => {
    mockFetch({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 5, completion_tokens: 2 } });
    const res = await databricksAdapter.call(
      { prompt: 'hi', provider: 'databricks', model: 'gpt-oss', maxTokens: 50, temperature: 0.5 },
      'https://ws.cloud.databricks.com|dapi-token',
    );
    expect(res.text).toBe('ok');
    expect(lastCall!.url).toBe('https://ws.cloud.databricks.com/serving-endpoints/gpt-oss/invocations');
    const headers = lastCall!.init.headers as Record<string, string>;
    expect(headers['Authorization']).toBe('Bearer dapi-token');
  });

  it('throws when key has no host', async () => {
    await expect(databricksAdapter.call(
      { prompt: 'x', provider: 'databricks', model: 'm' },
      'plain-token-no-host',
    )).rejects.toThrow(/missing workspace host/);
  });

  it('throws on non-2xx upstream', async () => {
    mockFetch({}, 502);
    await expect(databricksAdapter.call(
      { prompt: 'hi', provider: 'databricks', model: 'm' },
      'https://ws.cloud.databricks.com|dapi-token',
    )).rejects.toThrow(/Databricks 502/);
  });

  it('omits system message when not provided', async () => {
    mockFetch({ choices: [{ message: { content: 'ok' } }], usage: { prompt_tokens: 0, completion_tokens: 0 } });
    await databricksAdapter.call(
      { prompt: 'hi', provider: 'databricks', model: 'm' },
      'https://ws.cloud.databricks.com|dapi-token',
    );
    const body = JSON.parse(lastCall!.init.body as string) as { messages: Array<{ role: string }> };
    expect(body.messages).toEqual([{ role: 'user', content: 'hi' }]);
  });
});
