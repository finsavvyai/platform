/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleCreateWebhook, handleListWebhooks, handleDeleteWebhook, routeWebhooks,
} from './webhook-routes';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({
  getAuthUser: vi.fn(),
  checkProjectAccess: vi.fn(),
}));

import { getAuthUser, checkProjectAccess } from './auth/rbac';

interface DBState {
  inserts: Array<{ binds: unknown[] }>;
  rows?: object[];
}

function makeDB(state: DBState) {
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        all: async () => ({ results: state.rows ?? [] }),
        run: async () => {
          if (sql.startsWith('INSERT')) state.inserts.push({ binds });
          return { success: true };
        },
      }),
    }),
  };
}

const mkEnv = (state: Partial<DBState> = {}): Env =>
  ({ DB: makeDB({ inserts: [], ...state }) as unknown as D1Database } as Env);

const authedUser = { sub: 'u1', email: 'a@b.test', iat: 0, exp: 0 };

beforeEach(() => {
  vi.mocked(getAuthUser).mockReset();
  vi.mocked(checkProjectAccess).mockReset();
});

function jsonReq(body: unknown, method = 'POST'): Request {
  return new Request('https://x.test/v1/projects/p1/webhooks', {
    method, body: JSON.stringify(body),
  });
}

describe('handleCreateWebhook', () => {
  it('401 unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await handleCreateWebhook(jsonReq({}), mkEnv(), 'p1');
    expect(res.status).toBe(401);
  });

  it('403 not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    const res = await handleCreateWebhook(jsonReq({}), mkEnv(), 'p1');
    expect(res.status).toBe(403);
  });

  it('400 missing url', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleCreateWebhook(jsonReq({ events: ['*'] }), mkEnv(), 'p1');
    expect(res.status).toBe(400);
  });

  it('400 non-https url', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleCreateWebhook(jsonReq({ url: 'http://x.test/', events: ['*'] }), mkEnv(), 'p1');
    expect(res.status).toBe(400);
  });

  it('400 events missing', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleCreateWebhook(jsonReq({ url: 'https://x.test/' }), mkEnv(), 'p1');
    expect(res.status).toBe(400);
  });

  it('400 invalid event name', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleCreateWebhook(jsonReq({ url: 'https://x.test/', events: ['fake'] }), mkEnv(), 'p1');
    expect(res.status).toBe(400);
  });

  it('201 happy path with events list', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleCreateWebhook(jsonReq({
      url: 'https://x.test/', events: ['anomaly.detected', 'digest.sent'],
    }), mkEnv(), 'p1');
    expect(res.status).toBe(201);
    const body = await res.json() as { webhook: { url: string; secret: string } };
    expect(body.webhook.url).toBe('https://x.test/');
    expect(body.webhook.secret.length).toBeGreaterThan(40);
  });

  it('201 with wildcard events', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleCreateWebhook(jsonReq({
      url: 'https://x.test/', events: ['*'],
    }), mkEnv(), 'p1');
    expect(res.status).toBe(201);
    const body = await res.json() as { webhook: { events: string } };
    expect(body.webhook.events).toBe('*');
  });
});

describe('handleListWebhooks', () => {
  it('401 unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleListWebhooks(new Request('https://x.test/'), mkEnv(), 'p1')).status).toBe(401);
  });

  it('404 no project access', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleListWebhooks(new Request('https://x.test/'), mkEnv(), 'p1')).status).toBe(404);
  });

  it('200 returns rows', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const env = mkEnv({ rows: [{ id: 'w1', url: 'https://a/', events: '*', created_at: '2026-01-01' }] });
    const body = await (await handleListWebhooks(new Request('https://x.test/'), env, 'p1')).json() as { webhooks: unknown[] };
    expect(body.webhooks).toHaveLength(1);
  });
});

describe('handleDeleteWebhook', () => {
  it('401', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleDeleteWebhook(new Request('https://x.test/', { method: 'DELETE' }), mkEnv(), 'p1', 'w1')).status).toBe(401);
  });
  it('403', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleDeleteWebhook(new Request('https://x.test/', { method: 'DELETE' }), mkEnv(), 'p1', 'w1')).status).toBe(403);
  });
  it('200', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    expect((await handleDeleteWebhook(new Request('https://x.test/', { method: 'DELETE' }), mkEnv(), 'p1', 'w1')).status).toBe(200);
  });
});

describe('routeWebhooks dispatch', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
  });
  it('POST /v1/projects/:id/webhooks routes to create', async () => {
    const res = await routeWebhooks(jsonReq({ url: 'https://x.test/', events: ['*'] }), mkEnv(), '/v1/projects/p1/webhooks', 'POST');
    expect(res?.status).toBe(201);
  });
  it('GET /v1/projects/:id/webhooks routes to list', async () => {
    const res = await routeWebhooks(new Request('https://x.test/'), mkEnv(), '/v1/projects/p1/webhooks', 'GET');
    expect(res?.status).toBe(200);
  });
  it('DELETE /v1/projects/:id/webhooks/:hookId routes to delete', async () => {
    const res = await routeWebhooks(new Request('https://x.test/', { method: 'DELETE' }), mkEnv(), '/v1/projects/p1/webhooks/w1', 'DELETE');
    expect(res?.status).toBe(200);
  });
  it('returns null for unrelated path', async () => {
    const res = await routeWebhooks(new Request('https://x.test/'), mkEnv(), '/v1/prompt', 'POST');
    expect(res).toBeNull();
  });
});
