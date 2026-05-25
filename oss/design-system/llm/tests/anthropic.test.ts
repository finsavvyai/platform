import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createAnthropicProvider } from '../src/providers/anthropic.js';

describe('Anthropic provider', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should create Anthropic provider', () => {
    const provider = createAnthropicProvider('test-key');
    expect(provider).toBeDefined();
    expect(provider.name).toBe('anthropic');
  });

  it('should have chat and stream methods', () => {
    const provider = createAnthropicProvider('test-key');
    expect(provider.chat).toBeDefined();
    expect(provider.stream).toBeDefined();
  });

  it('should format messages correctly', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });

    const provider = createAnthropicProvider('test-key');
    const result = await provider.chat({
      messages: [
        { role: 'system', content: 'You are helpful' },
        { role: 'user', content: 'Hello' },
      ],
    });

    expect(result.content).toBe('response');
    expect(result.provider).toBe('anthropic');
  });

  it('should use default model', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });

    const provider = createAnthropicProvider('test-key');
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.model).toBe('claude-sonnet-4-20250514');
  });

  it('should calculate cost based on pricing', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'response' }],
        usage: { input_tokens: 1000, output_tokens: 500 },
      }),
    });

    const provider = createAnthropicProvider('test-key');
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.cost).toBeGreaterThan(0);
    expect(result.usage.totalTokens).toBe(1500);
  });

  it('should throw on API error', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 401,
      statusText: 'Unauthorized',
    });

    const provider = createAnthropicProvider('bad-key');

    await expect(
      provider.chat({
        messages: [{ role: 'user', content: 'test' }],
      })
    ).rejects.toThrow('Anthropic API error');
  });

  it('should measure latency', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        content: [{ type: 'text', text: 'response' }],
        usage: { input_tokens: 10, output_tokens: 5 },
      }),
    });

    const provider = createAnthropicProvider('test-key');
    const result = await provider.chat({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.latencyMs).toBeGreaterThanOrEqual(0);
  });
});
