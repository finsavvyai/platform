import { describe, it, expect } from 'vitest';
import { getTableName } from 'drizzle-orm';
import { executeRunbook } from './executor.js';
import { parseRunbook } from './loader.js';
import type { ActionFn } from './types.js';

/**
 * Minimal fake DB recorder that mimics the subset of Drizzle calls the
 * executor uses (insert.values, update.set.where, select-not-used here).
 * Records every write so we can assert state transitions.
 */
function makeFakeDb() {
  const inserts: Array<{ table: string; row: any }> = [];
  const updates: Array<{ table: string; set: any }> = [];

  const fake: any = {
    inserts, updates,
    insert(table: any) {
      const tableName = getTableName(table);
      return {
        values: async (row: any) => {
          inserts.push({ table: tableName, row });
        },
      };
    },
    update(table: any) {
      const tableName = getTableName(table);
      return {
        set: (data: any) => ({
          where: async () => {
            updates.push({ table: tableName, set: data });
          },
        }),
      };
    },
  };
  return fake;
}

const baseRunbook = parseRunbook({
  id: 'rb-test',
  name: 'Test',
  trigger: {},
  steps: [
    { id: 'a', action: 'mock_a', params: {} },
    { id: 'b', action: 'mock_b', params: {} },
    { id: 'c', action: 'mock_c', params: {} },
  ],
});

describe('runbook executor: happy path', () => {
  it('runs all steps sequentially, persists run + step rows, completes', async () => {
    const db = makeFakeDb();
    const calls: string[] = [];
    const actions: Record<string, ActionFn> = {
      mock_a: async () => { calls.push('a'); return { ok: true, output: { x: 1 } }; },
      mock_b: async () => { calls.push('b'); return { ok: true, output: { x: 2 } }; },
      mock_c: async () => { calls.push('c'); return { ok: true, output: { x: 3 } }; },
    };

    const state = await executeRunbook({
      db, runbook: baseRunbook, ownerUserId: 'u1', orgId: null, actions,
    });

    expect(state.status).toBe('completed');
    expect(state.stepsExecuted).toBe(3);
    expect(calls).toEqual(['a', 'b', 'c']);

    // 1 run insert + 3 step inserts
    const runInserts = db.inserts.filter((i: any) => i.table === 'tf_runbook_runs');
    const stepInserts = db.inserts.filter((i: any) => i.table === 'tf_runbook_step_logs');
    expect(runInserts).toHaveLength(1);
    expect(stepInserts).toHaveLength(3);
    expect(stepInserts.map((s: any) => s.row.action)).toEqual(['mock_a', 'mock_b', 'mock_c']);
    expect(stepInserts.every((s: any) => s.row.status === 'running')).toBe(true);

    // Final run update marks completed
    const completed = db.updates.find((u: any) =>
      u.table === 'tf_runbook_runs' && u.set.status === 'completed');
    expect(completed).toBeDefined();
  });
});

describe('runbook executor: error handling', () => {
  it('on_error.mode=fail aborts the run and marks failed', async () => {
    const db = makeFakeDb();
    const actions: Record<string, ActionFn> = {
      mock_a: async () => ({ ok: true, output: {} }),
      mock_b: async () => ({ ok: false, error: 'boom' }),
      mock_c: async () => ({ ok: true, output: {} }),
    };

    const state = await executeRunbook({
      db, runbook: baseRunbook, ownerUserId: 'u1', orgId: null, actions,
    });

    expect(state.status).toBe('failed');
    expect(state.failedAtStep).toBe('b');
    expect(state.error).toBe('boom');
    expect(state.stepsExecuted).toBe(2); // a, b — c never ran

    const stepInserts = db.inserts.filter((i: any) => i.table === 'tf_runbook_step_logs');
    expect(stepInserts).toHaveLength(2);

    const failed = db.updates.find((u: any) =>
      u.table === 'tf_runbook_runs' && u.set.status === 'failed');
    expect(failed).toBeDefined();
  });

  it('on_error.mode=continue advances past failure', async () => {
    const db = makeFakeDb();
    const continueRunbook = parseRunbook({
      id: 'rb-cont', name: 'Cont', trigger: {},
      steps: [
        { id: 'a', action: 'mock_a', params: {}, on_error: { mode: 'continue' } },
        { id: 'b', action: 'mock_b', params: {} },
      ],
    });
    const actions: Record<string, ActionFn> = {
      mock_a: async () => ({ ok: false, error: 'transient' }),
      mock_b: async () => ({ ok: true, output: { fine: true } }),
    };

    const state = await executeRunbook({
      db, runbook: continueRunbook, ownerUserId: 'u1', orgId: null, actions,
    });
    expect(state.status).toBe('completed');
    expect(state.stepsExecuted).toBe(2);
  });

  it('catches thrown action errors and treats as failure', async () => {
    const db = makeFakeDb();
    const single = parseRunbook({
      id: 'rb-thr', name: 'T', trigger: {},
      steps: [{ id: 'a', action: 'mock_a', params: {} }],
    });
    const actions: Record<string, ActionFn> = {
      mock_a: async () => { throw new Error('explode'); },
    };
    const state = await executeRunbook({
      db, runbook: single, ownerUserId: 'u1', orgId: null, actions,
    });
    expect(state.status).toBe('failed');
    expect(state.error).toBe('explode');
  });

  it('unknown action name fails the step', async () => {
    const db = makeFakeDb();
    const rb = parseRunbook({
      id: 'rb-unk', name: 'U', trigger: {},
      steps: [{ id: 'a', action: 'does_not_exist', params: {} }],
    });
    const state = await executeRunbook({
      db, runbook: rb, ownerUserId: 'u1', orgId: null, actions: {},
    });
    expect(state.status).toBe('failed');
    expect(state.error).toMatch(/unknown action/);
  });
});

describe('runbook executor: navigation', () => {
  it('on_success jumps to the named step and skips intermediate ones', async () => {
    const db = makeFakeDb();
    const rb = parseRunbook({
      id: 'rb-jump', name: 'J', trigger: {},
      steps: [
        { id: 'a', action: 'mock_a', params: {}, on_success: 'c' },
        { id: 'b', action: 'mock_b', params: {} },
        { id: 'c', action: 'mock_c', params: {} },
      ],
    });
    const seen: string[] = [];
    const actions: Record<string, ActionFn> = {
      mock_a: async () => { seen.push('a'); return { ok: true }; },
      mock_b: async () => { seen.push('b'); return { ok: true }; },
      mock_c: async () => { seen.push('c'); return { ok: true }; },
    };
    const state = await executeRunbook({
      db, runbook: rb, ownerUserId: 'u1', orgId: null, actions,
    });
    expect(state.status).toBe('completed');
    expect(seen).toEqual(['a', 'c']);
  });
});
