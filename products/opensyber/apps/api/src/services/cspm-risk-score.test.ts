/**
 * CSPM Risk Score Tests
 */
import { describe, it, expect } from 'vitest';
import { calculateAccountRiskScore, calculateOrgRiskScore } from './cspm-risk-score.js';

function createMockDb(findings: { severity: string; count: number }[], accounts?: unknown[]) {
  let callCount = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => {
          callCount++;
          if (accounts && callCount === 1) {
            return Promise.resolve(accounts);
          }
          return {
            groupBy: () => Promise.resolve(findings),
          };
        },
      }),
    }),
  };
}

describe('CSPM Risk Score', () => {
  it('calculates perfect score with no findings', async () => {
    const db = createMockDb([]);
    const score = await calculateAccountRiskScore(db as any, 'acc-1');
    expect(score.score).toBe(100);
    expect(score.grade).toBe('A+');
    expect(score.findingCount).toBe(0);
  });

  it('calculates weighted risk from findings', async () => {
    const db = createMockDb([
      { severity: 'critical', count: 2 },
      { severity: 'high', count: 3 },
      { severity: 'medium', count: 5 },
    ]);
    const score = await calculateAccountRiskScore(db as any, 'acc-1');
    // weighted: 2*10 + 3*5 + 5*2 = 20 + 15 + 10 = 45
    expect(score.score).toBe(55);
    expect(score.grade).toBe('D');
    expect(score.criticalCount).toBe(2);
    expect(score.highCount).toBe(3);
    expect(score.mediumCount).toBe(5);
  });

  it('caps score at 0', async () => {
    const db = createMockDb([{ severity: 'critical', count: 20 }]);
    const score = await calculateAccountRiskScore(db as any, 'acc-1');
    expect(score.score).toBe(0);
    expect(score.grade).toBe('F');
  });

  it('returns perfect score for org with no accounts', async () => {
    const db = createMockDb([], []);
    const score = await calculateOrgRiskScore(db as any, 'org-1');
    expect(score.score).toBe(100);
    expect(score.grade).toBe('A+');
  });

  it('calculates org risk from findings', async () => {
    const db = createMockDb([{ severity: 'medium', count: 3 }], [{ id: 'acc-1' }]);
    const score = await calculateOrgRiskScore(db as any, 'org-1');
    // weighted: 3*2 = 6
    expect(score.score).toBe(94);
    expect(score.grade).toBe('A');
  });
});
