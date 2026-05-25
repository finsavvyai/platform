import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { rollbackRoutes } from './remediation-rollback';

let queryResults: unknown[];
const mockDbChain: any = {};
for (const m of ['select', 'from', 'where', 'limit', 'update', 'set', 'insert', 'values']) {
	mockDbChain[m] = vi.fn(() => mockDbChain);
}
Object.defineProperty(mockDbChain, 'then', {
	get() { return (resolve: any) => resolve(queryResults.shift() ?? []); },
	configurable: true,
});

vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => ({})), and: vi.fn(() => ({})) }));
vi.mock('../lib/db', () => ({
	getDb: () => mockDbChain,
	schema: {
		remediations: {
			id: {}, tenantId: {}, status: {}, canRollback: {},
			actionType: {}, rollbackData: {}, rolledBackBy: {},
		},
	},
}));

vi.mock('@tenantiq/remediation', () => ({
	createRollbackPlan: vi.fn(() => ({ steps: [] })),
	isRollbackSupported: vi.fn(() => true),
	getIrreversibleReason: vi.fn(() => null),
}));

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = { get: vi.fn(), put: vi.fn() };
const mockQueueSend = vi.fn();
const mockEnv = {
	DB: {} as any, KV: mockKV as any, JWT_SECRET,
	REMEDIATION_QUEUE: { send: mockQueueSend } as any,
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

const completedRemediation = {
	id: 'rem-1', tenantId: 't1', status: 'completed',
	canRollback: true, actionType: 'disable_user',
	rollbackData: JSON.stringify({ beforeState: { enabled: true }, afterState: { enabled: false } }),
};

describe('Remediation Rollback Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		queryResults = [];
		app = new Hono<AppEnv>();
		app.route('/api/remediations', rollbackRoutes);
		token = await createToken({
			sub: 'u1', email: 'admin@test.com', tenantIds: ['t1'], role: 'admin',
		});
		mockKV.get.mockResolvedValue(null);
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('POST /api/remediations/:remediationId/rollback', () => {
		it('queues rollback for completed remediation', async () => {
			queryResults = [[completedRemediation], undefined];
			const res = await app.request('/api/remediations/rem-1/rollback', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.success).toBe(true);
			expect(json.status).toBe('rollback_pending');
			expect(mockQueueSend).toHaveBeenCalledTimes(1);
			expect(mockQueueSend.mock.calls[0][0].type).toBe('rollback');
		});

		it('returns 404 when remediation not found', async () => {
			queryResults = [[]];
			const res = await app.request('/api/remediations/rem-999/rollback', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(404);
		});

		it('returns 400 when remediation cannot be rolled back', async () => {
			queryResults = [[{ ...completedRemediation, canRollback: false }]];
			const res = await app.request('/api/remediations/rem-1/rollback', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(400);
		});

		it('returns 400 when remediation is not completed', async () => {
			queryResults = [[{ ...completedRemediation, status: 'pending' }]];
			const res = await app.request('/api/remediations/rem-1/rollback', {
				method: 'POST',
				headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);

			expect(res.status).toBe(400);
		});

		it('requires authentication', async () => {
			const res = await app.request('/api/remediations/rem-1/rollback', {
				method: 'POST',
			}, mockEnv);

			expect(res.status).toBe(401);
		});
	});
});
