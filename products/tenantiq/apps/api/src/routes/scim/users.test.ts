import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../app/types';
import { scimUsersRoutes } from './users';

const mockFirst = vi.fn();
const mockAll = vi.fn();
const mockRun = vi.fn().mockResolvedValue({ success: true, meta: { changes: 1 } });
const mockBind = vi.fn(() => ({ first: mockFirst, all: mockAll, run: mockRun }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));

const mockEnv = {
	DB: { prepare: mockPrepare },
	ENVIRONMENT: 'test',
} as unknown;

const tokenRow = {
	id: 't1', org_id: 'org-1',
	scopes_json: '["users:read","users:write","groups:read","groups:write"]',
	revoked_at: null,
};

function buildApp() {
	const app = new Hono<AppEnv>();
	app.route('/scim/v2/Users', scimUsersRoutes);
	return app;
}

async function call(method: string, path: string, body?: unknown) {
	const init: RequestInit = {
		method,
		headers: {
			Authorization: 'Bearer t',
			'Content-Type': 'application/scim+json',
		},
	};
	if (body !== undefined) init.body = JSON.stringify(body);
	const req = new Request(`http://localhost${path}`, init);
	return buildApp().fetch(req, mockEnv as never, {
		waitUntil: () => {}, passThroughOnException: () => {},
	} as any);
}

beforeEach(() => {
	vi.clearAllMocks();
	mockFirst.mockReset();
	mockAll.mockReset();
	mockRun.mockReset().mockResolvedValue({ success: true, meta: { changes: 1 } });
});

describe('GET /scim/v2/Users', () => {
	it('lists users in ListResponse envelope', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow); // token lookup
		mockFirst.mockResolvedValueOnce({ n: 2 }); // count
		mockAll.mockResolvedValueOnce({
			results: [
				{ id: 'u1', organization_id: 'org-1', email: 'a@x.com', display_name: 'A', role: 'admin', status: 'active', last_login_at: null, created_at: 1700000000 },
				{ id: 'u2', organization_id: 'org-1', email: 'b@x.com', display_name: 'B', role: 'member', status: 'active', last_login_at: null, created_at: 1700000001 },
			],
		});
		const res = await call('GET', '/scim/v2/Users');
		expect(res.status).toBe(200);
		const body = await res.json() as { totalResults: number; Resources: unknown[] };
		expect(body.totalResults).toBe(2);
		expect(body.Resources).toHaveLength(2);
	});

	it('parses userName eq filter', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce({ n: 1 });
		mockAll.mockResolvedValueOnce({ results: [{ id: 'u1', organization_id: 'org-1', email: 'alice@x.com', display_name: null, role: 'admin', status: 'active', last_login_at: null, created_at: 1 }] });
		const res = await call('GET', '/scim/v2/Users?filter=userName%20eq%20%22alice%40x.com%22');
		expect(res.status).toBe(200);
		const body = await res.json() as { totalResults: number };
		expect(body.totalResults).toBe(1);
	});

	it('rejects unparseable filter with 400 invalidFilter', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		// Mixed and+or in one filter is unsupported (no parens). T3.2 expanded
		// the parser to accept eq/ne/co/sw/ew/pr + and/or, so the previous
		// test case (`userName co "x"`) now parses successfully.
		const res = await call('GET', '/scim/v2/Users?filter=userName%20eq%20%22a%22%20and%20id%20eq%20%22b%22%20or%20externalId%20eq%20%22c%22');
		expect(res.status).toBe(400);
		const body = await res.json() as { scimType: string };
		expect(body.scimType).toBe('invalidFilter');
	});

	it('rejects unsupported attribute with 400', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		const res = await call('GET', '/scim/v2/Users?filter=password%20eq%20%22x%22');
		expect(res.status).toBe(400);
	});

	it('honors startIndex + count pagination', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce({ n: 100 });
		mockAll.mockResolvedValueOnce({ results: [] });
		await call('GET', '/scim/v2/Users?startIndex=51&count=10');
		const lastBindCall = mockBind.mock.calls.at(-1)!;
		expect(lastBindCall.at(-2)).toBe(10);
		expect(lastBindCall.at(-1)).toBe(50);
	});
});

describe('GET /scim/v2/Users/:id', () => {
	it('returns 404 when not found', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce(null);
		const res = await call('GET', '/scim/v2/Users/missing');
		expect(res.status).toBe(404);
	});

	it('returns user when found', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce({
			id: 'u1', organization_id: 'org-1', email: 'a@x.com', display_name: 'A', role: 'admin', status: 'active', last_login_at: null, created_at: 1,
		});
		const res = await call('GET', '/scim/v2/Users/u1');
		expect(res.status).toBe(200);
		const body = await res.json() as { id: string };
		expect(body.id).toBe('u1');
	});
});

describe('POST /scim/v2/Users', () => {
	it('rejects missing userName', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		const res = await call('POST', '/scim/v2/Users', { displayName: 'foo' });
		expect(res.status).toBe(400);
	});

	it('rejects duplicate userName with 409 uniqueness', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce({ id: 'existing' });
		const res = await call('POST', '/scim/v2/Users', { userName: 'a@x.com' });
		expect(res.status).toBe(409);
		const body = await res.json() as { scimType: string };
		expect(body.scimType).toBe('uniqueness');
	});

	it('creates user and returns 201', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce(null);
		const res = await call('POST', '/scim/v2/Users', {
			userName: 'NewUser@x.com', displayName: 'New', active: true,
		});
		expect(res.status).toBe(201);
		const body = await res.json() as { userName: string };
		expect(body.userName).toBe('newuser@x.com'); // lowercased
	});
});

describe('PATCH /scim/v2/Users/:id', () => {
	it('rejects empty Operations', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		const res = await call('PATCH', '/scim/v2/Users/u1', { Operations: [] });
		expect(res.status).toBe(400);
	});

	it('replaces active=false (deactivation)', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce({
			id: 'u1', organization_id: 'org-1', email: 'a@x.com', display_name: 'A', role: 'admin', status: 'inactive', last_login_at: null, created_at: 1,
		});
		const res = await call('PATCH', '/scim/v2/Users/u1', {
			Operations: [{ op: 'replace', path: 'active', value: false }],
		});
		expect(res.status).toBe(200);
		const updateCall = mockBind.mock.calls.find((c) => c[0] === 'inactive');
		expect(updateCall).toBeDefined();
	});

	it('returns 400 when no supported ops in batch', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		const res = await call('PATCH', '/scim/v2/Users/u1', {
			Operations: [{ op: 'replace', path: 'unknownAttr', value: 'x' }],
		});
		expect(res.status).toBe(400);
	});
});

describe('DELETE /scim/v2/Users/:id', () => {
	it('soft-deletes (sets status=inactive) and returns 204', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		// Two run() calls in sequence: middleware waitUntil(last_used_at), then route DELETE.
		mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 1 } }); // middleware
		mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 1 } }); // route
		const res = await call('DELETE', '/scim/v2/Users/u1');
		expect(res.status).toBe(204);
	});

	it('returns 404 when no row affected', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 1 } }); // middleware
		mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 0 } }); // route
		const res = await call('DELETE', '/scim/v2/Users/missing');
		expect(res.status).toBe(404);
	});
});
