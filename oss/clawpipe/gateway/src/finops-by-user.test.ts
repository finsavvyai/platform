/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleFinopsByUser } from './finops-by-user';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({
  getAuthUser: vi.fn(),
  checkProjectAccess: vi.fn(),
}));
vi.mock('./finops-by-user-sql', () => ({
  buildUserRows: vi.fn(),
  buildTopModels: vi.fn(),
}));

import { getAuthUser, checkProjectAccess } from './auth/rbac';
import { buildUserRows, buildTopModels } from './finops-by-user-sql';

const authedUser = { sub: 'u1', email: 'admin@acme.test', iat: 0, exp: 0 };
const mkEnv = (): Env => ({} as Env);

function req(qs = 'projectId=p1'): Request {
  return new Request(`https://x.test/v1/finops/by-user?${qs}`);
}

beforeEach(() => {
  vi.mocked(getAuthUser).mockReset();
  vi.mocked(checkProjectAccess).mockReset();
  vi.mocked(buildUserRows).mockReset();
  vi.mocked(buildTopModels).mockReset();
  vi.mocked(buildTopModels).mockResolvedValue([]);
});

describe('handleFinopsByUser — auth + RBAC', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await handleFinopsByUser(req(), mkEnv());
    expect(res.status).toBe(401);
  });

  it('400 when projectId missing', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    const res = await handleFinopsByUser(req(''), mkEnv());
    expect(res.status).toBe(400);
  });

  it('403 when caller is not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    const res = await handleFinopsByUser(req(), mkEnv());
    expect(res.status).toBe(403);
  });
});

describe('handleFinopsByUser — data', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
  });

  it('admin receives rows aggregated by user', async () => {
    vi.mocked(buildUserRows).mockResolvedValue([
      { user_id: 'u2', email: 'dev@acme.test', name: 'Dev', total_cost: 1.5, total_requests: 10 },
      { user_id: 'u3', email: 'qa@acme.test',  name: 'QA',  total_cost: 0.5, total_requests: 5  },
    ]);
    vi.mocked(buildTopModels).mockResolvedValue([
      { user_id: 'u2', model: 'gpt-4o', cost: 1.2 },
      { user_id: 'u2', model: 'gpt-4o-mini', cost: 0.3 },
    ]);
    const res = await handleFinopsByUser(req(), mkEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as {
      rows: Array<{ user_id: string; email: string; total_cost: number; top_models: unknown[] }>;
    };
    expect(body.rows).toHaveLength(2);
    const u2 = body.rows.find((r) => r.user_id === 'u2')!;
    expect(u2.email).toBe('dev@acme.test');
    expect(u2.total_cost).toBe(1.5);
    expect(u2.top_models).toHaveLength(2);
    expect(u2.top_models[0]).toMatchObject({ model: 'gpt-4o', cost: 1.2 });
  });

  it('NULL user_id rows aggregated under Unattributed', async () => {
    vi.mocked(buildUserRows).mockResolvedValue([
      { user_id: null, email: null, name: null, total_cost: 3.0, total_requests: 20 },
    ]);
    const res = await handleFinopsByUser(req(), mkEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as {
      rows: Array<{ user_id: null; email: string; name: string }>;
    };
    expect(body.rows[0].user_id).toBeNull();
    expect(body.rows[0].email).toBe('Unattributed');
    expect(body.rows[0].name).toBe('Unattributed');
  });

  it('returns empty rows when no requests exist', async () => {
    vi.mocked(buildUserRows).mockResolvedValue([]);
    const res = await handleFinopsByUser(req(), mkEnv());
    expect(res.status).toBe(200);
    const body = await res.json() as { rows: unknown[] };
    expect(body.rows).toHaveLength(0);
  });

  it('response includes projectId, from, to fields', async () => {
    vi.mocked(buildUserRows).mockResolvedValue([]);
    const res = await handleFinopsByUser(
      req('projectId=p1&from=2026-04-01&to=2026-04-30'), mkEnv(),
    );
    const body = await res.json() as { projectId: string; from: string; to: string };
    expect(body.projectId).toBe('p1');
    expect(body.from).toBe('2026-04-01');
    expect(body.to).toBe('2026-04-30');
  });
});
