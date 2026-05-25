import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { agentActionsRoutes } from './agent-actions';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const ISSUER = 'https://api.tenantiq.app';
const AUDIENCE = 'tenantiq-api';

const mockKV = { get: vi.fn(), put: vi.fn() };
const mockPrepare = vi.fn();
const mockBind = vi.fn();
const mockAll = vi.fn();
const mockFirst = vi.fn();
const mockDB = { prepare: mockPrepare } as any;
const mockEnv = { DB: mockDB, KV: mockKV as any, JWT_SECRET, ENVIRONMENT: 'test', JWT_ISSUER: ISSUER, JWT_AUDIENCE: AUDIENCE } as any;

async function tokenFor(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setIssuer(ISSUER).setAudience(AUDIENCE).setExpirationTime('1h').sign(secret);
}

describe('agent-actions feed', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/agent-actions', agentActionsRoutes);
		token = await tokenFor({ sub: 'u-1', orgId: 'org-1', email: 'a@b.com' });
		mockPrepare.mockReturnValue({ bind: mockBind });
		mockBind.mockReturnValue({ all: mockAll, first: mockFirst });
	});

	it('rejects unauthenticated', async () => {
		const res = await app.request('/api/agent-actions', {}, mockEnv);
		expect(res.status).toBe(401);
	});

	it('GET / scopes to caller orgId and reshapes rows', async () => {
		mockAll.mockResolvedValueOnce({ results: [
			{ id: 'a-1', org_id: 'org-1', tenant_id: 't-1', agent: 'public-scan', action: 'scan', finding_id: null, severity: 'low', status: 'success', metadata: '{"domain":"acme.com"}', created_at: 1700_000_000_000 },
		] });
		const res = await app.request('/api/agent-actions?since=0&limit=10', {
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		expect(mockBind).toHaveBeenCalledWith('org-1', 0, 10);
		const body = await res.json() as { actions: Array<{ id: string; metadata: { domain: string } | null; at: string }> };
		expect(body.actions).toHaveLength(1);
		expect(body.actions[0].metadata).toEqual({ domain: 'acme.com' });
		expect(body.actions[0].at).toMatch(/^2023-/);
	});

	it('GET /summary returns rollups for the last 24h', async () => {
		mockAll
			.mockResolvedValueOnce({ results: [{ agent: 'public-scan', n: 12 }] })
			.mockResolvedValueOnce({ results: [{ status: 'success', n: 12 }] })
			.mockResolvedValueOnce({ results: [{ severity: 'low', n: 12 }] });
		mockFirst.mockResolvedValueOnce({ n: 12 });
		const res = await app.request('/api/agent-actions/summary', {
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		const body = await res.json() as { total: number; byAgent: { agent: string; n: number }[] };
		expect(body.total).toBe(12);
		expect(body.byAgent[0].agent).toBe('public-scan');
	});

	it('GET /stream rejects without Accept: text/event-stream', async () => {
		const res = await app.request('/api/agent-actions/stream', {
			headers: { Authorization: `Bearer ${token}` },
		}, mockEnv);
		expect(res.status).toBe(406);
	});
});
