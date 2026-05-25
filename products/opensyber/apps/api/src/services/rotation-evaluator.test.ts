/**
 * Rotation Evaluator Tests
 */
import { describe, it, expect } from 'vitest';
import { evaluateRotationPolicies, calculateNextRotation } from './rotation-evaluator.js';

describe('Rotation Evaluator', () => {
  it('detects overdue rotation policies', async () => {
    const pastDate = new Date(Date.now() - 86400000 * 5).toISOString();
    const db = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([
            {
              id: 'pol-1', secretPattern: 'AWS_*', rotationIntervalDays: 90,
              lastRotatedAt: '2025-01-01', nextRotationAt: pastDate, status: 'active',
            },
          ]),
        }),
      }),
    };

    const statuses = await evaluateRotationPolicies(db as any, 'org-1');
    expect(statuses).toHaveLength(1);
    expect(statuses[0].isOverdue).toBe(true);
    expect(statuses[0].daysOverdue).toBeGreaterThanOrEqual(4);
  });

  it('marks non-overdue policies correctly', async () => {
    const futureDate = new Date(Date.now() + 86400000 * 30).toISOString();
    const db = {
      select: () => ({
        from: () => ({
          where: () => Promise.resolve([
            {
              id: 'pol-2', secretPattern: 'DB_*', rotationIntervalDays: 30,
              lastRotatedAt: '2026-03-01', nextRotationAt: futureDate, status: 'active',
            },
          ]),
        }),
      }),
    };

    const statuses = await evaluateRotationPolicies(db as any, 'org-1');
    expect(statuses[0].isOverdue).toBe(false);
    expect(statuses[0].daysOverdue).toBe(0);
  });

  it('calculates next rotation date', () => {
    const next = calculateNextRotation('2026-03-01T00:00:00.000Z', 90);
    expect(new Date(next).getMonth()).toBe(4); // May (0-indexed)
  });
});
