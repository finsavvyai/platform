import { Hono } from 'hono';
import * as jose from 'jose';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import type { StoredEvent } from '../lib/event-store';

const mockEvents: StoredEvent[] = [
	{
		id: 'ev1', eventType: 'user.created', resourceType: 'users',
		receivedAt: '2026-03-01T00:00:00Z', status: 'processed',
		triggeredWorkflows: ['w1'], processingTime: 45,
		payload: { resourceId: 'u1', changeType: 'created' },
	},
	{
		id: 'ev2', eventType: 'security.alert', resourceType: 'security',
		receivedAt: '2026-03-02T00:00:00Z', status: 'failed',
		triggeredWorkflows: [], processingTime: 120, error: 'Queue unavailable',
	},
];

vi.mock('../lib/event-store', () => ({
	getEvents: vi.fn((_env: any, _tid: string, filters: any) => {
		let events = [...mockEvents];
		if (filters.eventType) events = events.filter((e) => e.eventType === filters.eventType);
		if (filters.status) events = events.filter((e) => e.status === filters.status);
		return Promise.resolve(events.slice(0, filters.limit ?? 50));
	}),
	getEventById: vi.fn((_env: any, _tid: string, id: string) =>
		Promise.resolve(mockEvents.find((e) => e.id === id) ?? null)
	),
	getEventStats: vi.fn(() => Promise.resolve({
		totalEvents: 2, byType: [{ type: 'user.created', count: 1 }, { type: 'security.alert', count: 1 }],
		avgProcessingTime: 82, errorRate: 0.5,
	})),
}));

vi.mock('../lib/event-bridge', () => ({
	processEvent: vi.fn(() => Promise.resolve({ triggeredWorkflows: ['w1'] })),
}));

import { eventLog } from './event-log';

const JWT_SECRET = 'test-jwt-secret-key-minimum-32-characters-long';
const mockKV = {
	get: vi.fn(() => Promise.resolve(null)),
	put: vi.fn(() => Promise.resolve()),
	delete: vi.fn(() => Promise.resolve()),
};
const mockQueue = { send: vi.fn(() => Promise.resolve()) };
const mockEnv = {
	DB: {} as any, KV: mockKV as any, SCAN_QUEUE: mockQueue as any,
	JWT_SECRET, ENVIRONMENT: 'test',
} as any;

async function createToken(payload: any) {
	const secret = new TextEncoder().encode(JWT_SECRET);
	return new jose.SignJWT(payload)
		.setProtectedHeader({ alg: 'HS256' })
		.setIssuedAt().setExpirationTime('1h').sign(secret);
}

describe('Event Log Routes', () => {
	let app: Hono<AppEnv>;
	let token: string;

	beforeEach(async () => {
		vi.clearAllMocks();
		app = new Hono<AppEnv>();
		app.route('/events', eventLog);
		token = await createToken({ sub: 'u1', email: 'a@t.com', tenantId: 't1', role: 'admin' });
		mockKV.get.mockResolvedValue('0');
		mockKV.put.mockResolvedValue(undefined);
	});

	describe('GET /events/log', () => {
		it('returns event list', async () => {
			const res = await app.request('/events/log', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.events).toHaveLength(2);
			expect(json.events[0]).not.toHaveProperty('payload');
		});

		it('filters by eventType', async () => {
			const res = await app.request('/events/log?eventType=user.created', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			const json: any = await res.json();
			expect(json.events).toHaveLength(1);
			expect(json.events[0].eventType).toBe('user.created');
		});

		it('filters by status', async () => {
			const res = await app.request('/events/log?status=failed', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			const json: any = await res.json();
			expect(json.events).toHaveLength(1);
			expect(json.events[0].status).toBe('failed');
		});

		it('requires auth', async () => {
			const res = await app.request('/events/log', { method: 'GET' }, mockEnv);
			expect(res.status).toBe(401);
		});
	});

	describe('GET /events/log/:id', () => {
		it('returns event detail with payload', async () => {
			const res = await app.request('/events/log/ev1', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.event.id).toBe('ev1');
			expect(json.event.payload).toBeDefined();
		});

		it('returns 404 for unknown event', async () => {
			const res = await app.request('/events/log/missing', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});

	describe('GET /events/stats', () => {
		it('returns event statistics', async () => {
			const res = await app.request('/events/stats', {
				method: 'GET', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.stats.totalEvents).toBe(2);
			expect(json.stats.byType).toHaveLength(2);
			expect(json.stats.avgProcessingTime).toBe(82);
			expect(json.stats.errorRate).toBe(0.5);
		});
	});

	describe('POST /events/replay/:id', () => {
		it('replays an event', async () => {
			const res = await app.request('/events/replay/ev1', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(200);
			const json: any = await res.json();
			expect(json.replayed).toBe(true);
			expect(json.triggeredWorkflows).toEqual(['w1']);
		});

		it('returns 404 for unknown event', async () => {
			const res = await app.request('/events/replay/missing', {
				method: 'POST', headers: { Authorization: `Bearer ${token}` },
			}, mockEnv);
			expect(res.status).toBe(404);
		});
	});
});
