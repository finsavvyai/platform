import { describe, it, expect, vi } from 'vitest';
import { createLLM } from '../src/client.js';
import type { LLMProvider, ChatResponse } from '../src/types.js';

describe('LLM client', () => {
  it('should create LLM client with providers', () => {
    const mockProvider: LLMProvider = {
      name: 'mock',
      chat: vi.fn(),
      stream: vi.fn(),
    };

    const client = createLLM({ providers: [mockProvider] });
    expect(client).toBeDefined();
    expect(client.chat).toBeDefined();
    expect(client.stream).toBeDefined();
  });

  it('should use first provider on successful call', async () => {
    const response: ChatResponse = {
      content: 'response',
      model: 'test',
      provider: 'provider1',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cost: 0.001,
      latencyMs: 100,
    };

    const provider1: LLMProvider = {
      name: 'provider1',
      chat: vi.fn().mockResolvedValue(response),
      stream: vi.fn(),
    };

    const client = createLLM({ providers: [provider1] });
    const result = await client.chat({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.provider).toBe('provider1');
    expect(result.content).toBe('response');
  });

  it('should fallback to next provider on error', async () => {
    const response: ChatResponse = {
      content: 'fallback response',
      model: 'test',
      provider: 'provider2',
      usage: { promptTokens: 10, completionTokens: 5, totalTokens: 15 },
      cost: 0.001,
      latencyMs: 100,
    };

    const provider1: LLMProvider = {
      name: 'provider1',
      chat: vi.fn().mockRejectedValue(new Error('Provider 1 failed')),
      stream: vi.fn(),
    };

    const provider2: LLMProvider = {
      name: 'provider2',
      chat: vi.fn().mockResolvedValue(response),
      stream: vi.fn(),
    };

    const client = createLLM({ providers: [provider1, provider2] });
    const result = await client.chat({
      messages: [{ role: 'user', content: 'test' }],
    });

    expect(result.provider).toBe('provider2');
  });

  it('should track costs per request', async () => {
    const response: ChatResponse = {
      content: 'response',
      model: 'gpt-4o',
      provider: 'openai',
      usage: { promptTokens: 100, completionTokens: 50, totalTokens: 150 },
      cost: 0.005,
      latencyMs: 100,
    };

    const provider: LLMProvider = {
      name: 'openai',
      chat: vi.fn().mockResolvedValue(response),
      stream: vi.fn(),
    };

    const client = createLLM({ providers: [provider], defaultModel: 'gpt-4o' });
    await client.chat({
      messages: [{ role: 'user', content: 'test' }],
    });

    const tracker = client.getCostTracker();
    expect(tracker.getTotalCost()).toBeGreaterThan(0);
  });

  it('should throw error if all providers fail', async () => {
    const provider1: LLMProvider = {
      name: 'provider1',
      chat: vi.fn().mockRejectedValue(new Error('Failed')),
      stream: vi.fn(),
    };

    const provider2: LLMProvider = {
      name: 'provider2',
      chat: vi.fn().mockRejectedValue(new Error('Failed')),
      stream: vi.fn(),
    };

    const client = createLLM({ providers: [provider1, provider2] });

    await expect(
      client.chat({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow();
  });

  it('should respect timeout setting', async () => {
    const provider: LLMProvider = {
      name: 'slow',
      chat: vi.fn(
        () =>
          new Promise((resolve) => {
            setTimeout(resolve, 5000);
          })
      ),
      stream: vi.fn(),
    };

    const client = createLLM({ providers: [provider], timeout: 100 });

    await expect(
      client.chat({ messages: [{ role: 'user', content: 'test' }] })
    ).rejects.toThrow();
  });

  it('should support streaming', async () => {
    const chunks = [
      { type: 'start' as const, model: 'test', provider: 'test' },
      { type: 'delta' as const, content: 'Hello' },
      { type: 'delta' as const, content: ' world' },
      { type: 'end' as const },
    ];

    const provider: LLMProvider = {
      name: 'test',
      chat: vi.fn(),
      stream: async function* () {
        for (const chunk of chunks) {
          yield chunk;
        }
      },
    };

    const client = createLLM({ providers: [provider] });
    const collected = [];

    for await (const chunk of client.stream({
      messages: [{ role: 'user', content: 'test' }],
    })) {
      collected.push(chunk);
    }

    expect(collected).toHaveLength(4);
  });
});
