/** @vitest-environment node */
import { describe, it, expect } from 'vitest';
import { routeWebhookDlq, listDeadDeliveries, handleReplay } from './webhook-dlq-routes';
import type { Env } from './types';

interface FakeRow { id: string; project_id: string; status: string }

function makeDB(rows: FakeRow[]) {
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        all: async () => ({ results: rows }),
        first: async () => {
          if (sql.includes('SELECT project_id FROM webhook_deliveries')) {
            return rows.find((r) => r.id === binds[0]) ?? null;
          }
          if (sql.includes('SELECT id, webhook_id, project_id')) {
            return rows.find((r) => r.id === binds[0]) ?? null;
          }
          return null;
        },
        run: async () => ({ success: true }),
      }),
    }),
  };
}

function mkEnv(rows: FakeRow[]): Env {
  return { DB: makeDB(rows) as unknown as D1Database } as Env;
}

describe('listDeadDeliveries', () => {
  it('returns deliveries scoped to project', async () => {
    const env = mkEnv([
      { id: 'd1', project_id: 'p1', status: 'dead' },
      { id: 'd2', project_id: 'p1', status: 'pending' },
    ]);
    const res = await listDeadDeliveries(env, 'p1');
    expect(res.status).toBe(200);
    const body = await res.json() as { deliveries: FakeRow[] };
    expect(body.deliveries).toHaveLength(2);
  });
});

describe('handleReplay', () => {
  it('404s when delivery not found', async () => {
    const env = mkEnv([]);
    const res = await handleReplay(env, 'p1', 'missing');
    expect(res.status).toBe(404);
  });
  it('403s when delivery belongs to another project', async () => {
    const env = mkEnv([{ id: 'd1', project_id: 'p2', status: 'dead' }]);
    const res = await handleReplay(env, 'p1', 'd1');
    expect(res.status).toBe(403);
  });
  it('200s when delivery is replayed', async () => {
    const env = mkEnv([{ id: 'd1', project_id: 'p1', status: 'dead' }]);
    const res = await handleReplay(env, 'p1', 'd1');
    expect(res.status).toBe(200);
  });
});

describe('routeWebhookDlq', () => {
  it('routes GET /v1/webhooks/dlq', async () => {
    const env = mkEnv([{ id: 'd1', project_id: 'p1', status: 'dead' }]);
    const req = new Request('https://x.test/v1/webhooks/dlq');
    const res = await routeWebhookDlq(req, env, '/v1/webhooks/dlq', 'p1');
    expect(res?.status).toBe(200);
  });
  it('routes POST /v1/webhooks/dlq/:id/replay', async () => {
    const env = mkEnv([{ id: 'd1', project_id: 'p1', status: 'dead' }]);
    const req = new Request('https://x.test/v1/webhooks/dlq/d1/replay', { method: 'POST' });
    const res = await routeWebhookDlq(req, env, '/v1/webhooks/dlq/d1/replay', 'p1');
    expect(res?.status).toBe(200);
  });
  it('returns null for unrelated paths', async () => {
    const env = mkEnv([]);
    const req = new Request('https://x.test/v1/prompt');
    const res = await routeWebhookDlq(req, env, '/v1/prompt', 'p1');
    expect(res).toBeNull();
  });
  it('returns null for wrong method on /dlq', async () => {
    const env = mkEnv([]);
    const req = new Request('https://x.test/v1/webhooks/dlq', { method: 'POST' });
    const res = await routeWebhookDlq(req, env, '/v1/webhooks/dlq', 'p1');
    expect(res).toBeNull();
  });
});
