/**
 * CSPM Drift Detection Tests
 */
import { describe, it, expect } from 'vitest';
import { detectDrift } from './cspm-drift.js';

function createMockDb(scans: unknown[], currentFindings: unknown[], previousFindings: unknown[]) {
  let selectCount = 0;
  return {
    select: () => ({
      from: () => ({
        where: () => ({
          orderBy: () => ({ limit: () => Promise.resolve(scans) }),
          groupBy: () => Promise.resolve([]),
        }),
      }),
    }),
  };
}

describe('CSPM Drift Detection', () => {
  it('returns empty drift when fewer than 2 scans exist', async () => {
    const db = {
      select: () => ({
        from: () => ({
          where: () => ({
            orderBy: () => ({ limit: () => Promise.resolve([]) }),
          }),
        }),
      }),
    };

    const result = await detectDrift(db as any, 'acc-1');
    expect(result.newFindings).toHaveLength(0);
    expect(result.resolvedFindings).toHaveLength(0);
    expect(result.unchangedCount).toBe(0);
  });

  it('detects new and resolved findings between scans', async () => {
    let callCount = 0;
    const db = {
      select: () => ({
        from: () => ({
          where: () => {
            callCount++;
            if (callCount === 1) {
              return {
                orderBy: () => ({
                  limit: () => Promise.resolve([
                    { id: 'scan-2', completedAt: '2026-03-07' },
                    { id: 'scan-1', completedAt: '2026-03-06' },
                  ]),
                }),
              };
            }
            if (callCount === 2) {
              return Promise.resolve([
                { checkId: 'check-a', resourceId: 'r1' },
                { checkId: 'check-b', resourceId: 'r2' },
              ]);
            }
            return Promise.resolve([
              { checkId: 'check-a', resourceId: 'r1' },
              { checkId: 'check-c', resourceId: 'r3' },
            ]);
          },
        }),
      }),
    };

    const result = await detectDrift(db as any, 'acc-1');
    expect(result.newFindings).toContain('check-b:r2');
    expect(result.resolvedFindings).toContain('check-c:r3');
    expect(result.unchangedCount).toBe(1);
  });
});
