import { Hono } from 'hono';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import { kvCache } from './cache';
import type { AppEnv } from '../app/types';

function createMockKV() {
	const store = new Map<string, string>();
	return {
		get: vi.fn((key: string) => Promise.resolve(store.get(key) ?? null)),
		put: vi.fn((key: string, val: string) => {
			store.set(key, val);
			return Promise.resolve();
		}),
		_store: store,
	};
}

function createApp(kv: ReturnType<typeof createMockKV>) {
	const app = new Hono<AppEnv>();
	app.use('*', async (c, next) => {
		(c.env as any) = { KV: kv };
		c.set('tenantId', 'tenant-1');
		await next();
	});
	app.get('/data', kvCache({ ttl: 300, prefix: 'test' }), (c) => {
		return c.json({ value: 42 });
	});
	app.post('/data', kvCache({ ttl: 300, prefix: 'test' }), (c) => {
		return c.json({ created: true });
	});
	return app;
}

describe('kvCache middleware', () => {
	let kv: ReturnType<typeof createMockKV>;
	let app: Hono<AppEnv>;

	beforeEach(() => {
		kv = createMockKV();
		app = createApp(kv);
	});

	it('returns MISS on first request and caches response', async () => {
		const res = await app.request('/data');
		expect(res.status).toBe(200);
		expect(res.headers.get('X-Cache')).toBe('MISS');
		expect(res.headers.get('ETag')).toBeTruthy();
		expect(kv.put).toHaveBeenCalled();
	});

	it('returns HIT on cached request', async () => {
		await app.request('/data');
		const res = await app.request('/data');
		expect(res.status).toBe(200);
		expect(res.headers.get('X-Cache')).toBe('HIT');
	});

	it('returns 304 when ETag matches', async () => {
		const first = await app.request('/data');
		const etag = first.headers.get('ETag')!;

		const res = await app.request('/data', {
			headers: { 'If-None-Match': etag },
		});
		expect(res.status).toBe(304);
	});

	it('skips caching for POST requests', async () => {
		const res = await app.request('/data', { method: 'POST' });
		expect(res.status).toBe(200);
		expect(res.headers.get('X-Cache')).toBeNull();
	});

	it('includes Cache-Control header', async () => {
		const res = await app.request('/data');
		expect(res.headers.get('Cache-Control')).toBe('private, max-age=300');
	});
});
