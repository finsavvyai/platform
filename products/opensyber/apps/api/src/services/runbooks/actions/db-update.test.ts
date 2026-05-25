import { describe, it, expect } from 'vitest';
import { dbUpdateAction } from './db-update.js';
import { DB_UPDATE_ALLOWLIST } from './db-update-allowlist.js';
import type { RunbookContext } from '../types.js';

const ctx: RunbookContext = {
  runId: 'run-1', runbookId: 'rb-1', triggerAlertId: null,
  ownerUserId: 'u-1', orgId: 'org-1',
  prevOutputs: {}, params: {},
  services: {},
};

describe('db_update action — fail-closed allowlist', () => {
  it('starts with an empty allowlist (security default)', () => {
    expect(DB_UPDATE_ALLOWLIST).toEqual([]);
  });

  it('rejects table not in allowlist', async () => {
    const r = await dbUpdateAction(
      {
        id: 's1', action: 'db_update',
        params: { table: 'users', set: { name: 'x' } },
        on_error: { mode: 'fail' },
      },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/not in DB_UPDATE_ALLOWLIST/);
  });

  it('rejects when params fail zod validation', async () => {
    const r = await dbUpdateAction(
      {
        id: 's1', action: 'db_update',
        params: { table: 'alerts' /* missing set */ },
        on_error: { mode: 'fail' },
      },
      ctx,
    );
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/invalid params/);
  });

  it('returns clear error message when allowlist entry would be present but executor not yet wired', async () => {
    // Future-proof: simulate adding an entry. When real execution lands,
    // change this test to verify the actual update path. The current
    // contract is "fail-closed with explicit message" so the test asserts
    // exactly that.
    DB_UPDATE_ALLOWLIST.push({
      table: '__test_table',
      columns: ['col_a'],
      scope: 'org',
    });
    try {
      const r = await dbUpdateAction(
        {
          id: 's1', action: 'db_update',
          params: { table: '__test_table', set: { col_a: 'v' } },
          on_error: { mode: 'fail' },
        },
        ctx,
      );
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/executor not yet implemented/);
    } finally {
      DB_UPDATE_ALLOWLIST.length = 0;
    }
  });

  it('rejects disallowed column even when table is allowlisted', async () => {
    DB_UPDATE_ALLOWLIST.push({
      table: '__test_table',
      columns: ['col_a'],
      scope: 'org',
    });
    try {
      const r = await dbUpdateAction(
        {
          id: 's1', action: 'db_update',
          params: { table: '__test_table', set: { col_b: 'v' } },
          on_error: { mode: 'fail' },
        },
        ctx,
      );
      expect(r.ok).toBe(false);
      expect(r.error).toMatch(/col_b.*not allowed/);
    } finally {
      DB_UPDATE_ALLOWLIST.length = 0;
    }
  });
});
