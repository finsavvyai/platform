import { describe, it, expect, vi } from 'vitest';
import { resolveCustomAgent } from './custom-agent-resolver';

function createMockDB(row: any) {
  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        first: vi.fn().mockResolvedValue(row),
      }),
    }),
  } as unknown as D1Database;
}

describe('resolveCustomAgent', () => {
  it('returns null when no agent found', async () => {
    const db = createMockDB(null);
    const result = await resolveCustomAgent(db, 'user-1', 'missing-agent');
    expect(result).toBeNull();
  });

  it('resolves a custom agent with single variant', async () => {
    const db = createMockDB({
      slug: 'my-agent',
      name: 'My Agent',
      system_prompt: 'You are a helpful bot',
      model: 'gpt-4o',
      temperature: 0.5,
    });

    const result = await resolveCustomAgent(db, 'user-1', 'my-agent');
    expect(result).not.toBeNull();
    expect(result!.slug).toBe('my-agent');
    expect(result!.name).toBe('My Agent');
    expect(result!.systemPrompt).toBe('You are a helpful bot');
    expect(result!.variantId).toBe('v1');
    expect(result!.model).toBe('gpt-4o');
    expect(result!.temperature).toBe(0.5);
  });

  it('resolves agent with JSON prompt variants', async () => {
    const variants = JSON.stringify([
      { id: 'a', content: 'Prompt A', weight: 100 },
      { id: 'b', content: 'Prompt B', weight: 0 },
    ]);
    const db = createMockDB({
      slug: 'ab-agent',
      name: 'AB Agent',
      system_prompt: variants,
      model: null,
      temperature: null,
    });

    const result = await resolveCustomAgent(db, 'user-1', 'ab-agent');
    expect(result).not.toBeNull();
    expect(result!.systemPrompt).toBe('Prompt A');
    expect(result!.variantId).toBe('a');
  });

  it('handles DB errors gracefully', async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnValue({
          first: vi.fn().mockRejectedValue(new Error('DB down')),
        }),
      }),
    } as unknown as D1Database;

    const result = await resolveCustomAgent(db, 'user-1', 'agent');
    expect(result).toBeNull();
  });
});
