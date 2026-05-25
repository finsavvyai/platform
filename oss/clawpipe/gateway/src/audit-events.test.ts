/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { writeAuditEvent, readAuditEvents } from './audit-events';
import type { Env } from './types';

// In-memory store for testing
interface Row {
  id: string; project_id: string; actor_user_id: string | null;
  action: string; target: string | null; metadata: string | null; created_at: string;
}

function makeDB(rows: Row[] = []) {
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        run: async () => {
          if (sql.startsWith('INSERT INTO audit_events')) {
            rows.push({
              id: binds[0] as string, project_id: binds[1] as string,
              actor_user_id: binds[2] as string | null, action: binds[3] as string,
              target: binds[4] as string | null, metadata: binds[5] as string | null,
              created_at: new Date().toISOString().replace('T', ' ').slice(0, 19),
            });
          }
          return { success: true };
        },
        all: async () => {
          // Simulate WHERE project_id=? filtering + optional since/action/limit.
          const projectId = binds[0] as string;
          let filtered = rows.filter((r) => r.project_id === projectId);
          for (let i = 1; i < binds.length - 1; i++) {
            const b = binds[i] as string;
            if (sql.includes('AND created_at < ?') && i === 1 && !sql.includes('AND action')) {
              filtered = filtered.filter((r) => r.created_at < b);
            }
            if (sql.includes('AND action = ?')) {
              filtered = filtered.filter((r) => r.action === b);
            }
          }
          const lim = binds[binds.length - 1] as number;
          return { results: filtered.slice(0, lim) };
        },
      }),
    }),
  };
}

const mkEnv = (rows: Row[] = []): Env =>
  ({ DB: makeDB(rows) as unknown as D1Database } as Env);

describe('writeAuditEvent', () => {
  it('inserts a row', async () => {
    const rows: Row[] = [];
    await writeAuditEvent(mkEnv(rows), { projectId: 'p1', actorUserId: 'u1', action: 'apikey.rotate' });
    expect(rows).toHaveLength(1);
    expect(rows[0].action).toBe('apikey.rotate');
    expect(rows[0].project_id).toBe('p1');
  });

  it('serializes metadata as JSON string', async () => {
    const rows: Row[] = [];
    await writeAuditEvent(mkEnv(rows), {
      projectId: 'p1', action: 'budget.cap.changed',
      metadata: { from: 100, to: 200 },
    });
    expect(rows[0].metadata).toBe('{"from":100,"to":200}');
  });

  it('stores null metadata when not provided', async () => {
    const rows: Row[] = [];
    await writeAuditEvent(mkEnv(rows), { projectId: 'p1', action: 'member.joined' });
    expect(rows[0].metadata).toBeNull();
  });

  it('swallows DB errors silently', async () => {
    const badEnv = {
      DB: {
        prepare: () => ({ bind: () => ({ run: async () => { throw new Error('D1 error'); } }) }),
      },
    } as unknown as Env;
    await expect(writeAuditEvent(badEnv, { projectId: 'p1', action: 'test' })).resolves.toBeUndefined();
  });
});

describe('readAuditEvents', () => {
  function seedRows(projectId: string, count: number, baseTs: string): Row[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `id${i}`, project_id: projectId, actor_user_id: null,
      action: i % 2 === 0 ? 'apikey.rotate' : 'budget.cap.changed',
      target: null, metadata: null,
      created_at: new Date(new Date(baseTs).getTime() + i * 1000).toISOString().slice(0, 19).replace('T', ' '),
    }));
  }

  it('returns rows for project', async () => {
    const rows = seedRows('p1', 3, '2026-01-01T00:00:00');
    const env = mkEnv(rows);
    const events = await readAuditEvents(env, 'p1');
    expect(events).toHaveLength(3);
  });

  it('respects limit cap (max 200)', async () => {
    const rows = seedRows('p1', 50, '2026-01-01T00:00:00');
    const env = mkEnv(rows);
    const events = await readAuditEvents(env, 'p1', { limit: 5 });
    expect(events.length).toBeLessThanOrEqual(5);
  });

  it('since filter excludes rows at or after cursor', async () => {
    const rows = seedRows('p1', 5, '2026-01-01T00:00:00');
    const env = mkEnv(rows);
    // rows[2].created_at is the cursor — should exclude rows[2..4]
    const cursor = rows[2].created_at;
    const events = await readAuditEvents(env, 'p1', { since: cursor });
    events.forEach((e) => expect(e.created_at < cursor).toBe(true));
  });

  it('action filter returns only matching rows', async () => {
    const rows = seedRows('p1', 6, '2026-01-01T00:00:00');
    const env = mkEnv(rows);
    const events = await readAuditEvents(env, 'p1', { action: 'apikey.rotate' });
    events.forEach((e) => expect(e.action).toBe('apikey.rotate'));
  });

  it('returns empty for unknown project', async () => {
    const rows = seedRows('p1', 3, '2026-01-01T00:00:00');
    const env = mkEnv(rows);
    const events = await readAuditEvents(env, 'p-unknown');
    expect(events).toHaveLength(0);
  });
});
