import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { mcpKeyRoutes } from './mcp-keys';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const ISSUER = 'https://api.tenantiq.app';
const AUDIENCE = 'tenantiq-api';

const mockKV = { get: vi.fn(), put: vi.fn() };
const mockPrepare = vi.fn();
const mockBind = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn().mockResolvedValue({});
const mockDB = { prepare: mockPrepare } as any;

const mockEnv = { DB: mockDB, KV: mockKV as any, JWT_SECRET, ENVIRONMENT: 'test', JWT_ISSUER: ISSUER, JWT_AUDIENCE: AUDIENCE } as any;

async function tokenFor(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setIssuer(ISSUER).setAudience(AUDIENCE).setExpirationTime('1h')
		.sign(secret);
}

describe('MCP API keys', () => {
	let app: Hono<AppEnv>;
	let adminToken: string;
	let viewerToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/api/mcp-keys', mcpKeyRoutes);
		adminToken = await tokenFor({ sub: 'u-1', orgId: 'org-1', role: 'admin', email: 'a@b.com' });
		viewerToken = await tokenFor({ sub: 'u-2', orgId: 'org-1', role: 'viewer', email: 'v@b.com' });
		mockPrepare.mockReturnValue({ bind: mockBind });
		mockBind.mockReturnValue({ all: mockAll, run: mockRun, first: vi.fn() });
	});

	it('GET / rejects unauthenticated', async () => {
		const res = await app.request('/api/mcp-keys', {}, mockEnv);
		expect(res.status).toBe(401);
	});

	it('GET / lists keys scoped to caller orgId', async () => {
		mockAll.mockResolvedValueOnce({ results: [
			{ id: 'k-1', org_id: 'org-1', user_id: 'u-1', label: 'Claude', prefix: 'tiq_abc1234', last_used_at: null, revoked_at: null, created_at: Date.now() },
		] });
		const res = await app.request('/api/mcp-keys', {
			headers: { Authorization: `Bearer ${adminToken}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		expect(mockBind).toHaveBeenCalledWith('org-1');
		const body = await res.json() as { keys: Array<{ label: string; active: boolean }> };
		expect(body.keys).toHaveLength(1);
		expect(body.keys[0].active).toBe(true);
	});

	it('POST / refuses non-admin role', async () => {
		const res = await app.request('/api/mcp-keys', {
			method: 'POST',
			headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ label: 'Claude' }),
		}, mockEnv);
		expect(res.status).toBe(403);
	});

	it('POST / mints a tiq_-prefixed plaintext key once and stores hash', async () => {
		const res = await app.request('/api/mcp-keys', {
			method: 'POST',
			headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ label: 'Claude Desktop' }),
		}, mockEnv);
		expect(res.status).toBe(201);
		const body = await res.json() as { plaintext: string; prefix: string; label: string };
		expect(body.plaintext).toMatch(/^tiq_/);
		expect(body.plaintext.length).toBeGreaterThan(20);
		expect(body.prefix).toBe(body.plaintext.slice(0, 12));
		expect(body.label).toBe('Claude Desktop');
		// Insert was called with the orgId, and the bound key_hash is NOT the plaintext
		const insertCall = mockBind.mock.calls.find((args) => args.includes('org-1'));
		expect(insertCall).toBeDefined();
		const hash = insertCall![4];
		expect(hash).not.toBe(body.plaintext);
		expect(hash.length).toBe(64); // SHA-256 hex
	});

	it('POST / rejects empty label', async () => {
		const res = await app.request('/api/mcp-keys', {
			method: 'POST',
			headers: { Authorization: `Bearer ${adminToken}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ label: '   ' }),
		}, mockEnv);
		expect(res.status).toBe(400);
	});

	it('DELETE /:id refuses non-admin role', async () => {
		const res = await app.request('/api/mcp-keys/k-1', {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${viewerToken}` },
		}, mockEnv);
		expect(res.status).toBe(403);
	});

	it('DELETE /:id sets revoked_at scoped to org', async () => {
		const res = await app.request('/api/mcp-keys/k-1', {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${adminToken}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		const updateCall = mockPrepare.mock.calls.find((c) => String(c[0]).startsWith('UPDATE mcp_api_keys'));
		expect(updateCall).toBeDefined();
		const bindArgs = mockBind.mock.calls.find((args) => args.includes('k-1'));
		expect(bindArgs).toContain('org-1');
	});
});
