/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  handleGetSettings, handleSetDigestEmail, handleSetBudget,
  handleSendTestEmail, routeSettings,
} from './settings-routes';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({
  getAuthUser: vi.fn(),
  checkProjectAccess: vi.fn(),
}));
vi.mock('./budget', () => ({
  getBudgetStatus: vi.fn().mockResolvedValue({ monthlyCap: 100, usedMtd: 25, pct: 25, over: false }),
  getTeamBudgetStatus: vi.fn().mockResolvedValue({ monthlyCap: 200, usedMtd: 0, pct: 0, over: false }),
}));
vi.mock('./email-digest', () => ({
  isValidEmail: (s: string) => /\S+@\S+\.\S+/.test(s),
  formatDigestEmail: vi.fn().mockReturnValue({ subject: 's', html: 'h', text: 't' }),
  sendEmail: vi.fn().mockResolvedValue(true),
}));
vi.mock('./slack-digest', () => ({
  collectProjectDigest: vi.fn().mockResolvedValue({ projectName: 'P', totalRequests: 10 }),
}));

import { getAuthUser, checkProjectAccess } from './auth/rbac';

interface DBState {
  project?: { name: string; slack_webhook_url: string | null; digest_email: string | null; team_id: string | null } | null;
  emailRow?: { name: string; digest_email: string | null } | null;
  updates: Array<{ binds: unknown[] }>;
}

function makeDB(state: DBState) {
  return {
    prepare: (sql: string) => ({
      bind: (...binds: unknown[]) => ({
        first: async () => {
          if (sql.includes('SELECT name, slack_webhook_url')) return state.project ?? null;
          if (sql.includes('SELECT name, digest_email')) return state.emailRow ?? null;
          return null;
        },
        run: async () => {
          if (sql.startsWith('UPDATE')) state.updates.push({ binds });
          return { success: true };
        },
      }),
    }),
  };
}

const mkEnv = (state: Partial<DBState> = {}, extra: Partial<Env> = {}): Env =>
  ({ DB: makeDB({ updates: [], ...state }) as unknown as D1Database, ...extra } as Env);

const adminUser = { sub: 'u1', email: 'a@b.test', iat: 0, exp: 0 };

beforeEach(() => {
  vi.mocked(getAuthUser).mockReset();
  vi.mocked(checkProjectAccess).mockReset();
});

function jsonReq(body: unknown, method: string = 'PUT'): Request {
  return new Request('https://x.test/', { method, body: JSON.stringify(body) });
}

describe('handleGetSettings', () => {
  it('401 unauth', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleGetSettings(new Request('https://x.test/'), mkEnv(), 'p1')).status).toBe(401);
  });
  it('404 no access', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleGetSettings(new Request('https://x.test/'), mkEnv(), 'p1')).status).toBe(404);
  });
  it('404 project missing', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    expect((await handleGetSettings(new Request('https://x.test/'), mkEnv({ project: null }), 'p1')).status).toBe(404);
  });
  it('200 returns slack/email config + budget + team-budget', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const env = mkEnv({ project: { name: 'P', slack_webhook_url: 'https://x', digest_email: 'a@b.test', team_id: 't1' } });
    const body = await (await handleGetSettings(new Request('https://x.test/'), env, 'p1')).json() as {
      slack: { configured: boolean }; email: { configured: boolean }; budget: object; team: { id: string } | null;
    };
    expect(body.slack.configured).toBe(true);
    expect(body.email.configured).toBe(true);
    expect(body.team!.id).toBe('t1');
  });
});

describe('handleSetDigestEmail', () => {
  it('401/403/400 invalid/200 set/200 clear', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleSetDigestEmail(jsonReq({}), mkEnv(), 'p1')).status).toBe(401);

    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleSetDigestEmail(jsonReq({}), mkEnv(), 'p1')).status).toBe(403);

    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    expect((await handleSetDigestEmail(jsonReq({ email: 'not-email' }), mkEnv(), 'p1')).status).toBe(400);
    const set = await (await handleSetDigestEmail(jsonReq({ email: 'a@b.test' }), mkEnv(), 'p1')).json() as { configured: boolean };
    expect(set.configured).toBe(true);
    const cleared = await (await handleSetDigestEmail(jsonReq({ email: null }), mkEnv(), 'p1')).json() as { configured: boolean };
    expect(cleared.configured).toBe(false);
  });
});

describe('handleSetBudget', () => {
  it('401/403/400 negative/200 set/200 clear', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleSetBudget(jsonReq({}), mkEnv(), 'p1')).status).toBe(401);

    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleSetBudget(jsonReq({}), mkEnv(), 'p1')).status).toBe(403);

    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    expect((await handleSetBudget(jsonReq({ monthlyCap: -5 }), mkEnv(), 'p1')).status).toBe(400);
    expect((await handleSetBudget(jsonReq({ monthlyCap: 'string' }), mkEnv(), 'p1')).status).toBe(400);

    expect((await handleSetBudget(jsonReq({ monthlyCap: 100 }), mkEnv(), 'p1')).status).toBe(200);
    expect((await handleSetBudget(jsonReq({ monthlyCap: null }), mkEnv(), 'p1')).status).toBe(200);
    expect((await handleSetBudget(jsonReq({ monthlyCap: 0 }), mkEnv(), 'p1')).status).toBe(200);
  });
});

describe('handleSendTestEmail', () => {
  it('401', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    expect((await handleSendTestEmail(jsonReq({}, 'POST'), mkEnv(), 'p1')).status).toBe(401);
  });
  it('403', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    expect((await handleSendTestEmail(jsonReq({}, 'POST'), mkEnv(), 'p1')).status).toBe(403);
  });
  it('400 no digest email configured', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const env = mkEnv({ emailRow: { name: 'P', digest_email: null } }, { RESEND_API_KEY: 'x' });
    expect((await handleSendTestEmail(jsonReq({}, 'POST'), env, 'p1')).status).toBe(400);
  });
  it('503 when Resend not configured', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const env = mkEnv({ emailRow: { name: 'P', digest_email: 'a@b.test' } });
    expect((await handleSendTestEmail(jsonReq({}, 'POST'), env, 'p1')).status).toBe(503);
  });
  it('200 sends digest', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const env = mkEnv({ emailRow: { name: 'P', digest_email: 'a@b.test' } }, { RESEND_API_KEY: 'x' });
    expect((await handleSendTestEmail(jsonReq({}, 'POST'), env, 'p1')).status).toBe(200);
  });
});

describe('routeSettings', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
  });
  it('GET /settings -> get', async () => {
    const env = mkEnv({ project: { name: 'P', slack_webhook_url: null, digest_email: null, team_id: null } });
    const res = await routeSettings(new Request('https://x.test/'), env, '/v1/projects/p1/settings', 'GET');
    expect(res?.status).toBe(200);
  });
  it('PUT /budget -> set', async () => {
    const res = await routeSettings(jsonReq({ monthlyCap: 50 }), mkEnv(), '/v1/projects/p1/budget', 'PUT');
    expect(res?.status).toBe(200);
  });
  it('PUT /digest-email -> set', async () => {
    const res = await routeSettings(jsonReq({ email: 'a@b.test' }), mkEnv(), '/v1/projects/p1/digest-email', 'PUT');
    expect(res?.status).toBe(200);
  });
  it('POST /digest-email/test -> send', async () => {
    const env = mkEnv({ emailRow: { name: 'P', digest_email: 'a@b.test' } }, { RESEND_API_KEY: 'x' });
    const res = await routeSettings(jsonReq({}, 'POST'), env, '/v1/projects/p1/digest-email/test', 'POST');
    expect(res?.status).toBe(200);
  });
  it('null on unrelated', async () => {
    expect(await routeSettings(new Request('https://x.test/'), mkEnv(), '/v1/prompt', 'POST')).toBeNull();
  });
});
