import { Hono } from 'hono';
import * as jose from 'jose';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../index';
import { mcpExternalRoutes } from './mcp-external';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const ISSUER = 'https://api.tenantiq.app';
const AUDIENCE = 'tenantiq-api';

const kvStore = new Map<string, string>();
const mockKV = {
	get: vi.fn((k: string, fmt?: string) => {
		const v = kvStore.get(k);
		if (!v) return Promise.resolve(null);
		return Promise.resolve(fmt === 'json' ? JSON.parse(v) : v);
	}),
	put: vi.fn((k: string, v: string) => { kvStore.set(k, v); return Promise.resolve(); }),
};
const mockPrepare = vi.fn();
const mockBind = vi.fn();
const mockRun = vi.fn().mockResolvedValue({});
const mockDB = { prepare: mockPrepare } as any;
const mockEnv = { DB: mockDB, KV: mockKV as any, JWT_SECRET, ENVIRONMENT: 'test', JWT_ISSUER: ISSUER, JWT_AUDIENCE: AUDIENCE } as any;

async function tokenFor(payload: Record<string, unknown>) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setIssuer(ISSUER).setAudience(AUDIENCE).setExpirationTime('1h').sign(secret);
}

const fetchMock = vi.fn();

describe('MCP external server registry', () => {
	let app: Hono<AppEnv>;
	let admin: string;
	let viewer: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		kvStore.clear();
		app = new Hono<AppEnv>();
		app.route('/api/mcp-external', mcpExternalRoutes);
		admin = await tokenFor({ sub: 'u-1', orgId: 'org-1', role: 'admin' });
		viewer = await tokenFor({ sub: 'u-2', orgId: 'org-1', role: 'viewer' });
		mockPrepare.mockReturnValue({ bind: mockBind });
		mockBind.mockReturnValue({ run: mockRun });
		(globalThis as any).fetch = fetchMock;
	});

	afterEach(() => { delete (globalThis as any).fetch; });

	it('GET / returns empty when no servers registered', async () => {
		const res = await app.request('/api/mcp-external', { headers: { Authorization: `Bearer ${admin}` } }, mockEnv);
		expect(res.status).toBe(200);
		const body = await res.json() as { servers: unknown[] };
		expect(body.servers).toEqual([]);
	});

	it('POST / requires admin', async () => {
		const res = await app.request('/api/mcp-external', {
			method: 'POST',
			headers: { Authorization: `Bearer ${viewer}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'GitHub MCP', url: 'https://example.com/mcp' }),
		}, mockEnv);
		expect(res.status).toBe(403);
	});

	it('POST / validates url scheme', async () => {
		const res = await app.request('/api/mcp-external', {
			method: 'POST',
			headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'Bad', url: 'ftp://nope' }),
		}, mockEnv);
		expect(res.status).toBe(400);
	});

	it('POST → GET round-trip persists the server (sans bearer)', async () => {
		const post = await app.request('/api/mcp-external', {
			method: 'POST',
			headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ name: 'GitHub MCP', url: 'https://example.com/mcp', bearer: 'secret-token' }),
		}, mockEnv);
		expect(post.status).toBe(201);
		const body = await post.json() as { server: { id: string; hasBearer: boolean; name: string } };
		expect(body.server.hasBearer).toBe(true);
		expect(body.server).not.toHaveProperty('bearer');

		const list = await app.request('/api/mcp-external', { headers: { Authorization: `Bearer ${admin}` } }, mockEnv);
		const lb = await list.json() as { servers: { id: string; name: string }[] };
		expect(lb.servers).toHaveLength(1);
		expect(lb.servers[0].name).toBe('GitHub MCP');
	});

	it('POST /tools/call forwards JSON-RPC and returns content', async () => {
		// Seed a server
		kvStore.set('mcp:external:org-1', JSON.stringify([
			{ id: 's-1', name: 'X', url: 'https://example.com/mcp', enabled: true },
		]));
		fetchMock.mockResolvedValueOnce(new Response(JSON.stringify({
			jsonrpc: '2.0', id: 'r1', result: { content: [{ type: 'text', text: 'hello from remote' }] },
		}), { status: 200, headers: { 'content-type': 'application/json' } }));

		const res = await app.request('/api/mcp-external/tools/call', {
			method: 'POST',
			headers: { Authorization: `Bearer ${admin}`, 'Content-Type': 'application/json' },
			body: JSON.stringify({ serverId: 's-1', tool: 'noop', arguments: {} }),
		}, mockEnv);
		expect(res.status).toBe(200);
		const body = await res.json() as { content: { text: string }[] | undefined };
		expect(body.content?.[0].text).toBe('hello from remote');
		expect(fetchMock).toHaveBeenCalledTimes(1);
	});

	it('DELETE /:id removes the server', async () => {
		kvStore.set('mcp:external:org-1', JSON.stringify([
			{ id: 's-1', name: 'X', url: 'https://x', enabled: true },
		]));
		const res = await app.request('/api/mcp-external/s-1', {
			method: 'DELETE',
			headers: { Authorization: `Bearer ${admin}` },
		}, mockEnv);
		expect(res.status).toBe(200);
		const after = JSON.parse(kvStore.get('mcp:external:org-1')!) as unknown[];
		expect(after).toHaveLength(0);
	});
});
