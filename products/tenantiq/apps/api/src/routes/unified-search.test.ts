import { Hono } from 'hono';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AppEnv } from '../app/types';
import { unifiedSearchRoutes } from './unified-search';

const mockAll = vi.fn();
const mockBind = vi.fn(() => ({ all: mockAll }));
const mockPrepare = vi.fn(() => ({ bind: mockBind }));
const mockDB = { prepare: mockPrepare };

describe('Unified Search', () => {
	let app: Hono<AppEnv>;
	let mockEnv: AppEnv['Bindings'];

	beforeEach(() => {
		app = new Hono<AppEnv>();

		// Simulate auth middleware setting user
		app.use('*', async (c, next) => {
			c.set('user', { sub: 'u1', email: 'a@b.com', name: 'Test', orgId: 'org1', tenantIds: [], role: 'admin' });
			await next();
		});
		app.route('/api/search', unifiedSearchRoutes);

		mockEnv = { DB: mockDB, JWT_SECRET: 'test', ENVIRONMENT: 'test' } as any;
		vi.clearAllMocks();
		mockAll.mockResolvedValue({ results: [] });
	});

	it('should return 400 for missing query', async () => {
		const res = await app.request('/api/search', { method: 'GET' }, mockEnv);
		expect(res.status).toBe(400);
	});

	it('should return 400 for short query', async () => {
		const res = await app.request('/api/search?q=a', { method: 'GET' }, mockEnv);
		expect(res.status).toBe(400);
	});

	it('should return categorized results', async () => {
		mockAll.mockResolvedValue({ results: [{ id: '1', name: 'Contoso', domain: 'contoso.com' }] });
		const res = await app.request('/api/search?q=contoso', { method: 'GET' }, mockEnv);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data).toHaveProperty('tenants');
		expect(json.data).toHaveProperty('alerts');
		expect(json.data).toHaveProperty('controls');
		expect(json.data).toHaveProperty('workflows');
		expect(json.query).toBe('contoso');
	});

	it('should handle database errors gracefully', async () => {
		mockAll.mockRejectedValue(new Error('DB error'));
		const res = await app.request('/api/search?q=test', { method: 'GET' }, mockEnv);
		expect(res.status).toBe(200);
		const json = await res.json();
		expect(json.data.tenants).toEqual([]);
	});
});
