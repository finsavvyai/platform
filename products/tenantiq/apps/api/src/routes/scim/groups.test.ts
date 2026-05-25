import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../../app/types';
import { scimGroupsRoutes } from './groups';

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
	app.route('/scim/v2/Groups', scimGroupsRoutes);
	return app;
}

async function call(method: string, path: string, body?: unknown) {
	const init: RequestInit = {
		method,
		headers: { Authorization: 'Bearer t', 'Content-Type': 'application/scim+json' },
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

describe('GET /scim/v2/Groups', () => {
	it('lists groups with empty members for each', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce({ n: 1 });
		mockAll.mockResolvedValueOnce({
			results: [{ id: 'g1', org_id: 'org-1', display_name: 'Eng', external_id: null, created_at: 1, updated_at: 1 }],
		});
		mockAll.mockResolvedValueOnce({ results: [] }); // members for g1
		const res = await call('GET', '/scim/v2/Groups');
		expect(res.status).toBe(200);
		const body = await res.json() as { totalResults: number; Resources: Array<{ members: unknown[] }> };
		expect(body.totalResults).toBe(1);
		expect(body.Resources[0].members).toEqual([]);
	});

	it('rejects unsupported filter attribute', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		const res = await call('GET', '/scim/v2/Groups?filter=members%20eq%20%22u1%22');
		expect(res.status).toBe(400);
	});
});

describe('GET /scim/v2/Groups/:id', () => {
	it('returns 404 when missing', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce(null);
		const res = await call('GET', '/scim/v2/Groups/missing');
		expect(res.status).toBe(404);
	});

	it('returns group with hydrated members', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce({ id: 'g1', org_id: 'org-1', display_name: 'Eng', external_id: null, created_at: 1, updated_at: 1 });
		mockAll.mockResolvedValueOnce({ results: [{ id: 'u1', email: 'a@x.com' }] });
		const res = await call('GET', '/scim/v2/Groups/g1');
		expect(res.status).toBe(200);
		const body = await res.json() as { displayName: string; members: Array<{ value: string }> };
		expect(body.displayName).toBe('Eng');
		expect(body.members[0].value).toBe('u1');
	});
});

describe('POST /scim/v2/Groups', () => {
	it('rejects missing displayName', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		const res = await call('POST', '/scim/v2/Groups', {});
		expect(res.status).toBe(400);
	});

	it('creates group and returns 201', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockAll.mockResolvedValueOnce({ results: [] }); // members on response
		const res = await call('POST', '/scim/v2/Groups', { displayName: 'Eng' });
		expect(res.status).toBe(201);
		const body = await res.json() as { displayName: string };
		expect(body.displayName).toBe('Eng');
	});

	it('persists initial members on create', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockAll.mockResolvedValueOnce({ results: [{ id: 'u1', email: 'a@x.com' }] });
		const res = await call('POST', '/scim/v2/Groups', {
			displayName: 'Eng', members: [{ value: 'u1' }, { value: 'u2' }],
		});
		expect(res.status).toBe(201);
		const insertCalls = mockPrepare.mock.calls.filter((c) =>
			(c[0] as string).includes('INSERT OR IGNORE INTO platform_group_members'),
		);
		expect(insertCalls.length).toBe(2);
	});
});

describe('PATCH /scim/v2/Groups/:id', () => {
	it('rejects empty Operations', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce({ id: 'g1' });
		const res = await call('PATCH', '/scim/v2/Groups/g1', { Operations: [] });
		expect(res.status).toBe(400);
	});

	it('returns 404 when group missing', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce(null); // exists check
		const res = await call('PATCH', '/scim/v2/Groups/missing', {
			Operations: [{ op: 'replace', path: 'displayName', value: 'x' }],
		});
		expect(res.status).toBe(404);
	});

	it('replaces displayName', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce({ id: 'g1' });
		mockFirst.mockResolvedValueOnce({ id: 'g1', org_id: 'org-1', display_name: 'New', external_id: null, created_at: 1, updated_at: 2 });
		mockAll.mockResolvedValueOnce({ results: [] });
		const res = await call('PATCH', '/scim/v2/Groups/g1', {
			Operations: [{ op: 'replace', path: 'displayName', value: 'New' }],
		});
		expect(res.status).toBe(200);
		const body = await res.json() as { displayName: string };
		expect(body.displayName).toBe('New');
	});

	it('removes member via filter path', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockFirst.mockResolvedValueOnce({ id: 'g1' });
		mockFirst.mockResolvedValueOnce({ id: 'g1', org_id: 'org-1', display_name: 'Eng', external_id: null, created_at: 1, updated_at: 1 });
		mockAll.mockResolvedValueOnce({ results: [] });
		const res = await call('PATCH', '/scim/v2/Groups/g1', {
			Operations: [{ op: 'remove', path: 'members[value eq "u1"]' }],
		});
		expect(res.status).toBe(200);
		const deleteCall = mockBind.mock.calls.find((c) => c[0] === 'g1' && c[1] === 'u1');
		expect(deleteCall).toBeDefined();
	});
});

describe('DELETE /scim/v2/Groups/:id', () => {
	it('returns 204 on success', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 1 } }); // middleware
		mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 1 } }); // route delete groups
		mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 0 } }); // members cleanup
		const res = await call('DELETE', '/scim/v2/Groups/g1');
		expect(res.status).toBe(204);
	});

	it('returns 404 when missing', async () => {
		mockFirst.mockResolvedValueOnce(tokenRow);
		mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 1 } }); // middleware
		mockRun.mockResolvedValueOnce({ success: true, meta: { changes: 0 } }); // route delete
		const res = await call('DELETE', '/scim/v2/Groups/missing');
		expect(res.status).toBe(404);
	});
});
