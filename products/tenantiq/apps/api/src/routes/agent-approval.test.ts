import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { agentApprovalRoutes } from './agent-approval';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const ISSUER = 'https://api.tenantiq.app';
const AUDIENCE = 'tenantiq-api';

const mockKV = { get: vi.fn(), put: vi.fn() };
const mockPrepare = vi.fn();
const mockBind = vi.fn();
const mockFirst = vi.fn();
const mockRun = vi.fn().mockResolvedValue({});
const mockQueueSend = vi.fn().mockResolvedValue(undefined);
const mockDB = { prepare: mockPrepare } as any;
const mockEnv = {
	DB: mockDB, KV: mockKV as any, JWT_SECRET, ENVIRONMENT: 'test',
	JWT_ISSUER: ISSUER, JWT_AUDIENCE: AUDIENCE,
	REMEDIATION_QUEUE: { send: mockQueueSend } as any,
} as any;

async function tokenFor(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setIssuer(ISSUER).setAudience(AUDIENCE).setExpirationTime('1h').sign(secret);
}

const PENDING = {
	id: 'a-1', org_id: 'org-1', tenant_id: 't-1',
	agent: 'auto-remediator', action: 'fix-applied', finding_id: 'drift-1',
	severity: 'high', status: 'pending-approval',
	metadata: JSON.stringify({ recipeId: 'ca-block-legacy-auth-reverted', dryRun: true }),
};

describe('agent approval', () => {
	let app: Hono<AppEnv>;
	let adminToken: string;
	let viewerToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/agent-actions', agentApprovalRoutes);
		adminToken = await tokenFor({ sub: 'u-1', orgId: 'org-1', role: 'admin', email: 'admin@b.com' });
		viewerToken = await tokenFor({ sub: 'u-2', orgId: 'org-1', role: 'viewer' });
		mockPrepare.mockReturnValue({ bind: mockBind });
		mockBind.mockReturnValue({ first: mockFirst, run: mockRun });
	});

	it('approve refuses non-admin role', async () => {
		const res = await app.request('/api/agent-actions/a-1/approve', {
			method: 'POST',
			headers: { Authorization: `Bearer ${viewerToken}` },
		}, mockEnv);
		expect(res.status).toBe(403);
	});

	it('approve 404s when row not found or not pending', async () => {
		mockFirst.mockResolvedValueOnce(null);
		const res = await app.request('/api/agent-actions/missing/approve', {
			method: 'POST',
			headers: { Authorization: `Bearer ${adminToken}` },
		}, mockEnv);
		expect(res.status).toBe(404);
	});

	it('approve re-enqueues with dryRun=false and writes an approved log row', async () => {
		mockFirst.mockResolvedValueOnce(PENDING);
		const res = await app.request('/api/agent-actions/a-1/approve', {
			method: 'POST',
			headers: { Authorization: `Bearer ${adminToken}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		expect(mockQueueSend).toHaveBeenCalledTimes(1);
		const enq = mockQueueSend.mock.calls[0][0];
		expect(enq.type).toBe('auto-fix');
		expect(enq.recipeId).toBe('ca-block-legacy-auth-reverted');
		expect(enq.dryRun).toBe(false);
		// Insert into agent_actions for the 'approved' status
		const inserts = mockPrepare.mock.calls.filter((c) => String(c[0]).startsWith('INSERT INTO agent_actions'));
		expect(inserts.length).toBe(1);
	});

	it('approve 422s when metadata lacks recipeId', async () => {
		mockFirst.mockResolvedValueOnce({ ...PENDING, metadata: '{}' });
		const res = await app.request('/api/agent-actions/a-1/approve', {
			method: 'POST',
			headers: { Authorization: `Bearer ${adminToken}` },
		}, mockEnv);
		expect(res.status).toBe(422);
	});

	it('abort writes an aborted log row but does NOT enqueue', async () => {
		mockFirst.mockResolvedValueOnce(PENDING);
		const res = await app.request('/api/agent-actions/a-1/abort', {
			method: 'POST',
			headers: { Authorization: `Bearer ${adminToken}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		expect(mockQueueSend).not.toHaveBeenCalled();
		const inserts = mockPrepare.mock.calls.filter((c) => String(c[0]).startsWith('INSERT INTO agent_actions'));
		expect(inserts.length).toBe(1);
	});
});
