import { describe, it, expect } from 'vitest';
import {
  computeAgentScore,
  computeCspmScore,
  computeCombinedRiskScore,
  type AgentSummary,
  type CspmSummary,
} from './combined-risk-score.js';

function makeAgent(overrides?: Partial<AgentSummary>): AgentSummary {
  return { total: 0, critical: 0, high: 0, medium: 0, low: 0, secretsDetected: 0, ...overrides };
}

function makeCspm(overrides?: Partial<CspmSummary>): CspmSummary {
  return { critical: 0, high: 0, medium: 0, low: 0, ...overrides };
}

describe('computeAgentScore', () => {
  it('returns 100 for zero issues', () => {
    expect(computeAgentScore(makeAgent())).toBe(100);
  });

  it('deducts 20 per critical', () => {
    expect(computeAgentScore(makeAgent({ critical: 1 }))).toBe(80);
  });

  it('deducts 8 per high', () => {
    expect(computeAgentScore(makeAgent({ high: 2 }))).toBe(84);
  });

  it('deducts 2 per medium', () => {
    expect(computeAgentScore(makeAgent({ medium: 5 }))).toBe(90);
  });

  it('deducts 5 per secret detected', () => {
    expect(computeAgentScore(makeAgent({ secretsDetected: 3 }))).toBe(85);
  });

  it('accumulates multiple severity deductions', () => {
    const score = computeAgentScore(makeAgent({
      critical: 2, high: 3, medium: 4, secretsDetected: 1,
    }));
    // 100 - 40 - 24 - 8 - 5 = 23
    expect(score).toBe(23);
  });

  it('floors at 0 for extreme issues', () => {
    expect(computeAgentScore(makeAgent({ critical: 10 }))).toBe(0);
  });

  it('floors at 0 for large combined deductions', () => {
    const score = computeAgentScore(makeAgent({
      critical: 5, high: 10, medium: 50, secretsDetected: 20,
    }));
    expect(score).toBe(0);
  });
});

describe('computeCspmScore', () => {
  it('returns 100 for zero findings', () => {
    expect(computeCspmScore(makeCspm())).toBe(100);
  });

  it('deducts 15 per critical', () => {
    expect(computeCspmScore(makeCspm({ critical: 2 }))).toBe(70);
  });

  it('deducts 5 per high', () => {
    expect(computeCspmScore(makeCspm({ high: 3 }))).toBe(85);
  });

  it('deducts 1 per medium', () => {
    expect(computeCspmScore(makeCspm({ medium: 10 }))).toBe(90);
  });

  it('does not deduct for low severity', () => {
    expect(computeCspmScore(makeCspm({ low: 100 }))).toBe(100);
  });

  it('accumulates multiple severities', () => {
    // 100 - 15 - 10 - 5 = 70
    expect(computeCspmScore(makeCspm({ critical: 1, high: 2, medium: 5 }))).toBe(70);
  });

  it('floors at 0 for extreme findings', () => {
    expect(computeCspmScore(makeCspm({ critical: 10 }))).toBe(0);
  });
});

describe('computeCombinedRiskScore', () => {
  it('uses 60/40 weighted average', () => {
    const result = computeCombinedRiskScore(makeAgent(), makeCspm());
    // Both 100 => 100*0.6 + 100*0.4 = 100
    expect(result.agentScore).toBe(100);
    expect(result.cspmScore).toBe(100);
    expect(result.combined).toBe(100);
  });

  it('rounds the combined score', () => {
    // agent=80, cspm=85 => 80*0.6 + 85*0.4 = 48+34 = 82
    const result = computeCombinedRiskScore(
      makeAgent({ critical: 1 }),
      makeCspm({ critical: 1 }),
    );
    expect(result.agentScore).toBe(80);
    expect(result.cspmScore).toBe(85);
    expect(result.combined).toBe(82);
  });

  it('assigns grade A for score >= 90', () => {
    const result = computeCombinedRiskScore(makeAgent(), makeCspm());
    expect(result.grade).toBe('A');
  });

  it('assigns grade B for score 70-89', () => {
    // agent=80 (1 crit), cspm=85 (1 crit) => combined=82 => B
    const result = computeCombinedRiskScore(
      makeAgent({ critical: 1 }),
      makeCspm({ critical: 1 }),
    );
    expect(result.grade).toBe('B');
  });

  it('assigns grade C for score 50-69', () => {
    // agent=52 (1crit+2high+2med), cspm=70 (1crit+2high) => 52*0.6+70*0.4 = 31.2+28 = 59
    const result = computeCombinedRiskScore(
      makeAgent({ critical: 1, high: 2, medium: 2 }),
      makeCspm({ critical: 1, high: 2 }),
    );
    expect(result.combined).toBeGreaterThanOrEqual(50);
    expect(result.combined).toBeLessThan(70);
    expect(result.grade).toBe('C');
  });

  it('assigns grade D for score 30-49', () => {
    // agent=0 (5crit), cspm=85 (1crit) => 0*0.6+85*0.4 = 34 => D
    const result = computeCombinedRiskScore(
      makeAgent({ critical: 5 }),
      makeCspm({ critical: 1 }),
    );
    expect(result.combined).toBeGreaterThanOrEqual(30);
    expect(result.combined).toBeLessThan(50);
    expect(result.grade).toBe('D');
  });

  it('assigns grade F for score < 30', () => {
    const result = computeCombinedRiskScore(
      makeAgent({ critical: 5, high: 5, secretsDetected: 10 }),
      makeCspm({ critical: 7 }),
    );
    expect(result.combined).toBeLessThan(30);
    expect(result.grade).toBe('F');
  });

  it('returns score 100 and grade A when both have zero issues', () => {
    const result = computeCombinedRiskScore(makeAgent(), makeCspm());
    expect(result.combined).toBe(100);
    expect(result.grade).toBe('A');
  });

  it('returns score 0 and grade F for catastrophic issues', () => {
    const result = computeCombinedRiskScore(
      makeAgent({ critical: 10, high: 10, secretsDetected: 20 }),
      makeCspm({ critical: 10, high: 10 }),
    );
    expect(result.combined).toBe(0);
    expect(result.grade).toBe('F');
  });
});
