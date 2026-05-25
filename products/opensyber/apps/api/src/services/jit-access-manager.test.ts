/**
 * JIT Access Manager Tests
 */
import { describe, it, expect, vi } from 'vitest';
import {
  createJitRequest, approveJitRequest, denyJitRequest, expireOverdueRequests,
} from './jit-access-manager.js';

function createMockDb(selectResults: unknown[] = []) {
  let selectIdx = 0;
  const updateFn = vi.fn(async () => ({}));
  const valuesFn = vi.fn(async () => ({}));

  return {
    select: () => ({
      from: () => ({
        where: () => Promise.resolve(selectResults[selectIdx++] ?? []),
      }),
    }),
    insert: vi.fn(() => ({ values: valuesFn })),
    update: () => ({
      set: () => ({
        where: updateFn,
      }),
    }),
    _valuesFn: valuesFn,
  };
}

describe('JIT Access Manager', () => {
  it('creates a JIT request', async () => {
    const db = createMockDb();
    await createJitRequest(db as never, {
      id: 'jit-1', orgId: 'org-1', requesterId: 'user-1',
      secretId: 'secret-1', reason: 'Deploy fix', durationMinutes: 30,
    });
    expect(db.insert).toBeCalled();
  });

  it('approves a pending request', async () => {
    const db = createMockDb([
      [{ id: 'jit-1', status: 'pending', durationMinutes: 60 }],
    ]);
    const ok = await approveJitRequest(db as never, 'org-1', 'jit-1', 'admin-1');
    expect(ok).toBe(true);
  });

  it('rejects approval if not pending', async () => {
    const db = createMockDb([
      [{ id: 'jit-1', status: 'approved', durationMinutes: 60 }],
    ]);
    const ok = await approveJitRequest(db as never, 'org-1', 'jit-1', 'admin-1');
    expect(ok).toBe(false);
  });

  it('denies a pending request', async () => {
    const db = createMockDb([
      [{ id: 'jit-2', status: 'pending' }],
    ]);
    const ok = await denyJitRequest(db as never, 'org-1', 'jit-2');
    expect(ok).toBe(true);
  });

  it('expires overdue approved requests', async () => {
    const pastDate = new Date(Date.now() - 3600000).toISOString();
    const db = createMockDb([
      [{ id: 'jit-3', status: 'approved', expiresAt: pastDate }],
    ]);
    const count = await expireOverdueRequests(db as never, 'org-1');
    expect(count).toBe(1);
  });
});
