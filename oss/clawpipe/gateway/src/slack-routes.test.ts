/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleSetSlackWebhook, handleSendTestDigest, routeSlack,
} from './slack-routes';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({
  getAuthUser: vi.fn(),
  checkProjectAccess: vi.fn(),
}));
vi.mock('./slack-digest', () => ({
  collectProjectDigest: vi.fn().mockResolvedValue({ totalRequests: 100, totalCost: 1.5 }),
  formatSlackBlocks: vi.fn().mockReturnValue({ blocks: [] }),
  postToSlack: vi.fn().mockResolvedValue(true),
  isValidSlackWebhook: (u: string) => u.startsWith('https://hooks.slack.com/services/'),
  runDigestForAllProjects: vi.fn(),
}));

import { getAuthUser, checkProjectAccess } from './auth/rbac';
import { postToSlack } from './slack-digest';

const authedUser = { sub: 'u1', email: 'a@b.test', iat: 0, exp: 0 };

function makeDB(opts: { project?: { name: string; slack_webhook_url: string | null } | null; updates?: Array<{ binds: unknown[] }> } = {}) {
  const state = { updates: opts.updates ?? [] };
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        first: async () => opts.project ?? null,
        run: async () => { state.updates.push({ binds }); return { success: true }; },
      }),
    }),
  };
}
const mkEnv = (opts = {}): Env => ({ DB: makeDB(opts) as unknown as D1Database } as Env);

function jsonReq(body: unknown, method = 'PUT'): Request {
  return new Request('https://x.test/', { method, body: JSON.stringify(body) });
}

beforeEach(() => {
  vi.mocked(getAuthUser).mockReset();
  vi.mocked(checkProjectAccess).mockReset();
  vi.mocked(postToSlack).mockClear();
});

describe('handleSetSlackWebhook', () => {
  it('401 unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleSetSlackWebhook(jsonReq({}), mkEnv(), 'p1')).status).toBe(401);
  });
  it('403 not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleSetSlackWebhook(jsonReq({}), mkEnv(), 'p1')).status).toBe(403);
  });
  it('400 on invalid Slack URL', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    expect((await handleSetSlackWebhook(jsonReq({ url: 'https://evil.test/' }), mkEnv(), 'p1')).status).toBe(400);
  });
  it('200 + configured=true on valid URL', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const res = await handleSetSlackWebhook(jsonReq({ url: 'https://hooks.slack.com/services/T/B/secret' }), mkEnv(), 'p1');
    const body = await res.json() as { configured: boolean };
    expect(body.configured).toBe(true);
  });
  it('200 + configured=false when url cleared', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const body = await (await handleSetSlackWebhook(jsonReq({ url: null }), mkEnv(), 'p1')).json() as { configured: boolean };
    expect(body.configured).toBe(false);
  });
});

describe('handleSendTestDigest', () => {
  it('401', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleSendTestDigest(jsonReq({}, 'POST'), mkEnv(), 'p1')).status).toBe(401);
  });
  it('403', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleSendTestDigest(jsonReq({}, 'POST'), mkEnv(), 'p1')).status).toBe(403);
  });
  it('400 when no slack url configured', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const env = mkEnv({ project: { name: 'P', slack_webhook_url: null } });
    expect((await handleSendTestDigest(jsonReq({}, 'POST'), env, 'p1')).status).toBe(400);
  });
  it('200 + posts to Slack on configured webhook', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const env = mkEnv({ project: { name: 'P', slack_webhook_url: 'https://hooks.slack.com/services/x/y/z' } });
    const res = await handleSendTestDigest(jsonReq({}, 'POST'), env, 'p1');
    expect(res.status).toBe(200);
    expect(postToSlack).toHaveBeenCalled();
  });
});

describe('routeSlack', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
  });
  it('PUT /v1/projects/:id/slack-webhook -> set', async () => {
    const res = await routeSlack(jsonReq({ url: null }), mkEnv(), '/v1/projects/p1/slack-webhook', 'PUT');
    expect(res?.status).toBe(200);
  });
  it('POST /v1/projects/:id/slack-digest/test -> test digest', async () => {
    const env = mkEnv({ project: { name: 'P', slack_webhook_url: 'https://hooks.slack.com/services/x/y/z' } });
    const res = await routeSlack(jsonReq({}, 'POST'), env, '/v1/projects/p1/slack-digest/test', 'POST');
    expect(res?.status).toBe(200);
  });
  it('returns null for unrelated', async () => {
    const res = await routeSlack(new Request('https://x.test/'), mkEnv(), '/v1/prompt', 'POST');
    expect(res).toBeNull();
  });
});
