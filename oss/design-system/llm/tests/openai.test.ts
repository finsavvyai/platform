import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createOpenAIProvider } from '../src/providers/openai.js';

describe('OpenAI provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create OpenAI provider', () => {
    const provider = createOpenAIProvider('test-key');
    expect(provider).toBeDefined();
    expect(provider.name).toBe('openai');
  });

  it('should format OpenAI request correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const provider = createOpenAIProvider('test-key');
    const result = await provider.chat({
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
    });

    expect(result.content).toBe('response');
    expect(result.provider).toBe('openai');
  });

  it('should use default model gpt-4o', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const provider = createOpenAIProvider('test-key');
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.model).toBe('gpt-4o');
  });

  it('should support custom models', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'response' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const provider = createOpenAIProvider('test-key');
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'test' }],
      model: 'gpt-3.5-turbo',
    });

    expect(result.model).toBe('gpt-3.5-turbo');
  });

  it('should calculate cost for OpenAI models', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: 'response' } }],
        usage: { prompt_tokens: 1000, completion_tokens: 500 },
      }),
    });

    const provider = createOpenAIProvider('test-key');
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.cost).toBeGreaterThan(0);
  });

  it('should handle API errors', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const provider = createOpenAIProvider('bad-key');

    await expect(
      provider.chat({
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow('OpenAI API error');
  });

  it('should support JSON response format', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        choices: [{ message: { content: '{"result": "data"}' } }],
        usage: { prompt_tokens: 10, completion_tokens: 5 },
      }),
    });

    const provider = createOpenAIProvider('test-key');
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'test' }],
      responseFormat: 'json',
    });

    expect(result.content).toContain('result');
  });
});
