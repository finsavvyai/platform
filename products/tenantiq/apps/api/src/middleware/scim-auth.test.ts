import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import {
	scimAuthMiddleware,
	requireScimScope,
	sha256Hex,
	generateScimTokenPlaintext,
} from './scim-auth';

const mockFirst = vi.fn();
const mockRun = vi.fn().mockResolvedValue({ success: true, meta: {} });
const mockBind = vi.fn(() => ({ first: mockFirst, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockEnv = {
	DB: { prepare: mockPrepare },
	ENVIRONMENT: 'test',
} as unknown;

function buildApp() {
	const app = new Hono<AppEnv>();
	app.use('*', scimAuthMiddleware);
	app.get('/whoami', (c) => c.json({ orgId: c.get('scimOrgId'), scopes: c.get('scimScopes') }));
	app.get('/users', requireScimScope('users:read'), (c) => c.json({ ok: true }));
	return app;
}

async function request(app: Hono<AppEnv>, path: string, headers: Record<string, string> = {}) {
	const req = new Request(`http://localhost${path}`, { method: 'GET', headers });
	return app.fetch(req, mockEnv as never, { waitUntil: () => {}, passThroughOnException: () => {} } as any);
}

describe('scimAuthMiddleware', () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it('rejects missing Authorization header', async () => {
		const res = await request(buildApp(), '/whoami');
		expect(res.status).toBe(401);
		const body = await res.json() as { detail: string };
		expect(body.detail).toBe('Missing Bearer token');
	});

	it('rejects non-Bearer scheme', async () => {
		const res = await request(buildApp(), '/whoami', { Authorization: 'Basic abc' });
		expect(res.status).toBe(401);
	});

	it('rejects empty Bearer token', async () => {
		const res = await request(buildApp(), '/whoami', { Authorization: 'Bearer ' });
		expect(res.status).toBe(401);
	});

	it('rejects unknown token', async () => {
		mockFirst.mockResolvedValueOnce(null);
		const res = await request(buildApp(), '/whoami', { Authorization: 'Bearer notreal' });
		expect(res.status).toBe(401);
		const body = await res.json() as { detail: string };
		expect(body.detail).toBe('Invalid token');
	});

	it('rejects revoked token', async () => {
		mockFirst.mockResolvedValueOnce({
			id: 't1', org_id: 'o1', scopes_json: '["users:read"]', revoked_at: 1234,
		});
		const res = await request(buildApp(), '/whoami', { Authorization: 'Bearer revoked' });
		expect(res.status).toBe(401);
		const body = await res.json() as { detail: string };
		expect(body.detail).toBe('Token revoked');
	});

	it('accepts valid token + sets context', async () => {
		mockFirst.mockResolvedValueOnce({
			id: 't1', org_id: 'org-42', scopes_json: '["users:read","groups:read"]', revoked_at: null,
		});
		const res = await request(buildApp(), '/whoami', { Authorization: 'Bearer valid-token' });
		expect(res.status).toBe(200);
		const body = await res.json() as { orgId: string; scopes: string[] };
		expect(body.orgId).toBe('org-42');
		expect(body.scopes).toEqual(['users:read', 'groups:read']);
	});

	it('looks up by sha256 hash, not plaintext', async () => {
		const plaintext = 'super-secret';
		const expectedHash = await sha256Hex(plaintext);
		mockFirst.mockResolvedValueOnce({
			id: 't1', org_id: 'o1', scopes_json: '["users:read"]', revoked_at: null,
		});
		await request(buildApp(), '/whoami', { Authorization: `Bearer ${plaintext}` });
		expect(mockBind).toHaveBeenCalledWith(expectedHash);
	});

	it('rejects malformed scopes JSON', async () => {
		mockFirst.mockResolvedValueOnce({
			id: 't1', org_id: 'o1', scopes_json: 'not-json{', revoked_at: null,
		});
		const res = await request(buildApp(), '/whoami', { Authorization: 'Bearer t' });
		expect(res.status).toBe(401);
	});
});

describe('requireScimScope', () => {
	beforeEach(() => vi.clearAllMocks());

	it('passes when scope present', async () => {
		mockFirst.mockResolvedValueOnce({
			id: 't1', org_id: 'o1', scopes_json: '["users:read"]', revoked_at: null,
		});
		const res = await request(buildApp(), '/users', { Authorization: 'Bearer t' });
		expect(res.status).toBe(200);
	});

	it('returns 403 when scope missing', async () => {
		mockFirst.mockResolvedValueOnce({
			id: 't1', org_id: 'o1', scopes_json: '["groups:read"]', revoked_at: null,
		});
		const res = await request(buildApp(), '/users', { Authorization: 'Bearer t' });
		expect(res.status).toBe(403);
	});
});

describe('helpers', () => {
	it('sha256Hex produces 64-char hex', async () => {
		const h = await sha256Hex('hello');
		expect(h).toMatch(/^[0-9a-f]{64}$/);
	});

	it('generateScimTokenPlaintext returns prefix + 128 hex chars', () => {
		const t = generateScimTokenPlaintext();
		expect(t.startsWith('tiq_scim_')).toBe(true);
		expect(t.length).toBe('tiq_scim_'.length + 128);
		expect(t.slice('tiq_scim_'.length)).toMatch(/^[0-9a-f]{128}$/);
	});

	it('generates unique tokens per call', () => {
		const a = generateScimTokenPlaintext();
		const b = generateScimTokenPlaintext();
		expect(a).not.toBe(b);
	});
});
