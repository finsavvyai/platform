/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleExportCsv, routeExport } from './export-csv';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({
  getAuthUser: vi.fn(),
  checkProjectAccess: vi.fn(),
}));

import { getAuthUser, checkProjectAccess } from './auth/rbac';

interface RequestRow {
  created_at: string; provider: string; model: string;
  tokens_in: number; tokens_out: number; latency_ms: number;
  cost: number; cached: number; boosted: number; session_id: string | null;
}

function makeDB(rows: RequestRow[]) {
  return {
    prepare: () => ({
      bind: () => ({
        all: async () => ({ results: rows }),
      }),
    }),
  };
}

const mkEnv = (rows: RequestRow[] = []): Env =>
  ({ DB: makeDB(rows) as unknown as D1Database } as Env);

const authedUser = { sub: 'u1', email: 'a@b.test', iat: 0, exp: 0 };

beforeEach(() => {
  vi.mocked(getAuthUser).mockReset();
  vi.mocked(checkProjectAccess).mockReset();
});

describe('handleExportCsv', () => {
  it('401 when unauthenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const req = new Request('https://x.test/v1/projects/p1/export.csv');
    expect((await handleExportCsv(req, mkEnv(), 'p1')).status).toBe(401);
  });

  it('403 when not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    const req = new Request('https://x.test/v1/projects/p1/export.csv');
    expect((await handleExportCsv(req, mkEnv(), 'p1')).status).toBe(403);
  });

  it('returns CSV with header + filename + Content-Type', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const env = mkEnv([
      { created_at: '2026-04-01T00:00:00Z', provider: 'openai', model: 'gpt-4o',
        tokens_in: 10, tokens_out: 20, latency_ms: 500, cost: 0.001234,
        cached: 0, boosted: 0, session_id: 'sess-1' },
    ]);
    const req = new Request('https://x.test/v1/projects/p1/export.csv');
    const res = await handleExportCsv(req, env, 'p1');
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toContain('text/csv');
    expect(res.headers.get('Content-Disposition')).toContain('clawpipe-p1-');
    const body = await res.text();
    expect(body.split('\n')[0]).toBe('timestamp,provider,model,tokens_in,tokens_out,latency_ms,cost_usd,cached,boosted,session_id');
    expect(body).toContain('openai,gpt-4o');
    expect(body).toContain('0.001234');
  });

  it('honors from/to query params (ISO format)', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const req = new Request('https://x.test/v1/projects/p1/export.csv?from=2026-01-01&to=2026-03-31');
    const res = await handleExportCsv(req, mkEnv(), 'p1');
    expect(res.headers.get('Content-Disposition')).toContain('2026-01-01-to-2026-03-31');
  });

  it('falls back to default range when query params malformed', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const req = new Request('https://x.test/v1/projects/p1/export.csv?from=garbage&to=also-bad');
    const res = await handleExportCsv(req, mkEnv(), 'p1');
    // Filename pattern: clawpipe-p1-YYYY-MM-DD-to-YYYY-MM-DD.csv
    expect(res.headers.get('Content-Disposition')).toMatch(/clawpipe-p1-\d{4}-\d{2}-\d{2}-to-\d{4}-\d{2}-\d{2}\.csv/);
  });
});

describe('routeExport', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(authedUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
  });
  it('GET /v1/projects/:id/export.csv -> handler', async () => {
    const req = new Request('https://x.test/v1/projects/p1/export.csv');
    const res = await routeExport(req, mkEnv(), '/v1/projects/p1/export.csv', 'GET');
    expect(res?.status).toBe(200);
  });
  it('returns null for unrelated path', async () => {
    const req = new Request('https://x.test/v1/prompt');
    const res = await routeExport(req, mkEnv(), '/v1/prompt', 'GET');
    expect(res).toBeNull();
  });
});
