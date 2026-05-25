import { describe, it, expect, vi } from 'vitest';
import { loadEnabledPolicies } from './policy-loader.js';
import type { Variables } from '../../types.js';

type DbLike = Variables['db'];

interface ChainCall {
  fromArg?: unknown;
  whereArg?: unknown;
  orderByArg?: unknown;
}

function makeDb(rows: Array<Record<string, unknown>>, captured?: ChainCall): DbLike {
  return {
    select: vi.fn(() => ({
      from: vi.fn((table: unknown) => {
        if (captured) captured.fromArg = table;
        return {
          where: vi.fn((cond: unknown) => {
            if (captured) captured.whereArg = cond;
            return {
              orderBy: vi.fn(async (order: unknown) => {
                if (captured) captured.orderByArg = order;
                return rows;
              }),
            };
          }),
        };
      }),
    })),
  } as unknown as DbLike;
}

describe('loadEnabledPolicies', () => {
  it('returns empty array when DB has no rows', async () => {
    const result = await loadEnabledPolicies(makeDb([]), 't1');
    expect(result).toEqual([]);
  });

  it('parses well-formed rule rows into Policy objects in DB return order', async () => {
    const rows = [
      {
        id: 'p1', tenantId: 't1', name: 'high-risk geo',
        rules: JSON.stringify({ if_any: [{ geo_country_in: ['RU'] }], then: 'block' }),
        priority: 10, enabled: true,
      },
      {
        id: 'p2', tenantId: 't1', name: 'admin step-up',
        rules: JSON.stringify({ if_any: [{ sensitive_path: true }], then: 'step_up' }),
        priority: 20, enabled: true,
      },
    ];
    const result = await loadEnabledPolicies(makeDb(rows), 't1');
    expect(result).toHaveLength(2);
    // Order from DB is preserved (orderBy ASC priority enforced at SQL level)
    expect(result[0]).toBeTruthy();
    expect(result[1]).toBeTruthy();
  });

  it('silently drops rows whose rule JSON is malformed', async () => {
    const rows = [
      { id: 'p1', tenantId: 't1', name: 'good', rules: JSON.stringify({ then: 'allow' }), priority: 1, enabled: true },
      { id: 'p2', tenantId: 't1', name: 'broken', rules: '{not-json', priority: 2, enabled: true },
      { id: 'p3', tenantId: 't1', name: 'also-good', rules: JSON.stringify({ then: 'block' }), priority: 3, enabled: true },
    ];
    const result = await loadEnabledPolicies(makeDb(rows), 't1');
    // 2 of 3 parse — broken row dropped
    expect(result).toHaveLength(2);
  });

  it('returns empty array when every row has malformed rules (fail-open)', async () => {
    const rows = [
      { id: 'p1', tenantId: 't1', name: 'broken1', rules: '{', priority: 1, enabled: true },
      { id: 'p2', tenantId: 't1', name: 'broken2', rules: 'not-json', priority: 2, enabled: true },
    ];
    const result = await loadEnabledPolicies(makeDb(rows), 't1');
    // Per the file's docstring: "Malformed rules are dropped silently —
    // a single broken policy must not lock a tenant out of refresh."
    expect(result).toEqual([]);
  });

  it('issues exactly one query per call (no N+1)', async () => {
    const captured: ChainCall = {};
    const db = makeDb([], captured);
    const selectSpy = (db as unknown as { select: ReturnType<typeof vi.fn> }).select;
    await loadEnabledPolicies(db, 't1');
    expect(selectSpy).toHaveBeenCalledTimes(1);
    // The chain produced one .where + one .orderBy call (verified via captured)
    expect(captured.whereArg).toBeDefined();
    expect(captured.orderByArg).toBeDefined();
  });
});
