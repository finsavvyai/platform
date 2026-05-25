/** @vitest-environment node */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleGetAuditEvents, routeAuditEvents } from './audit-events-routes';
import type { Env } from './types';

vi.mock('./auth/rbac', () => ({
  getAuthUser: vi.fn(),
  checkProjectAccess: vi.fn(),
}));
vi.mock('./audit-events', () => ({
  readAuditEvents: vi.fn(),
}));

import { getAuthUser, checkProjectAccess } from './auth/rbac';
import { readAuditEvents } from './audit-events';

const adminUser = { sub: 'u1', email: 'a@b.test', name: 'Alice', iat: 0, exp: 0 };
const mkEnv = (): Env => ({} as Env);

function makeReq(url: string = 'https://x.test/v1/projects/p1/audit/events'): Request {
  return new Request(url);
}

beforeEach(() => {
  vi.mocked(getAuthUser).mockReset();
  vi.mocked(checkProjectAccess).mockReset();
  vi.mocked(readAuditEvents).mockReset();
});

describe('handleGetAuditEvents', () => {
  it('401 when not authenticated', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(null);
    const res = await handleGetAuditEvents(makeReq(), mkEnv(), 'p1');
    expect(res.status).toBe(401);
  });

  it('403 when not admin', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(false);
    const res = await handleGetAuditEvents(makeReq(), mkEnv(), 'p1');
    expect(res.status).toBe(403);
  });

  it('200 returns events + nextCursor', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const fakeEvents = [
      { id: '1', project_id: 'p1', actor_user_id: 'u1', action: 'apikey.rotate', target: null, metadata: null, created_at: '2026-01-01 10:00:00' },
      { id: '2', project_id: 'p1', actor_user_id: 'u1', action: 'budget.cap.changed', target: null, metadata: null, created_at: '2026-01-01 09:00:00' },
    ];
    vi.mocked(readAuditEvents).mockResolvedValue(fakeEvents);
    const res = await handleGetAuditEvents(makeReq(), mkEnv(), 'p1');
    expect(res.status).toBe(200);
    const body = await res.json() as { events: unknown[]; nextCursor: string | null };
    expect(body.events).toHaveLength(2);
    expect(body.nextCursor).toBe('2026-01-01 09:00:00');
  });

  it('nextCursor is null when no events', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    vi.mocked(readAuditEvents).mockResolvedValue([]);
    const res = await handleGetAuditEvents(makeReq(), mkEnv(), 'p1');
    const body = await res.json() as { events: unknown[]; nextCursor: string | null };
    expect(body.nextCursor).toBeNull();
  });

  it('passes since + action + limit from query params', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    vi.mocked(readAuditEvents).mockResolvedValue([]);
    const url = 'https://x.test/v1/projects/p1/audit/events?since=2026-01-01+00%3A00%3A00&action=apikey.rotate&limit=10';
    await handleGetAuditEvents(new Request(url), mkEnv(), 'p1');
    expect(readAuditEvents).toHaveBeenCalledWith(
      expect.anything(), 'p1',
      expect.objectContaining({ since: '2026-01-01 00:00:00', action: 'apikey.rotate', limit: 10 }),
    );
  });

  it('pagination: subsequent page uses since cursor', async () => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    const page2Events = [
      { id: '3', project_id: 'p1', actor_user_id: null, action: 'member.joined', target: null, metadata: null, created_at: '2026-01-01 08:00:00' },
    ];
    vi.mocked(readAuditEvents).mockResolvedValue(page2Events);
    const url = 'https://x.test/v1/projects/p1/audit/events?since=2026-01-01+09%3A00%3A00';
    const res = await handleGetAuditEvents(new Request(url), mkEnv(), 'p1');
    const body = await res.json() as { events: unknown[]; nextCursor: string | null };
    expect(body.events).toHaveLength(1);
    expect(body.nextCursor).toBe('2026-01-01 08:00:00');
  });
});

describe('routeAuditEvents', () => {
  beforeEach(() => {
    vi.mocked(getAuthUser).mockResolvedValue(adminUser);
    vi.mocked(checkProjectAccess).mockResolvedValue(true);
    vi.mocked(readAuditEvents).mockResolvedValue([]);
  });

  it('GET /v1/projects/:id/audit/events -> 200', async () => {
    const res = await routeAuditEvents(makeReq(), mkEnv(), '/v1/projects/p1/audit/events', 'GET');
    expect(res?.status).toBe(200);
  });

  it('POST returns null (not matched)', async () => {
    const res = await routeAuditEvents(makeReq(), mkEnv(), '/v1/projects/p1/audit/events', 'POST');
    expect(res).toBeNull();
  });

  it('unrelated path returns null', async () => {
    const res = await routeAuditEvents(makeReq(), mkEnv(), '/v1/prompt', 'GET');
    expect(res).toBeNull();
  });
});
