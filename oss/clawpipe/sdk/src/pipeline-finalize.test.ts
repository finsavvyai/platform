/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { initMeta, finalizeResult } from './pipeline-finalize';
import type { PipelineMeta, SavingsMeta } from './types';

function makeDeps(overrides: Partial<{
  costPerToken: number;
  auditLogs: unknown[];
  telemetryRecords: unknown[];
  budgetRemaining: number;
  rateLimitRemaining: number;
}> = {}) {
  const costPerToken = overrides.costPerToken ?? 0.001;
  const auditLogs: unknown[] = overrides.auditLogs ?? [];
  const telemetryRecords: unknown[] = overrides.telemetryRecords ?? [];

  return {
    telemetry: {
      estimateCost: (_provider: string, _model: string, tokensIn: number, tokensOut: number) =>
        (tokensIn + tokensOut) * costPerToken,
      record: (rec: unknown) => { telemetryRecords.push(rec); },
    },
    budget: {
      record: (_cost: number) => { /* no-op */ },
      status: () => ({ remainingUsd: overrides.budgetRemaining ?? 99 }),
    },
    rateLimiter: {
      record: () => { /* no-op */ },
      status: () => ({ remaining: overrides.rateLimitRemaining ?? 999 }),
    },
    audit: {
      log: (entry: unknown) => { auditLogs.push(entry); },
    },
    _auditLogs: auditLogs,
    _telemetryRecords: telemetryRecords,
  };
}

function makeMeta(overrides: Partial<PipelineMeta> = {}): PipelineMeta {
  return { ...initMeta(), ...overrides };
}

describe('initMeta', () => {
  it('returns default PipelineMeta shape', () => {
    const meta = initMeta();
    expect(meta.boosted).toBe(false);
    expect(meta.cached).toBe(false);
    expect(meta.packed).toBe(false);
    expect(meta.contextSavings).toBe('0%');
    expect(meta.route).toBe('');
    expect(meta.model).toBe('');
    expect(meta.latencyMs).toBe(0);
    expect(meta.tokensIn).toBe(0);
    expect(meta.tokensOut).toBe(0);
    expect(meta.estimatedCostUsd).toBe(0);
    expect(meta.budgetRemainingUsd).toBeNull();
    expect(meta.rateLimitRemaining).toBeNull();
    expect(meta.circuitBreakerState).toBe('closed');
  });
});

describe('finalizeResult', () => {
  it('sets latencyMs from start', () => {
    const deps = makeDeps();
    const start = Date.now() - 150;
    const meta = makeMeta({ route: 'openai', model: 'gpt-4', tokensIn: 10, tokensOut: 20 });
    const result = finalizeResult(deps, 'hello', meta, start, 'prompt', false, null);
    expect(result.meta.latencyMs).toBeGreaterThanOrEqual(150);
  });

  it('sets estimatedCostUsd for non-boosted non-cached call', () => {
    const deps = makeDeps({ costPerToken: 0.01 });
    const meta = makeMeta({ route: 'openai', model: 'gpt-4', tokensIn: 5, tokensOut: 5 });
    finalizeResult(deps, 'text', meta, Date.now(), 'input', false, null);
    // 10 tokens * 0.01 = 0.1
    expect(meta.estimatedCostUsd).toBeCloseTo(0.1);
  });

  it('sets estimatedCostUsd to 0 for boosted calls', () => {
    const deps = makeDeps({ costPerToken: 0.01 });
    const meta = makeMeta({ route: 'openai', model: 'gpt-4', tokensIn: 100, tokensOut: 100 });
    finalizeResult(deps, 'text', meta, Date.now(), 'input', true, null);
    expect(meta.estimatedCostUsd).toBe(0);
  });

  it('sets estimatedCostUsd to 0 for cached calls', () => {
    const deps = makeDeps({ costPerToken: 0.01 });
    const meta = makeMeta({ route: 'openai', model: 'gpt-4', tokensIn: 100, tokensOut: 100, cached: true });
    finalizeResult(deps, 'text', meta, Date.now(), 'input', false, null);
    expect(meta.estimatedCostUsd).toBe(0);
  });

  it('records telemetry', () => {
    const deps = makeDeps();
    const meta = makeMeta({ route: 'anthropic', model: 'claude', tokensIn: 10, tokensOut: 5 });
    finalizeResult(deps, 'hi', meta, Date.now(), 'in', false, null);
    expect(deps._telemetryRecords).toHaveLength(1);
    const rec = deps._telemetryRecords[0] as { provider: string; model: string };
    expect(rec.provider).toBe('anthropic');
    expect(rec.model).toBe('claude');
  });

  it('logs audit entry', () => {
    const deps = makeDeps();
    const meta = makeMeta({ route: 'openai', model: 'gpt-4', tokensIn: 10, tokensOut: 20 });
    finalizeResult(deps, 'result', meta, Date.now(), 'some prompt', false, null);
    expect(deps._auditLogs).toHaveLength(1);
    const entry = deps._auditLogs[0] as { action: string; promptHash: string };
    expect(entry.action).toBe('prompt');
    expect(typeof entry.promptHash).toBe('string');
    expect(entry.promptHash.length).toBeGreaterThan(0);
  });

  it('sets budgetRemainingUsd and rateLimitRemaining from status', () => {
    const deps = makeDeps({ budgetRemaining: 42.5, rateLimitRemaining: 321 });
    const meta = makeMeta();
    finalizeResult(deps, 'r', meta, Date.now(), 'i', false, null);
    expect(meta.budgetRemainingUsd).toBe(42.5);
    expect(meta.rateLimitRemaining).toBe(321);
  });

  it('attaches savings meta when provided', () => {
    const deps = makeDeps();
    const savings: SavingsMeta = { thisMonth: 10, sinceStart: 100, percent: 30, currency: 'USD' };
    const meta = makeMeta();
    finalizeResult(deps, 'r', meta, Date.now(), 'i', false, savings);
    expect(meta.savings).toEqual(savings);
  });

  it('returns result with text', () => {
    const deps = makeDeps();
    const meta = makeMeta();
    const result = finalizeResult(deps, 'the response', meta, Date.now(), 'i', false, null);
    expect(result.text).toBe('the response');
  });

  it('includes trace when tracer is enabled', () => {
    const deps = makeDeps();
    const meta = makeMeta();
    const tracer = {
      isEnabled: () => true,
      format: () => 'trace-output',
    };
    const result = finalizeResult(deps, 'r', meta, Date.now(), 'i', false, null, tracer as never);
    expect(result.trace).toBe('trace-output');
  });

  it('omits trace when tracer is disabled', () => {
    const deps = makeDeps();
    const meta = makeMeta();
    const tracer = {
      isEnabled: () => false,
      format: () => 'trace-output',
    };
    const result = finalizeResult(deps, 'r', meta, Date.now(), 'i', false, null, tracer as never);
    expect(result.trace).toBeUndefined();
  });

  it('omits trace when tracer is not provided', () => {
    const deps = makeDeps();
    const meta = makeMeta();
    const result = finalizeResult(deps, 'r', meta, Date.now(), 'i', false, null);
    expect(result.trace).toBeUndefined();
  });
});
