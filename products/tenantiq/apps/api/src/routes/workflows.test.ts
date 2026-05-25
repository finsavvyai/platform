import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';

let queryResults: any[];

const chainMethods = ['select', 'from', 'where', 'orderBy', 'limit', 'insert', 'values'];
const mockDbChain: any = {};
for (const method of chainMethods) {
	mockDbChain[method] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() {
		return (resolve: any) => resolve(queryResults.shift() ?? []);
	},
	configurable: true,
});

vi.mock('drizzle-orm', () => ({
	eq: vi.fn(() => ({})),
	and: vi.fn((..._a: any[]) => ({})),
	desc: vi.fn(() => ({})),
}));

vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		workflows: {
			id: {}, tenantId: {}, name: {}, type: {}, schedule: {},
			enabled: {}, parameters: {}, conditions: {}, createdAt: {},
			updatedAt: {}, createdBy: {},
		},
		workflowExecutions: {
			workflowId: {}, startedAt: {},
		},
	},
}));

import workflows from './workflows';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockEnv = {
	DB: {} as any,
	KV: mockKV as any,
	JWT_SECRET,
	ENVIRONMENT: 'test',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Workflows Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/workflows', workflows);
		token = await createToken({
			sub: 'u1', email: 'a@t.com', tenantId: 't1', role: 'admin',
		});
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /workflows', () => {
		it('returns workflow list', async () => {
			queryResults = [[{ id: 'w1', name: 'Backup', type: 'scheduled' }]];

			const res = await app.request('/workflows', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.workflows).toHaveLength(1);
			expect(json.workflows[0].name).toBe('Backup');
		});

		it('returns empty array when no workflows', async () => {
			queryResults = [[]];
			const res = await app.request('/workflows', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.workflows).toHaveLength(0);
		});

		it('requires auth', async () => {
			const res = await app.request('/workflows', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /workflows/:workflowId', () => {
		it('returns workflow with executions', async () => {
			queryResults = [
				[{ id: 'w1', name: 'Backup', type: 'scheduled' }],
				[{ id: 'e1', workflowId: 'w1', status: 'completed' }],
			];

			const res = await app.request('/workflows/w1', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.workflow.id).toBe('w1');
			expect(json.executions).toHaveLength(1);
		});

		it('returns 404 for unknown workflow', async () => {
			queryResults = [[]];
			const res = await app.request('/workflows/missing', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('POST /workflows', () => {
		it('creates workflow as admin', async () => {
			queryResults = [undefined];
			const res = await app.request('/workflows', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'New WF', type: 'compliance_scan' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.message).toBe('Workflow created successfully');
			expect(json.workflowId).toBeDefined();
		});

		it('rejects viewer role', async () => {
			const viewerToken = await createToken({
				sub: 'u2', email: 'v@t.com', tenantId: 't1', role: 'viewer',
			});
			const res = await app.request('/workflows', {
				method: 'POST',
				headers: { Authorization: `Bearer ${viewerToken}`, 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'WF', type: 'scan' }),
			}, mockEnv);
			expect(res.status).toBe(403);
		});

		it('requires auth', async () => {
			const res = await app.request('/workflows', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({ name: 'WF', type: 'scan' }),
			}, mockEnv);
			expect(res.status).toBe(401);
		});
	});
});
