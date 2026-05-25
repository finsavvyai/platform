/**
 * Swarm service tests — parallel execution strategies.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before import
vi.mock('../packages/api/src/services/llm-caller', () => ({
  callLLM: vi.fn(),
}));
vi.mock('../packages/api/src/services/smart-router', () => ({
  recordOutcome: vi.fn(),
}));
vi.mock('../packages/api/src/services/agent-config', () => ({
  resolveLLMConfig: vi.fn(() => ({
    provider: 'anthropic',
    model: 'claude-sonnet',
    apiKey: 'test-key',
  })),
}));
vi.mock('../packages/api/src/data/personas', () => ({
  getPersona: vi.fn((slug: string) => ({
    slug,
    name: `Test ${slug}`,
    systemPrompt: `You are ${slug}`,
    temperature: 0.3,
    model: 'claude-sonnet',
  })),
}));

import { runSwarm } from '../packages/api/src/services/swarm';
import { callLLM } from '../packages/api/src/services/llm-caller';

const mockEnv = {} as any;

function mockSuccess(text: string, ms = 100) {
  return new Response(text, { status: 200 });
}

describe('runSwarm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('rejects fewer than 2 agents', async () => {
    await expect(
      runSwarm(mockEnv, { agents: ['code-review'], context: 'test', strategy: 'race' }),
    ).rejects.toThrow(/at least 2/);
  });

  it('rejects more than 5 agents', async () => {
    await expect(
      runSwarm(mockEnv, {
        agents: ['a', 'b', 'c', 'd', 'e', 'f'],
        context: 'test',
        strategy: 'race',
      }),
    ).rejects.toThrow(/max 5/);
  });

  it('rejects duplicate agents', async () => {
    await expect(
      runSwarm(mockEnv, {
        agents: ['code-review', 'code-review'],
        context: 'test',
        strategy: 'race',
      }),
    ).rejects.toThrow(/unique/);
  });

  it('rejects unknown strategy', async () => {
    await expect(
      runSwarm(mockEnv, {
        agents: ['a', 'b'],
        context: 'test',
        strategy: 'invalid' as any,
      }),
    ).rejects.toThrow(/strategy/);
  });

  it('race strategy picks fastest successful agent', async () => {
    vi.mocked(callLLM).mockResolvedValueOnce(mockSuccess('fast result'));
    vi.mocked(callLLM).mockResolvedValueOnce(mockSuccess('slow result'));

    const result = await runSwarm(mockEnv, {
      agents: ['agent-a', 'agent-b'],
      context: 'test',
      strategy: 'race',
    });

    expect(result.strategy).toBe('race');
    expect(result.winner).not.toBeNull();
    expect(result.allResults).toHaveLength(2);
    expect(result.reason).toMatch(/fastest/);
  });

  it('consensus strategy picks majority agreement', async () => {
    // Use mockImplementation so each call returns a fresh Response
    vi.mocked(callLLM).mockImplementation(async () =>
      new Response('same answer here', { status: 200 }),
    );

    const result = await runSwarm(mockEnv, {
      agents: ['a', 'b', 'c'],
      context: 'test',
      strategy: 'consensus',
    });

    expect(result.winner).not.toBeNull();
    expect(result.reason).toMatch(/consensus: 3\/3/);
  });

  it('vote strategy picks longest output', async () => {
    vi.mocked(callLLM).mockResolvedValueOnce(mockSuccess('short'));
    vi.mocked(callLLM).mockResolvedValueOnce(mockSuccess('this is a much longer answer with more detail'));

    const result = await runSwarm(mockEnv, {
      agents: ['a', 'b'],
      context: 'test',
      strategy: 'vote',
    });

    expect(result.winner?.output).toMatch(/longer answer/);
    expect(result.reason).toMatch(/longest output/);
  });

  it('returns null winner when all agents fail', async () => {
    vi.mocked(callLLM).mockImplementation(async () =>
      new Response('error', { status: 500 }),
    );

    const result = await runSwarm(mockEnv, {
      agents: ['a', 'b'],
      context: 'test',
      strategy: 'race',
    });

    expect(result.winner).toBeNull();
    expect(result.reason).toMatch(/all agents failed/);
    expect(result.allResults.every((r) => !r.success)).toBe(true);
  });

  it('records total duration', async () => {
    vi.mocked(callLLM).mockImplementation(async () => new Response('ok', { status: 200 }));

    const result = await runSwarm(mockEnv, {
      agents: ['a', 'b'],
      context: 'test',
      strategy: 'race',
    });

    expect(result.totalDurationMs).toBeGreaterThanOrEqual(0);
  });
});
