import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';

vi.mock('../lib/workflows/condition-evaluator', () => ({
	evaluateConditions: vi.fn(() => true),
	validateConditionGroup: vi.fn(() => ({ valid: true, errors: [] })),
}));
vi.mock('../lib/event-bridge', () => ({
	matchEvent: vi.fn((event: any, rules: any[]) =>
		rules.filter((r: any) => r.enabled && (r.eventType === event.type || r.eventType === '*'))
	),
}));

import { eventTriggers } from './event-triggers';
import { validateConditionGroup } from '../lib/workflows/condition-evaluator';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const kvStore: Record<string, string> = {};
const mockKV = {
	get: vi.fn((key: string) => Promise.resolve(kvStore[key] ?? null)),
	put: vi.fn((key: string, val: string) => { kvStore[key] = val; return Promise.resolve(); }),
	delete: vi.fn((key: string) => { delete kvStore[key]; return Promise.resolve(); }),
};
const mockEnv = { DB: {} as any, KV: mockKV as any, JWT_SECRET, ENVIRONMENT: 'test' } as any;
const headers = (t: string) => ({ Authorization: `Bearer ${t}`, 'Content-Type': 'application/json' });

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Event Triggers Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;
	let viewerToken: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		Object.keys(kvStore).forEach((k) => delete kvStore[k]);
		app = new Hono<AppEnv>();
		app.route('/event-triggers', eventTriggers);
		token = await createToken({ sub: 'u1', email: 'a@t.com', tenantId: 't1', role: 'admin' });
		viewerToken = await createToken({ sub: 'u2', email: 'v@t.com', tenantId: 't1', role: 'viewer' });
	});

	describe('GET /event-triggers', () => {
		it('returns empty rules list', async () => {
			const res = await app.request('/event-triggers', { method: 'GET', headers: headers(token) }, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.rules).toHaveLength(0);
			expect(json.total).toBe(0);
		});
		it('returns stored rules', async () => {
			kvStore['triggers:t1'] = JSON.stringify([{ id: 'r1', eventType: 'user.created', enabled: true }]);
			const res = await app.request('/event-triggers', { method: 'GET', headers: headers(token) }, mockEnv);
			const json: any = await res.json();
			expect(json.rules).toHaveLength(1);
			expect(json.rules[0].id).toBe('r1');
		});
		it('requires auth', async () => {
			const res = await app.request('/event-triggers', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('POST /event-triggers', () => {
		it('creates a trigger rule', async () => {
			const res = await app.request('/event-triggers', {
				method: 'POST', headers: headers(token),
				body: JSON.stringify({ eventType: 'user.created', resourceType: 'users', workflowId: 'w1' }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.rule.eventType).toBe('user.created');
			expect(json.rule.id).toBeDefined();
		});
		it('rejects invalid eventType', async () => {
			const res = await app.request('/event-triggers', {
				method: 'POST', headers: headers(token),
				body: JSON.stringify({ eventType: 'invalid.type', workflowId: 'w1' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});
		it('rejects missing workflowId', async () => {
			const res = await app.request('/event-triggers', {
				method: 'POST', headers: headers(token),
				body: JSON.stringify({ eventType: 'user.created' }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});
		it('validates conditions', async () => {
			vi.mocked(validateConditionGroup).mockReturnValueOnce({ valid: false, errors: ['bad'] });
			const res = await app.request('/event-triggers', {
				method: 'POST', headers: headers(token),
				body: JSON.stringify({ eventType: 'user.created', workflowId: 'w1', conditions: { logic: 'bad', conditions: [] } }),
			}, mockEnv);
			expect(res.status).toBe(400);
		});
		it('rejects viewer role', async () => {
			const res = await app.request('/event-triggers', {
				method: 'POST', headers: headers(viewerToken),
				body: JSON.stringify({ eventType: 'user.created', workflowId: 'w1' }),
			}, mockEnv);
			expect(res.status).toBe(403);
		});
	});

	describe('PATCH /event-triggers/:id', () => {
		it('updates a trigger rule', async () => {
			kvStore['triggers:t1'] = JSON.stringify([
				{ id: 'r1', eventType: 'user.created', enabled: true, workflowId: 'w1', resourceType: '*', createdAt: '2026-01-01' },
			]);
			const res = await app.request('/event-triggers/r1', {
				method: 'PATCH', headers: headers(token), body: JSON.stringify({ enabled: false }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.rule.enabled).toBe(false);
		});
		it('returns 404 for unknown rule', async () => {
			kvStore['triggers:t1'] = JSON.stringify([]);
			const res = await app.request('/event-triggers/missing', {
				method: 'PATCH', headers: headers(token), body: JSON.stringify({ enabled: false }),
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('DELETE /event-triggers/:id', () => {
		it('deletes a trigger rule', async () => {
			kvStore['triggers:t1'] = JSON.stringify([{ id: 'r1', eventType: 'user.created' }]);
			const res = await app.request('/event-triggers/r1', { method: 'DELETE', headers: headers(token) }, mockEnv);
			expect(res.status).toBe(200);
			const stored = JSON.parse(kvStore['triggers:t1']);
			expect(stored).toHaveLength(0);
		});
		it('returns 404 for unknown rule', async () => {
			kvStore['triggers:t1'] = JSON.stringify([]);
			const res = await app.request('/event-triggers/missing', { method: 'DELETE', headers: headers(token) }, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('POST /event-triggers/test', () => {
		it('tests a rule against sample event', async () => {
			kvStore['triggers:t1'] = JSON.stringify([
				{ id: 'r1', eventType: 'user.created', resourceType: '*', workflowId: 'w1', enabled: true },
			]);
			const res = await app.request('/event-triggers/test', {
				method: 'POST', headers: headers(token),
				body: JSON.stringify({ sampleEvent: { type: 'user.created', resource: '/users', data: { name: 'Test' } } }),
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.wouldTrigger).toBe(true);
			expect(json.matchedRules).toBe(1);
		});
		it('returns false when no rules match', async () => {
			kvStore['triggers:t1'] = JSON.stringify([
				{ id: 'r1', eventType: 'group.deleted', resourceType: '*', workflowId: 'w1', enabled: true },
			]);
			const res = await app.request('/event-triggers/test', {
				method: 'POST', headers: headers(token),
				body: JSON.stringify({ sampleEvent: { type: 'user.created', resource: '/users', data: {} } }),
			}, mockEnv);
			const json: any = await res.json();
			expect(json.wouldTrigger).toBe(false);
		});
	});
});
