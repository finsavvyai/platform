/**
 * Multi-Model Consensus Triage Tests
 */
import { describe, it, expect, vi } from 'vitest';
import { consensusTriage } from './multi-model-consensus.js';

interface AiCaller { call: (model: string, prompt: string) => Promise<string> }

const FINDING = {
  title: 'IAM Role Overpermissioned',
  description: 'Role has AdministratorAccess on EC2.',
  severity: 'high',
  category: 'iam',
};

function vote(severity: string, priority: string, confidence: number) {
  return JSON.stringify({ severity, priority, confidence, reasoning: 'r' });
}

function makeAi(responses: Record<string, string>): AiCaller {
  return {
    call: vi.fn(async (model: string) => {
      if (model in responses) return responses[model]!;
      throw new Error(`unexpected model: ${model}`);
    }),
  };
}

describe('consensusTriage — all models agree', () => {
  it('returns agreed severity with agreement = 1 and all votes', async () => {
    const json = vote('critical', 'P0', 0.9);
    const ai = makeAi({ haiku: json, 'gpt-4o-mini': json, 'llama-70b': json });
    const result = await consensusTriage(FINDING, ai);
    expect(result.severity).toBe('critical');
    expect(result.agreement).toBe(1);
    expect(result.votes).toHaveLength(3);
    expect(result.confidence).toBeCloseTo(0.9);
  });
});

describe('consensusTriage — models disagree (majority wins)', () => {
  it('selects severity with highest confidence-weighted sum', async () => {
    const ai = makeAi({
      haiku: vote('critical', 'P0', 0.9),
      'gpt-4o-mini': vote('critical', 'P0', 0.85),
      'llama-70b': vote('high', 'P1', 0.8),
    });
    const result = await consensusTriage(FINDING, ai);
    // critical: 1.75 vs high: 0.8
    expect(result.severity).toBe('critical');
    expect(result.agreement).toBeCloseTo(2 / 3);
  });

  it('single high-confidence vote can beat two low-confidence votes', async () => {
    const ai = makeAi({
      haiku: vote('critical', 'P0', 0.95),
      'gpt-4o-mini': vote('medium', 'P2', 0.3),
      'llama-70b': vote('medium', 'P2', 0.3),
    });
    const result = await consensusTriage(FINDING, ai);
    // critical: 0.95 vs medium: 0.6
    expect(result.severity).toBe('critical');
  });

  it('picks winning priority from agreeing models', async () => {
    const ai = makeAi({
      haiku: vote('high', 'P1', 0.8),
      'gpt-4o-mini': vote('high', 'P1', 0.75),
      'llama-70b': vote('medium', 'P2', 0.6),
    });
    const result = await consensusTriage(FINDING, ai);
    expect(result.severity).toBe('high');
    expect(result.priority).toBe('P1');
  });
});

describe('consensusTriage — graceful degradation', () => {
  it('uses remaining successful votes when one model throws', async () => {
    const ai: AiCaller = {
      call: vi.fn(async (model: string) => {
        if (model === 'haiku') throw new Error('unavailable');
        return vote('high', 'P1', 0.8);
      }),
    };
    const result = await consensusTriage(FINDING, ai);
    expect(result.severity).toBe('high');
    expect(result.votes).toHaveLength(2);
  });

  it('uses parse-error fallback vote (medium/P2) when model returns non-JSON', async () => {
    const ai = makeAi({
      haiku: 'not json at all',
      'gpt-4o-mini': vote('critical', 'P0', 0.9),
      'llama-70b': vote('critical', 'P0', 0.85),
    });
    const result = await consensusTriage(FINDING, ai);
    // critical: 1.75 vs medium: 0.3 — critical wins
    expect(result.severity).toBe('critical');
  });

  it('falls back to original severity with confidence 0 when all models fail', async () => {
    const ai: AiCaller = {
      call: vi.fn(async () => { throw new Error('down'); }),
    };
    const result = await consensusTriage(FINDING, ai, ['haiku', 'gpt-4o-mini', 'llama-70b']);
    expect(result.severity).toBe(FINDING.severity);
    expect(result.confidence).toBe(0);
    expect(result.agreement).toBe(0);
    expect(result.votes).toHaveLength(0);
    expect(result.priority).toBe('P2');
  });

  it('returns fallback for empty models array', async () => {
    const result = await consensusTriage(FINDING, makeAi({}), []);
    expect(result.severity).toBe(FINDING.severity);
    expect(result.confidence).toBe(0);
  });
});

describe('consensusTriage — weighted confidence voting', () => {
  it('confidence equals average confidence of agreeing voters', async () => {
    const ai = makeAi({
      haiku: vote('critical', 'P0', 0.9),
      'gpt-4o-mini': vote('critical', 'P0', 0.7),
      'llama-70b': vote('medium', 'P2', 0.5),
    });
    const result = await consensusTriage(FINDING, ai);
    expect(result.confidence).toBeCloseTo(0.8); // (0.9 + 0.7) / 2
  });

  it('clamps out-of-range confidence values to [0, 1]', async () => {
    const ai = makeAi({
      haiku: vote('high', 'P1', 1.5),
      'gpt-4o-mini': vote('high', 'P1', -0.2),
      'llama-70b': vote('high', 'P1', 0.8),
    });
    const result = await consensusTriage(FINDING, ai);
    expect(result.confidence).toBeGreaterThanOrEqual(0);
    expect(result.confidence).toBeLessThanOrEqual(1);
  });

  it('includes all votes regardless of severity and uses custom models', async () => {
    const ai = makeAi({
      'my-model': vote('info', 'P4', 0.6),
    });
    const result = await consensusTriage(FINDING, ai, ['my-model']);
    expect(result.votes).toHaveLength(1);
    expect(result.votes[0]!.model).toBe('my-model');
    expect(result.severity).toBe('info');
  });
});
